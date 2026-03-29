// Re-export shared types for convenience
export type {
  Incident,
  AnalysisResult,
  RootCause,
  Pattern,
  Comment,
  AuditEntry,
  User,
  UserRole,
  Permission,
  Runbook,
  RunbookStep,
  RunbookMatch,
  Severity,
  IncidentStatus,
  IncidentSource,
  PagerDutyLink,
  IntegrationSettings,
  SlackConfig,
  JiraConfig,
  OpsGenieConfig,
  AIProviderConfig,
  PagerDutyConfig,
  TeamIntegrationOverrides,
  SLAMetrics,
  AlertGroup,
  SSEEvent,
  AnalysisRequest,
  AnomalyRequest,
  AnomalyResult,
} from '@incident-analyzer/shared';

// --- API Response wrappers ---

import type {
  Incident,
  User,
  Runbook,
  Comment,
  SLAMetrics,
  AlertGroup,
  IntegrationSettings,
  TeamIntegrationOverrides,
  Permission,
  UserRole,
} from '@incident-analyzer/shared';

export interface ApiError {
  error: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterResponse {
  token: string;
  user: User;
}

export interface MeResponse extends User {}

export interface ListUsersResponse {
  users: User[];
}

export interface CreateUserResponse extends User {
  initialPassword: string;
}

export interface ResetPasswordResponse {
  newPassword?: string;
  tempPassword?: string;
}

export interface OrgsResponse {
  orgs: { orgId: string; orgName: string; role: UserRole }[];
}

export interface SwitchOrgResponse {
  token: string;
  user: User;
}

export interface ListIncidentsResponse {
  incidents: Incident[];
}

export interface IncidentStatsResponse {
  total: number;
  bySeverity: Record<string, number>;
  byStatus: Record<string, number>;
}

export interface CommentsResponse {
  comments: Comment[];
}

export interface ListRunbooksResponse {
  runbooks: Runbook[];
}

export interface ListNotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
}

export interface Notification {
  id: string;
  orgId: string;
  userId: string;
  type: 'incident_created' | 'incident_status' | 'mention' | 'assigned' | 'escalated' | 'comment';
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  orgId: string;
  members: TeamMember[];
  createdAt: string;
}

export interface TeamMember {
  userId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

export interface ListTeamsResponse {
  teams: Team[];
}

export interface AuditLogEntry {
  id: string;
  orgId: string;
  userId: string;
  username: string;
  action: string;
  resourceType: string;
  details: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
}

export interface SeedResponse {
  message: string;
  incidents: number;
  runbooks: number;
  teams: number;
}

export interface HealthResponse {
  service: string;
  status: string;
  mongodb: string;
  pagerduty: string;
  slack: string;
  jira: string;
  opsgenie: string;
  ai: string;
  uptime: number;
}

export interface UserPreferences {
  theme?: 'dark' | 'light' | 'system';
  autoRefreshInterval?: number;
  notifyOnCritical?: boolean;
  defaultSeverityFilter?: string;
  compactMode?: boolean;
}
