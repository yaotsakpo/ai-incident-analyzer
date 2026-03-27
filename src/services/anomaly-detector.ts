import { v4 as uuidv4 } from 'uuid';
import { LogEntry, AnomalyRequest, AnomalyResult, Anomaly, LogStats } from '../types';

export class AnomalyDetector {
  detect(request: AnomalyRequest): AnomalyResult {
    const startTime = Date.now();
    const { logs, baseline } = request;

    const stats = this.computeStats(logs);
    const anomalies: Anomaly[] = [];

    const errorRateThreshold = baseline?.errorRateThreshold ?? 0.1;
    const frequencyThreshold = baseline?.frequencyThreshold ?? 5;

    // Error rate anomaly
    if (stats.errorRate > errorRateThreshold) {
      anomalies.push({
        type: 'High Error Rate',
        severity: stats.errorRate > 0.5 ? 'critical' : stats.errorRate > 0.3 ? 'high' : 'medium',
        description: `Error rate is ${(stats.errorRate * 100).toFixed(1)}% (threshold: ${(errorRateThreshold * 100).toFixed(1)}%)`,
        affectedLogs: logs.filter((l) => l.level === 'error' || l.level === 'fatal').length,
        timeRange: stats.timespan || undefined,
      });
    }

    // Burst detection — same error message repeated
    const messageCounts = new Map<string, number>();
    for (const log of logs) {
      if (log.level === 'error' || log.level === 'fatal') {
        const key = log.message.substring(0, 100);
        messageCounts.set(key, (messageCounts.get(key) || 0) + 1);
      }
    }

    for (const [message, count] of messageCounts) {
      if (count >= frequencyThreshold) {
        anomalies.push({
          type: 'Error Burst',
          severity: count > 20 ? 'critical' : count > 10 ? 'high' : 'medium',
          description: `"${message.substring(0, 80)}..." repeated ${count} times`,
          affectedLogs: count,
        });
      }
    }

    // Service concentration — one service generating most errors
    const serviceErrors = new Map<string, number>();
    for (const log of logs.filter((l) => l.level === 'error' || l.level === 'fatal')) {
      if (log.service) {
        serviceErrors.set(log.service, (serviceErrors.get(log.service) || 0) + 1);
      }
    }

    const totalErrors = logs.filter((l) => l.level === 'error' || l.level === 'fatal').length;
    for (const [service, count] of serviceErrors) {
      if (totalErrors > 3 && count / totalErrors > 0.8) {
        anomalies.push({
          type: 'Service Error Concentration',
          severity: 'high',
          description: `Service "${service}" accounts for ${((count / totalErrors) * 100).toFixed(0)}% of all errors (${count}/${totalErrors})`,
          affectedLogs: count,
        });
      }
    }

    // Fatal log detection
    const fatalCount = logs.filter((l) => l.level === 'fatal').length;
    if (fatalCount > 0) {
      anomalies.push({
        type: 'Fatal Errors Present',
        severity: 'critical',
        description: `${fatalCount} fatal-level log entries detected — immediate investigation required`,
        affectedLogs: fatalCount,
      });
    }

    // Time gap detection
    if (logs.length > 2) {
      const sorted = logs
        .filter((l) => l.timestamp)
        .sort((a, b) => new Date(a.timestamp!).getTime() - new Date(b.timestamp!).getTime());

      if (sorted.length > 2) {
        const timestamps = sorted.map((l) => new Date(l.timestamp!).getTime());
        const gaps: number[] = [];
        for (let i = 1; i < timestamps.length; i++) {
          gaps.push(timestamps[i] - timestamps[i - 1]);
        }
        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const maxGap = Math.max(...gaps);

        if (maxGap > avgGap * 10 && avgGap > 0) {
          anomalies.push({
            type: 'Log Gap Detected',
            severity: 'medium',
            description: `Unusual gap in log timestamps detected (max gap: ${(maxGap / 1000).toFixed(1)}s vs avg: ${(avgGap / 1000).toFixed(1)}s). Possible service outage or log pipeline issue.`,
            affectedLogs: 0,
          });
        }
      }
    }

    return {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      anomalies: anomalies.sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      stats,
      processingTimeMs: Date.now() - startTime,
    };
  }

  private computeStats(logs: LogEntry[]): LogStats {
    const levelDist: Record<string, number> = {};
    const serviceDist: Record<string, number> = {};

    for (const log of logs) {
      levelDist[log.level] = (levelDist[log.level] || 0) + 1;
      if (log.service) {
        serviceDist[log.service] = (serviceDist[log.service] || 0) + 1;
      }
    }

    const errorCount = logs.filter((l) => l.level === 'error' || l.level === 'fatal').length;

    const timestamps = logs
      .filter((l) => l.timestamp)
      .map((l) => l.timestamp!)
      .sort();

    return {
      totalLogs: logs.length,
      errorRate: logs.length > 0 ? errorCount / logs.length : 0,
      levelDistribution: levelDist,
      serviceDistribution: serviceDist,
      timespan: timestamps.length >= 2
        ? { start: timestamps[0], end: timestamps[timestamps.length - 1] }
        : null,
    };
  }
}
