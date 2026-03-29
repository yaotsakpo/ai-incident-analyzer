export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp?: string;
  level: LogLevel;
  service?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AnalysisRequest {
  logs?: LogEntry[];
  errorMessages?: string[];
  context?: string;
}

export interface RootCause {
  category: string;
  description: string;
  evidence: string[];
}

export interface Pattern {
  name: string;
  occurrences: number;
  description: string;
}

export interface AnalysisResult {
  id: string;
  timestamp: string;
  summary: string;
  rootCause: RootCause;
  recommendations: string[];
  severity: Severity;
  confidence: number;
  patterns: Pattern[];
  analyzedLogs: number;
  processingTimeMs: number;
}

export interface AnomalyRequest {
  logs: LogEntry[];
  baseline?: {
    errorRateThreshold?: number;
    frequencyThreshold?: number;
  };
}

export interface Anomaly {
  type: string;
  severity: Severity;
  description: string;
  affectedLogs: number;
  timeRange?: { start: string; end: string };
}

export interface LogStats {
  totalLogs: number;
  errorRate: number;
  levelDistribution: Record<string, number>;
  serviceDistribution: Record<string, number>;
  timespan: { start: string; end: string } | null;
}

export interface AnomalyResult {
  id: string;
  timestamp: string;
  anomalies: Anomaly[];
  stats: LogStats;
  processingTimeMs: number;
}

// --- Incident (stored analysis result) ---

export type IncidentStatus = 'open' | 'acknowledged' | 'investigating' | 'resolved';
export type IncidentSource = 'manual' | 'api' | 'pagerduty' | 'webhook';

export interface Comment {
  id: string;
  incidentId: string;
  author: string;
  text: string;
  mentions?: string[];
  createdAt: string;
}

// --- Auth & RBAC ---

export type UserRole = 'viewer' | 'responder' | 'admin' | 'custom';

export type Permission =
  | 'incidents:view'
  | 'incidents:acknowledge'
  | 'incidents:resolve'
  | 'incidents:assign'
  | 'incidents:escalate'
  | 'incidents:create'
  | 'runbooks:view'
  | 'runbooks:manage'
  | 'analytics:view'
  | 'teams:view'
  | 'teams:manage'
  | 'users:view'
  | 'users:manage'
  | 'integrations:view'
  | 'integrations:manage'
  | 'audit:view'
  | 'settings:manage';

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  viewer: [
    'incidents:view',
    'runbooks:view',
    'analytics:view',
    'teams:view',
  ],
  responder: [
    'incidents:view',
    'incidents:acknowledge',
    'incidents:resolve',
    'incidents:assign',
    'incidents:escalate',
    'incidents:create',
    'runbooks:view',
    'runbooks:manage',
    'analytics:view',
    'teams:view',
  ],
  admin: [
    'incidents:view',
    'incidents:acknowledge',
    'incidents:resolve',
    'incidents:assign',
    'incidents:escalate',
    'incidents:create',
    'runbooks:view',
    'runbooks:manage',
    'analytics:view',
    'teams:view',
    'teams:manage',
    'users:view',
    'users:manage',
    'integrations:view',
    'integrations:manage',
    'audit:view',
    'settings:manage',
  ],
};

export function hasPermission(role: UserRole, permission: Permission, customPermissions?: Permission[]): boolean {
  if (role === 'custom') return customPermissions?.includes(permission) ?? false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export interface User {
  id: string;
  orgId: string;
  username: string;
  displayName: string;
  role: UserRole;
  permissions?: Permission[];
  email?: string;
  avatar?: string;
  mustChangePassword?: boolean;
  onboardingComplete?: boolean;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  incidentId: string;
  userId: string;
  username: string;
  action: 'created' | 'status_change' | 'assigned' | 'escalated' | 'commented' | 'runbook_step';
  fromValue?: string;
  toValue?: string;
  details?: string;
  timestamp: string;
}

// --- Integration configs ---

export interface SlackConfig {
  webhookUrl: string;
  channel: string;
  enabled: boolean;
}

export interface JiraConfig {
  baseUrl: string;
  projectKey: string;
  apiToken: string;
  email: string;
  enabled: boolean;
}

export interface OpsGenieConfig {
  apiKey: string;
  enabled: boolean;
}

export interface AIProviderConfig {
  provider: 'openai' | 'anthropic' | 'local';
  apiKey: string;
  model: string;
  enabled: boolean;
}

export interface IntegrationSettings {
  slack?: SlackConfig;
  jira?: JiraConfig;
  opsgenie?: OpsGenieConfig;
  ai?: AIProviderConfig;
  pagerduty?: PagerDutyConfig;
}

export interface TeamIntegrationOverrides {
  slackChannel?: string;
  slackMentionGroup?: string;
  jiraProjectKey?: string;
  jiraIssueType?: string;
  opsgenieTeamName?: string;
  opsgeniePriority?: 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
  pagerdutyEscalationPolicyId?: string;
}

export interface Incident {
  id: string;
  title: string;
  analysis: AnalysisResult;
  status: IncidentStatus;
  source: IncidentSource;
  service?: string;
  assignee?: string;
  assignedTeamId?: string;
  assignedTeamName?: string;
  pagerduty?: PagerDutyLink;
  runbook?: RunbookMatch;
  comments?: Comment[];
  auditLog?: AuditEntry[];
  groupId?: string;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  timeToAckMs?: number;
  timeToResolveMs?: number;
}

// --- PagerDuty ---

export interface PagerDutyLink {
  incidentId?: string;
  dedupKey: string;
  status: 'triggered' | 'acknowledged' | 'resolved';
  htmlUrl?: string;
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface PagerDutyConfig {
  routingKey: string;
  webhookSecret?: string;
  autoTriggerSeverities: Severity[];
}

// --- Runbooks ---

export interface RunbookStep {
  order: number;
  title: string;
  description: string;
  command?: string;
  expectedOutcome?: string;
  isAutomatable: boolean;
}

export interface Runbook {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  steps: RunbookStep[];
  estimatedTimeMinutes: number;
  lastUpdated: string;
}

export interface RunbookMatch {
  runbookId: string;
  runbookName: string;
  matchScore: number;
  matchReason: string;
  completedSteps: number[];
}

// --- Evaluator interface (for pattern detector) ---

export interface Evaluator {
  name: string;
  evaluate(prompt: string, response: string, metadata?: Record<string, unknown>): EvaluatorResult;
}

export interface EvaluatorResult {
  score: number;
  details: string;
}

// --- Regression alerts ---

export interface RegressionAlert {
  id: string;
  type: 'latency_spike' | 'score_drop' | 'failure_rate';
  severity: 'warning' | 'critical';
  message: string;
  currentValue: number;
  baselineValue: number;
  threshold: number;
  timestamp: string;
}

// --- SSE Events ---

export type SSEEventType = 'incident:created' | 'incident:updated' | 'incident:commented' | 'heartbeat';

export interface SSEEvent {
  type: SSEEventType;
  data: any;
  timestamp: string;
}

// --- SLA Metrics ---

export interface SLAMetrics {
  avgTimeToAckMs: number;
  avgTimeToResolveMs: number;
  p50TimeToResolveMs: number;
  p95TimeToResolveMs: number;
  slaBreaches: number;
  totalResolved: number;
  totalAcknowledged: number;
  // Dashboard aliases
  averageAckMs?: number;
  averageResolveMs?: number;
  p95AckMs?: number;
  p95ResolveMs?: number;
  breaches?: number;
  totalIncidents?: number;
}

// --- Alert Group ---

export interface AlertGroup {
  groupId: string;
  service: string;
  category: string;
  count: number;
  latestIncidentId: string;
  incidents: string[];
  severity: Severity;
  createdAt: string;
  updatedAt: string;
}
