export interface LogEntry {
  timestamp?: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  service?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AnalysisRequest {
  logs?: LogEntry[];
  errorMessages?: string[];
  context?: string;
}

export interface AnalysisResult {
  id: string;
  timestamp: string;
  summary: string;
  rootCause: RootCause;
  recommendations: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  patterns: Pattern[];
  analyzedLogs: number;
  processingTimeMs: number;
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

export interface AnomalyRequest {
  logs: LogEntry[];
  baseline?: {
    errorRateThreshold?: number;
    frequencyThreshold?: number;
  };
}

export interface AnomalyResult {
  id: string;
  timestamp: string;
  anomalies: Anomaly[];
  stats: LogStats;
  processingTimeMs: number;
}

export interface Anomaly {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
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
