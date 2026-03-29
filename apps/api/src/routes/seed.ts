import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { IncidentStore } from '../stores/incident-store';
import { RunbookStore } from '../stores/runbook-store';
import { UserStore } from '../stores/user-store';
import { TeamStore } from '../stores/team-store';
import { NotificationStore } from '../stores/notification-store';
import { Incident, Runbook, Severity, IncidentStatus, RunbookStep } from '@incident-analyzer/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';

// --- Pre-built runbooks ---

function createRunbooks(): Runbook[] {
  return [
    {
      id: uuidv4(),
      name: 'Database Connectivity Runbook',
      description: 'Step-by-step remediation for database connection failures, pool exhaustion, and timeouts.',
      category: 'Database Connectivity',
      tags: ['database', 'connection', 'pool', 'timeout', 'postgres', 'mysql'],
      steps: [
        { order: 0, title: 'Check database server status', description: 'Verify the database process is running and accepting connections.', command: 'pg_isready -h $DB_HOST -p 5432', expectedOutcome: 'Server should report accepting connections', isAutomatable: true },
        { order: 1, title: 'Check connection pool metrics', description: 'Review active/idle/waiting connections in the pool.', command: 'SELECT count(*) FROM pg_stat_activity;', expectedOutcome: 'Active connections below max pool size', isAutomatable: true },
        { order: 2, title: 'Kill long-running queries', description: 'Identify and terminate queries running longer than 5 minutes.', command: "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - INTERVAL '5 minutes';", expectedOutcome: 'Stale connections freed', isAutomatable: false },
        { order: 3, title: 'Restart connection pool', description: 'Restart the application to reset the connection pool if exhausted.', command: 'kubectl rollout restart deployment/$APP_NAME', expectedOutcome: 'Fresh connection pool established', isAutomatable: false },
        { order: 4, title: 'Verify recovery', description: 'Confirm application can establish new DB connections and queries succeed.', command: 'curl -s http://localhost:3000/health | jq .database', expectedOutcome: 'Health check returns database: ok', isAutomatable: true },
      ],
      estimatedTimeMinutes: 15,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      name: 'Memory Exhaustion Runbook',
      description: 'Remediation steps for OOM kills, heap exhaustion, and memory leak investigation.',
      category: 'Memory Exhaustion',
      tags: ['memory', 'oom', 'heap', 'leak', 'out of memory'],
      steps: [
        { order: 0, title: 'Identify affected pods/containers', description: 'Find which containers were OOM-killed or are consuming excessive memory.', command: 'kubectl top pods --sort-by=memory | head -10', expectedOutcome: 'Identify pods using >80% of memory limit', isAutomatable: true },
        { order: 1, title: 'Capture heap dump', description: 'If the process is still running, capture a heap dump before restarting.', command: 'kill -USR1 $PID  # Node.js heap dump signal', expectedOutcome: 'Heap dump file generated for analysis', isAutomatable: false },
        { order: 2, title: 'Restart affected services', description: 'Restart containers to reclaim memory immediately.', command: 'kubectl rollout restart deployment/$APP_NAME', expectedOutcome: 'Memory usage drops to baseline', isAutomatable: false },
        { order: 3, title: 'Increase memory limits (temporary)', description: 'If the issue recurs, temporarily increase memory limits.', command: 'kubectl set resources deployment/$APP_NAME --limits=memory=2Gi', expectedOutcome: 'Service stable with higher limit', isAutomatable: false },
        { order: 4, title: 'Analyze heap dump', description: 'Use Chrome DevTools or clinic.js to analyze the heap dump for leak sources.', command: 'clinic heapprofile -- node dist/index.js', expectedOutcome: 'Identify objects causing memory growth', isAutomatable: false },
      ],
      estimatedTimeMinutes: 30,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      name: 'Network Timeout Runbook',
      description: 'Diagnose and resolve network connectivity issues, upstream timeouts, and DNS failures.',
      category: 'Network/Timeout',
      tags: ['timeout', 'network', 'dns', 'upstream', 'econnreset', 'socket'],
      steps: [
        { order: 0, title: 'Check upstream service health', description: 'Verify the upstream service is responding.', command: 'curl -w "%{time_total}" -o /dev/null -s http://$UPSTREAM_HOST/health', expectedOutcome: 'Response time under 1s', isAutomatable: true },
        { order: 1, title: 'Check DNS resolution', description: 'Verify DNS resolves correctly for the target service.', command: 'nslookup $UPSTREAM_HOST', expectedOutcome: 'DNS resolves to expected IP', isAutomatable: true },
        { order: 2, title: 'Test network connectivity', description: 'Verify TCP connectivity to the upstream service.', command: 'nc -zv $UPSTREAM_HOST $PORT', expectedOutcome: 'Connection succeeded', isAutomatable: true },
        { order: 3, title: 'Review timeout configuration', description: 'Check if timeout values are appropriate for the service.', command: 'grep -r "timeout" config/ | head -20', expectedOutcome: 'Timeouts should be >5s for external services', isAutomatable: false },
        { order: 4, title: 'Enable circuit breaker', description: 'If upstream is degraded, enable circuit breaker to fail fast.', command: 'curl -X POST http://localhost:3000/admin/circuit-breaker/enable', expectedOutcome: 'Requests fail fast instead of timing out', isAutomatable: true },
      ],
      estimatedTimeMinutes: 20,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      name: 'Authentication Failure Runbook',
      description: 'Investigate and resolve authentication/authorization failures, token issues, and IdP problems.',
      category: 'Authentication/Authorization',
      tags: ['auth', 'token', 'jwt', 'unauthorized', '401', '403', 'permission'],
      steps: [
        { order: 0, title: 'Check IdP status', description: 'Verify the identity provider (Auth0, Okta, etc.) is operational.', command: 'curl -s https://$IDP_DOMAIN/.well-known/openid-configuration | jq .issuer', expectedOutcome: 'IdP returns valid configuration', isAutomatable: true },
        { order: 1, title: 'Verify JWT signing keys', description: 'Check if JWT signing keys have been rotated recently.', command: 'curl -s https://$IDP_DOMAIN/.well-known/jwks.json | jq ".keys | length"', expectedOutcome: 'Keys present and valid', isAutomatable: true },
        { order: 2, title: 'Check token expiration', description: 'Decode a failing token to check expiration and claims.', command: 'echo $TOKEN | cut -d. -f2 | base64 -d | jq .exp', expectedOutcome: 'Token not expired, correct claims', isAutomatable: false },
        { order: 3, title: 'Review RBAC changes', description: 'Check for recent role or permission changes that may be blocking access.', command: 'git log --oneline --since="24 hours ago" -- rbac/ permissions/', expectedOutcome: 'Identify any recent permission changes', isAutomatable: false },
        { order: 4, title: 'Rotate secrets if compromised', description: 'If tokens are invalid due to secret rotation, update the signing secret.', command: 'kubectl create secret generic jwt-secret --from-literal=key=$NEW_SECRET --dry-run=client -o yaml | kubectl apply -f -', expectedOutcome: 'New secret deployed, tokens validate', isAutomatable: false },
      ],
      estimatedTimeMinutes: 25,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      name: 'Disk/Storage Runbook',
      description: 'Remediate disk space issues, storage exhaustion, and write failures.',
      category: 'Storage/Disk',
      tags: ['disk', 'storage', 'enospc', 'space', 'volume'],
      steps: [
        { order: 0, title: 'Check disk usage', description: 'Identify which filesystems are full.', command: 'df -h | grep -E "9[0-9]%|100%"', expectedOutcome: 'Identify partitions above 90% usage', isAutomatable: true },
        { order: 1, title: 'Find large files', description: 'Locate the largest files consuming disk space.', command: 'du -sh /var/log/* | sort -rh | head -10', expectedOutcome: 'Identify log files or temp files to clean', isAutomatable: true },
        { order: 2, title: 'Clean old logs', description: 'Remove or compress old log files.', command: 'find /var/log -name "*.log" -mtime +7 -delete', expectedOutcome: 'Disk usage drops below 85%', isAutomatable: true },
        { order: 3, title: 'Expand volume', description: 'If cleanup is insufficient, expand the storage volume.', command: 'kubectl patch pvc $PVC_NAME -p \'{"spec":{"resources":{"requests":{"storage":"50Gi"}}}}\'', expectedOutcome: 'Volume expanded, more space available', isAutomatable: false },
      ],
      estimatedTimeMinutes: 15,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      name: 'Rate Limiting Runbook',
      description: 'Handle rate limit breaches, 429 errors, and traffic spikes.',
      category: 'Rate Limiting',
      tags: ['rate limit', '429', 'throttle', 'traffic', 'load'],
      steps: [
        { order: 0, title: 'Identify traffic source', description: 'Determine which clients or endpoints are generating the most traffic.', command: 'kubectl logs $POD --tail=1000 | grep "429" | awk \'{print $NF}\' | sort | uniq -c | sort -rn | head -10', expectedOutcome: 'Identify top offending clients/IPs', isAutomatable: true },
        { order: 1, title: 'Review rate limit config', description: 'Check current rate limit thresholds.', command: 'grep -r "rateLimit" config/ | head -10', expectedOutcome: 'Understand current limits', isAutomatable: false },
        { order: 2, title: 'Scale horizontally', description: 'Add more replicas to handle increased load.', command: 'kubectl scale deployment/$APP_NAME --replicas=5', expectedOutcome: 'More capacity to serve requests', isAutomatable: false },
        { order: 3, title: 'Adjust rate limits', description: 'If the traffic is legitimate, increase rate limits.', command: 'Update RATE_LIMIT_PER_MINUTE in config and redeploy', expectedOutcome: 'Legitimate traffic no longer throttled', isAutomatable: false },
      ],
      estimatedTimeMinutes: 20,
      lastUpdated: new Date().toISOString(),
    },
  ];
}

// --- Seed incident scenarios ---

interface SeedScenario {
  title: string;
  service: string;
  severity: Severity;
  category: string;
  summary: string;
  description: string;
  evidence: string[];
  patterns: { name: string; occurrences: number; description: string }[];
  recommendations: string[];
  confidence: number;
  analyzedLogs: number;
  status: IncidentStatus;
  pdStatus?: 'triggered' | 'acknowledged' | 'resolved';
  hoursAgo: number;
  resolvedHoursAgo?: number;
}

const scenarios: SeedScenario[] = [
  {
    title: 'Production DB connection pool exhausted',
    service: 'user-api',
    severity: 'critical',
    category: 'Database Connectivity',
    summary: 'Analyzed 47 log entries across user-api. Found 38 error/fatal entries. Connection pool fully exhausted.',
    description: 'Database connection failures detected. All 20 pool connections are in use with 15 queries waiting.',
    evidence: ['Connection pool exhausted, all 20 connections in use', 'FATAL: too many connections for role "app"', 'Connection timeout after 30000ms'],
    patterns: [{ name: 'Connection Failure', occurrences: 38, description: 'Repeated connection failures to PostgreSQL' }],
    recommendations: ['Check database server health', 'Review connection pool configuration', 'Kill long-running queries'],
    confidence: 0.92,
    analyzedLogs: 47,
    status: 'acknowledged',
    pdStatus: 'acknowledged',
    hoursAgo: 2,
  },
  {
    title: 'Payment service OOM kills in production',
    service: 'payment-service',
    severity: 'critical',
    category: 'Memory Exhaustion',
    summary: 'Analyzed 23 log entries. 3 pods OOM-killed in the last hour. Memory leak suspected in transaction processor.',
    description: 'Application is running out of available memory. Memory usage grows linearly without recovery.',
    evidence: ['OOMKilled: container payment-service exceeded 1Gi limit', 'Heap used: 987MB / 1024MB', 'GC pause: 4500ms (full GC)'],
    patterns: [{ name: 'OOM / Memory', occurrences: 12, description: 'Memory-related errors indicating resource exhaustion' }],
    recommendations: ['Restart affected pods', 'Capture heap dump', 'Increase memory limits temporarily'],
    confidence: 0.88,
    analyzedLogs: 23,
    status: 'investigating',
    pdStatus: 'triggered',
    hoursAgo: 1,
  },
  {
    title: 'Upstream auth service timeouts',
    service: 'api-gateway',
    severity: 'high',
    category: 'Network/Timeout',
    summary: 'Analyzed 85 log entries. Auth service responding with >5s latency causing cascading timeouts.',
    description: 'Network connectivity issues detected. Auth service at auth.internal:8080 is consistently slow.',
    evidence: ['ETIMEDOUT connecting to auth.internal:8080', 'Request timeout after 5000ms', 'Circuit breaker OPEN for auth-service'],
    patterns: [{ name: 'Timeout', occurrences: 62, description: 'Request or operation timeout errors' }, { name: 'Connection Failure', occurrences: 23, description: 'Upstream connection failures' }],
    recommendations: ['Check auth service health', 'Increase timeout to 10s', 'Enable circuit breaker'],
    confidence: 0.85,
    analyzedLogs: 85,
    status: 'open',
    hoursAgo: 0.5,
  },
  {
    title: 'JWT validation failures after key rotation',
    service: 'user-api',
    severity: 'high',
    category: 'Authentication/Authorization',
    summary: 'Analyzed 156 log entries. Mass 401 errors started 30min after scheduled key rotation.',
    description: 'JWT tokens signed with old key are being rejected. Key rotation did not propagate to all services.',
    evidence: ['JsonWebTokenError: invalid signature', '401 Unauthorized on /api/v2/users', 'JWKS key not found for kid: old-key-2024'],
    patterns: [{ name: 'Authentication Error', occurrences: 142, description: 'JWT validation failures' }],
    recommendations: ['Verify JWKS endpoint returns new key', 'Clear JWT cache on all services', 'Review key rotation procedure'],
    confidence: 0.91,
    analyzedLogs: 156,
    status: 'resolved',
    pdStatus: 'resolved',
    hoursAgo: 8,
    resolvedHoursAgo: 6,
  },
  {
    title: 'Log volume disk full on collector',
    service: 'log-collector',
    severity: 'medium',
    category: 'Storage/Disk',
    summary: 'Analyzed 12 log entries. /var/log partition at 98%. Log rotation not running.',
    description: 'Disk space exhausted on log collector. New logs are being dropped.',
    evidence: ['ENOSPC: no space left on device', 'write /var/log/app.log: no space left', 'df: /var/log 98% used'],
    patterns: [{ name: 'Disk/Storage', occurrences: 12, description: 'Disk space exhaustion' }],
    recommendations: ['Clean old logs', 'Fix log rotation cron', 'Expand volume'],
    confidence: 0.95,
    analyzedLogs: 12,
    status: 'resolved',
    hoursAgo: 24,
    resolvedHoursAgo: 22,
  },
  {
    title: 'API rate limit breach from batch client',
    service: 'api-gateway',
    severity: 'medium',
    category: 'Rate Limiting',
    summary: 'Analyzed 340 log entries. Single client IP generating 2000 req/min (limit: 500).',
    description: 'Rate limiting triggered by a batch processing client sending requests without backoff.',
    evidence: ['Rate limit exceeded for IP 10.0.5.42', '429 Too Many Requests', 'Request queue depth: 1500'],
    patterns: [{ name: 'Rate Limiting', occurrences: 280, description: 'Rate limit breaches' }],
    recommendations: ['Contact client team about rate limits', 'Implement request queuing', 'Consider dedicated batch endpoint'],
    confidence: 0.93,
    analyzedLogs: 340,
    status: 'open',
    hoursAgo: 3,
  },
  {
    title: 'Search service DNS resolution failures',
    service: 'search-service',
    severity: 'high',
    category: 'Network/Timeout',
    summary: 'Analyzed 67 log entries. CoreDNS failing intermittently causing search index connection failures.',
    description: 'DNS resolution failing for elasticsearch.internal. Likely CoreDNS pod issue.',
    evidence: ['ENOTFOUND elasticsearch.internal', 'DNS resolution failed after 3 retries', 'getaddrinfo ENOTFOUND elasticsearch.internal'],
    patterns: [{ name: 'DNS Resolution', occurrences: 45, description: 'DNS lookup failures' }, { name: 'Timeout', occurrences: 22, description: 'Connection timeouts after DNS failure' }],
    recommendations: ['Check CoreDNS pod health', 'Verify DNS config', 'Add IP-based fallback'],
    confidence: 0.82,
    analyzedLogs: 67,
    status: 'acknowledged',
    pdStatus: 'acknowledged',
    hoursAgo: 5,
  },
  {
    title: 'Inventory service null pointer exceptions',
    service: 'inventory-service',
    severity: 'medium',
    category: 'Pattern: Null/Undefined',
    summary: 'Analyzed 28 log entries. TypeError in product lookup after schema migration.',
    description: 'Null reference errors in product lookup. New nullable field not handled in code.',
    evidence: ['TypeError: Cannot read properties of undefined (reading "warehouse_id")', 'Unhandled exception in ProductLookup.getAvailability', 'Error at line 145: product.warehouse_id.toString()'],
    patterns: [{ name: 'Null/Undefined', occurrences: 28, description: 'Null reference errors in application code' }],
    recommendations: ['Add null check for warehouse_id', 'Review migration script', 'Deploy hotfix'],
    confidence: 0.87,
    analyzedLogs: 28,
    status: 'open',
    hoursAgo: 1.5,
  },
  {
    title: 'Order service database deadlocks',
    service: 'order-service',
    severity: 'high',
    category: 'Database Connectivity',
    summary: 'Analyzed 34 log entries. Frequent deadlocks on orders table during peak hours.',
    description: 'Database deadlocks occurring on concurrent order updates. Transaction isolation level may be too strict.',
    evidence: ['ERROR: deadlock detected', 'DETAIL: Process 12345 waits for ShareLock on transaction 67890', 'Lock timeout after 5000ms on orders table'],
    patterns: [{ name: 'Database Error', occurrences: 18, description: 'Deadlock and lock timeout errors' }, { name: 'Connection Failure', occurrences: 16, description: 'Connection failures after lock timeout' }],
    recommendations: ['Review transaction isolation levels', 'Add retry logic for deadlocks', 'Optimize query ordering'],
    confidence: 0.79,
    analyzedLogs: 34,
    status: 'investigating',
    hoursAgo: 4,
  },
  {
    title: 'Notification service permission denied',
    service: 'notification-service',
    severity: 'medium',
    category: 'Authentication/Authorization',
    summary: 'Analyzed 19 log entries. Service account lacks permission to publish to SNS topic after IAM policy update.',
    description: 'Authorization failures when publishing notifications. IAM policy was updated yesterday.',
    evidence: ['AccessDeniedException: User is not authorized to perform: SNS:Publish', '403 Forbidden on arn:aws:sns:us-east-1:*:notifications', 'Permission denied for service account notification-svc'],
    patterns: [{ name: 'Permission Denied', occurrences: 19, description: 'Authorization errors' }],
    recommendations: ['Review recent IAM policy changes', 'Restore SNS publish permission', 'Add policy validation to CI'],
    confidence: 0.94,
    analyzedLogs: 19,
    status: 'resolved',
    pdStatus: 'resolved',
    hoursAgo: 12,
    resolvedHoursAgo: 10,
  },
  {
    title: 'Redis connection storm after failover',
    service: 'session-service',
    severity: 'critical',
    category: 'Database Connectivity',
    summary: 'Analyzed 92 log entries. Redis sentinel failover caused all clients to reconnect simultaneously.',
    description: 'Redis primary failover triggered a connection storm. All 50 app instances reconnected at once.',
    evidence: ['ECONNREFUSED 10.0.3.5:6379', 'Redis connection lost, reconnecting...', 'MaxRetriesPerRequestError: Reached the max retries per request limit'],
    patterns: [{ name: 'Connection Failure', occurrences: 78, description: 'Mass Redis reconnection attempts' }],
    recommendations: ['Implement connection jitter/backoff', 'Check Redis sentinel config', 'Verify new primary is healthy'],
    confidence: 0.86,
    analyzedLogs: 92,
    status: 'resolved',
    pdStatus: 'resolved',
    hoursAgo: 18,
    resolvedHoursAgo: 17,
  },
  {
    title: 'Billing service memory leak (gradual)',
    service: 'billing-service',
    severity: 'medium',
    category: 'Memory Exhaustion',
    summary: 'Analyzed 8 log entries. Heap usage growing 50MB/hour. No OOM yet but projected to hit limit in 4 hours.',
    description: 'Gradual memory leak detected. Heap usage increasing steadily without garbage collection reclaiming.',
    evidence: ['Heap used: 780MB (growing +50MB/hr)', 'GC: old_space not reclaiming: 650MB retained', 'Warning: approaching memory limit (1Gi)'],
    patterns: [{ name: 'OOM / Memory', occurrences: 8, description: 'Gradual memory growth' }],
    recommendations: ['Schedule restart before OOM', 'Profile with --inspect flag', 'Check for event listener leaks'],
    confidence: 0.72,
    analyzedLogs: 8,
    status: 'open',
    hoursAgo: 6,
  },
];

export function seedRoutes(incidentStore: IncidentStore, runbookStore: RunbookStore, userStore: UserStore, teamStore: TeamStore, notificationStore?: NotificationStore): Router {
  const router = Router();
  const auth = authMiddleware(userStore);

  router.post('/', auth, requirePermission('settings:manage'), async (req: Request, res: Response) => {
    const orgId = req.user!.orgId;
    // Clear existing data for this org
    await incidentStore.clear(orgId);
    await runbookStore.clear(orgId);
    if (notificationStore) await notificationStore.clearForOrg(orgId);

    // Seed runbooks
    const runbooks = createRunbooks();
    for (const rb of runbooks) {
      await runbookStore.save({ ...rb, orgId } as any);
    }

    // Seed incidents
    const ids: string[] = [];
    for (const s of scenarios) {
      const now = Date.now();
      const createdAt = new Date(now - s.hoursAgo * 60 * 60 * 1000).toISOString();
      const resolvedAt = s.resolvedHoursAgo ? new Date(now - s.resolvedHoursAgo * 60 * 60 * 1000).toISOString() : undefined;
      const id = uuidv4();

      // Match runbook
      const runbookMatch = await runbookStore.matchForIncident(s.category, s.patterns.map(p => p.name), orgId);

      const incident: any = {
        id,
        orgId,
        title: s.title,
        analysis: {
          id: uuidv4(),
          timestamp: createdAt,
          summary: s.summary,
          rootCause: { category: s.category, description: s.description, evidence: s.evidence },
          recommendations: s.recommendations,
          severity: s.severity,
          confidence: s.confidence,
          patterns: s.patterns,
          analyzedLogs: s.analyzedLogs,
          processingTimeMs: Math.floor(Math.random() * 50) + 5,
        },
        status: s.status,
        source: s.pdStatus ? 'pagerduty' : 'api',
        service: s.service,
        runbook: runbookMatch ? {
          runbookId: runbookMatch.runbook.id,
          runbookName: runbookMatch.runbook.name,
          matchScore: runbookMatch.score,
          matchReason: runbookMatch.reason,
          completedSteps: s.status === 'resolved' ? runbookMatch.runbook.steps.map((_: RunbookStep, i: number) => i) : [],
        } : undefined,
        pagerduty: s.pdStatus ? {
          dedupKey: `incident-analyzer-${id}`,
          status: s.pdStatus,
          triggeredAt: createdAt,
          acknowledgedAt: s.pdStatus !== 'triggered' ? new Date(new Date(createdAt).getTime() + 5 * 60 * 1000).toISOString() : undefined,
          resolvedAt: s.pdStatus === 'resolved' ? resolvedAt : undefined,
          incidentId: `PD-${id.slice(0, 8).toUpperCase()}`,
          htmlUrl: `https://your-org.pagerduty.com/incidents/PD-${id.slice(0, 8).toUpperCase()}`,
        } : undefined,
        createdAt,
        updatedAt: resolvedAt || createdAt,
        resolvedAt,
        timeToResolveMs: resolvedAt ? new Date(resolvedAt).getTime() - new Date(createdAt).getTime() : undefined,
      };

      await incidentStore.save(incident, false);
      ids.push(id);
    }

    // Seed a demo team with all users
    const existingTeams = await teamStore.list(orgId);
    for (const t of existingTeams) await teamStore.delete(t.id);

    const allUsers = await userStore.listUsers(orgId);
    const admin = allUsers.find((u: any) => u.role === 'admin');
    const team = await teamStore.create('SRE Team', 'Site Reliability Engineering — on-call rotation', admin?.id || allUsers[0]?.id, orgId);
    for (const u of allUsers) {
      if (u.id !== team.members[0]?.userId) {
        await teamStore.addMember(team.id, u.id, 'member');
      }
    }

    return res.json({
      message: `Seeded ${scenarios.length} incidents, ${runbooks.length} runbooks, and 1 team`,
      incidents: ids.length,
      runbooks: runbooks.length,
      teams: 1,
    });
  });

  return router;
}
