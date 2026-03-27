import { v4 as uuidv4 } from 'uuid';
import {
  LogEntry,
  AnalysisRequest,
  AnalysisResult,
  RootCause,
  Pattern,
} from '../types';
import { PatternDetector } from './pattern-detector';

export class Analyzer {
  private patternDetector: PatternDetector;

  constructor() {
    this.patternDetector = new PatternDetector();
  }

  analyze(request: AnalysisRequest): AnalysisResult {
    const startTime = Date.now();

    const logs = request.logs || [];
    const errorMessages = request.errorMessages || [];

    // Combine error messages into synthetic log entries if no logs provided
    const allLogs: LogEntry[] = logs.length > 0
      ? logs
      : errorMessages.map((msg) => ({
          level: 'error' as const,
          message: msg,
          timestamp: new Date().toISOString(),
        }));

    const patterns = this.patternDetector.detect(allLogs);
    const rootCause = this.determineRootCause(allLogs, patterns);
    const severity = this.calculateSeverity(allLogs, patterns);
    const recommendations = this.generateRecommendations(rootCause, severity, patterns);
    const summary = this.generateSummary(allLogs, rootCause, severity);
    const confidence = this.calculateConfidence(allLogs, patterns);

    return {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      summary,
      rootCause,
      recommendations,
      severity,
      confidence,
      patterns,
      analyzedLogs: allLogs.length,
      processingTimeMs: Date.now() - startTime,
    };
  }

  private determineRootCause(logs: LogEntry[], patterns: Pattern[]): RootCause {
    const messages = logs.map((l) => l.message.toLowerCase()).join(' ');
    const evidence: string[] = [];

    // Database issues
    if (messages.includes('connection') && (messages.includes('refused') || messages.includes('timeout') || messages.includes('pool'))) {
      evidence.push(...logs.filter((l) => /connection|refused|timeout|pool/i.test(l.message)).slice(0, 3).map((l) => l.message));
      return {
        category: 'Database Connectivity',
        description: 'Database connection failures detected. The application is unable to establish or maintain connections to the database server, likely due to connection pool exhaustion, network issues, or database server overload.',
        evidence,
      };
    }

    // Memory issues
    if (messages.includes('memory') || messages.includes('heap') || messages.includes('oom') || messages.includes('out of memory')) {
      evidence.push(...logs.filter((l) => /memory|heap|oom|out of memory/i.test(l.message)).slice(0, 3).map((l) => l.message));
      return {
        category: 'Memory Exhaustion',
        description: 'Application is running out of available memory. This could be caused by a memory leak, large payload processing, or insufficient resource allocation.',
        evidence,
      };
    }

    // Network/timeout
    if (messages.includes('timeout') || messages.includes('econnreset') || messages.includes('socket hang up')) {
      evidence.push(...logs.filter((l) => /timeout|econnreset|socket hang up|ETIMEDOUT/i.test(l.message)).slice(0, 3).map((l) => l.message));
      return {
        category: 'Network/Timeout',
        description: 'Network connectivity issues or request timeouts detected. Upstream services or external dependencies may be slow or unreachable.',
        evidence,
      };
    }

    // Auth issues
    if (messages.includes('unauthorized') || messages.includes('403') || messages.includes('authentication') || messages.includes('token')) {
      evidence.push(...logs.filter((l) => /unauthorized|403|authentication|token/i.test(l.message)).slice(0, 3).map((l) => l.message));
      return {
        category: 'Authentication/Authorization',
        description: 'Authentication or authorization failures detected. Tokens may be expired, misconfigured, or security policies may be blocking requests.',
        evidence,
      };
    }

    // Disk/storage
    if (messages.includes('disk') || messages.includes('storage') || messages.includes('no space') || messages.includes('enospc')) {
      evidence.push(...logs.filter((l) => /disk|storage|no space|enospc/i.test(l.message)).slice(0, 3).map((l) => l.message));
      return {
        category: 'Storage/Disk',
        description: 'Disk space or storage issues detected. The filesystem may be full or write operations are failing.',
        evidence,
      };
    }

    // Rate limiting
    if (messages.includes('rate limit') || messages.includes('429') || messages.includes('too many requests')) {
      evidence.push(...logs.filter((l) => /rate limit|429|too many requests/i.test(l.message)).slice(0, 3).map((l) => l.message));
      return {
        category: 'Rate Limiting',
        description: 'Rate limiting or throttling detected. The service is receiving more requests than configured thresholds allow.',
        evidence,
      };
    }

    // Fallback — use pattern info
    const topPattern = patterns.length > 0 ? patterns[0] : null;
    evidence.push(...logs.filter((l) => l.level === 'error' || l.level === 'fatal').slice(0, 3).map((l) => l.message));

    return {
      category: topPattern ? `Pattern: ${topPattern.name}` : 'Unknown',
      description: topPattern
        ? `Dominant error pattern: ${topPattern.description}. Found ${topPattern.occurrences} occurrences. Manual investigation recommended.`
        : 'Unable to determine specific root cause from provided logs. Manual investigation recommended.',
      evidence,
    };
  }

  private calculateSeverity(logs: LogEntry[], patterns: Pattern[]): 'low' | 'medium' | 'high' | 'critical' {
    const errorCount = logs.filter((l) => l.level === 'error' || l.level === 'fatal').length;
    const fatalCount = logs.filter((l) => l.level === 'fatal').length;
    const errorRate = logs.length > 0 ? errorCount / logs.length : 0;

    if (fatalCount > 0 || errorRate > 0.7) return 'critical';
    if (errorRate > 0.4 || patterns.some((p) => p.occurrences > 10)) return 'high';
    if (errorRate > 0.1) return 'medium';
    return 'low';
  }

  private generateRecommendations(rootCause: RootCause, severity: string, _patterns: Pattern[]): string[] {
    const recs: string[] = [];

    if (severity === 'critical') {
      recs.push('IMMEDIATE: Consider rolling back the latest deployment or restarting affected services');
    }

    switch (rootCause.category) {
      case 'Database Connectivity':
        recs.push('Check database server health and availability');
        recs.push('Review connection pool configuration (min/max connections, idle timeout)');
        recs.push('Verify database credentials and network security groups');
        recs.push('Check for long-running queries that may be holding connections');
        break;
      case 'Memory Exhaustion':
        recs.push('Restart affected containers/pods to reclaim memory');
        recs.push('Profile application memory usage to identify leak source');
        recs.push('Increase memory limits in deployment configuration');
        recs.push('Review recent code changes for unbounded data structures');
        break;
      case 'Network/Timeout':
        recs.push('Check upstream service health dashboards');
        recs.push('Review and increase timeout configurations if appropriate');
        recs.push('Implement circuit breaker pattern for external calls');
        recs.push('Check DNS resolution and load balancer health');
        break;
      case 'Authentication/Authorization':
        recs.push('Verify JWT/token configuration and secret rotation');
        recs.push('Check identity provider (IdP) status');
        recs.push('Review recent RBAC or permission changes');
        break;
      case 'Storage/Disk':
        recs.push('Free up disk space by cleaning old logs and temp files');
        recs.push('Expand volume size or add additional storage');
        recs.push('Implement log rotation and archiving');
        break;
      case 'Rate Limiting':
        recs.push('Implement request queuing or backpressure');
        recs.push('Review rate limit thresholds');
        recs.push('Scale horizontally to handle increased load');
        break;
      default:
        recs.push('Review recent deployments and configuration changes');
        recs.push('Examine application logs for additional context');
        recs.push('Check monitoring dashboards for correlated anomalies');
    }

    return recs;
  }

  private generateSummary(logs: LogEntry[], rootCause: RootCause, severity: string): string {
    const errorCount = logs.filter((l) => l.level === 'error' || l.level === 'fatal').length;
    const services = [...new Set(logs.filter((l) => l.service).map((l) => l.service))];
    const serviceStr = services.length > 0 ? ` across service(s): ${services.join(', ')}` : '';

    return `Analyzed ${logs.length} log entries${serviceStr}. Found ${errorCount} error/fatal entries. ` +
      `Severity: ${severity.toUpperCase()}. Root cause category: ${rootCause.category}. ` +
      `${rootCause.description.split('.')[0]}.`;
  }

  private calculateConfidence(logs: LogEntry[], patterns: Pattern[]): number {
    let confidence = 0.3; // base

    if (logs.length > 5) confidence += 0.1;
    if (logs.length > 20) confidence += 0.1;
    if (patterns.length > 0) confidence += 0.2;
    if (patterns.some((p) => p.occurrences > 3)) confidence += 0.1;
    if (logs.some((l) => l.service)) confidence += 0.1;
    if (logs.some((l) => l.timestamp)) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }
}
