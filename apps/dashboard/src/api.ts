import type {
  Incident,
  User,
  Runbook,
  Comment,
  IncidentStatus,
  Permission,
  UserRole,
  AnalysisRequest,
  AnomalyRequest,
  IntegrationSettings,
  TeamIntegrationOverrides,
} from '@incident-analyzer/shared';
import type {
  LoginResponse,
  RegisterResponse,
  MeResponse,
  ListUsersResponse,
  CreateUserResponse,
  ResetPasswordResponse,
  OrgsResponse,
  SwitchOrgResponse,
  ListIncidentsResponse,
  IncidentStatsResponse,
  ListRunbooksResponse,
  ListNotificationsResponse,
  ListTeamsResponse,
  Team,
  AuditLogResponse,
  SeedResponse,
  HealthResponse,
  UserPreferences,
  AlertGroup,
} from './types';

const BASE = import.meta.env.VITE_API_URL || '/api';
console.log('API BASE URL:', BASE, 'VITE_API_URL:', import.meta.env.VITE_API_URL);

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth-token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refresh-token');
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.token && data.refreshToken) {
      localStorage.setItem('auth-token', data.token);
      localStorage.setItem('refresh-token', data.refreshToken);
      return true;
    }
    return false;
  } catch { return false; }
}

async function request<T = unknown>(path: string, opts?: RequestInit): Promise<T & { error?: string }> {
  const res = await fetch(`${BASE}${path}`, {
    headers: getAuthHeaders(),
    ...opts,
  });

  // On 401, try to refresh the access token once
  if (res.status === 401 && !path.includes('/auth/refresh') && !path.includes('/auth/login')) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = tryRefreshToken().finally(() => { isRefreshing = false; });
    }
    const refreshed = await refreshPromise;
    if (refreshed) {
      // Retry the original request with the new token
      const retryRes = await fetch(`${BASE}${path}`, {
        headers: getAuthHeaders(),
        ...opts,
      });
      return retryRes.json() as Promise<T & { error?: string }>;
    }
    // Refresh failed — clear tokens and force re-login
    localStorage.removeItem('auth-token');
    localStorage.removeItem('refresh-token');
    window.dispatchEvent(new Event('auth-expired'));
  }

  return res.json() as Promise<T & { error?: string }>;
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (data: { username: string; password: string; displayName: string; email?: string }) =>
    request<RegisterResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => {
    const refreshToken = localStorage.getItem('refresh-token');
    localStorage.removeItem('refresh-token');
    return request('/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
  },
  me: () => request<MeResponse>('/auth/me'),
  updateProfile: (data: { displayName?: string; username?: string; onboardingComplete?: boolean }) =>
    request<User>('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
  changePassword: (newPassword: string) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify({ newPassword }) }),
  resetUserPassword: (userId: string) =>
    request<ResetPasswordResponse>(`/auth/users/${userId}/reset-password`, { method: 'POST' }),
  createUser: (data: { username: string; displayName: string; role: string; email?: string; teamId?: string; permissions?: string[] }) =>
    request<CreateUserResponse>('/auth/users', { method: 'POST', body: JSON.stringify(data) }),
  listUsers: () => request<ListUsersResponse>('/auth/users'),
  deleteUser: (userId: string) => request(`/auth/users/${userId}`, { method: 'DELETE' }),
  updateUserRole: (userId: string, role: string, permissions?: string[]) =>
    request<User>(`/auth/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role, permissions }) }),
  getOrgs: () => request<OrgsResponse>('/auth/orgs'),
  switchOrg: (orgId: string) => request<SwitchOrgResponse>('/auth/switch-org', { method: 'POST', body: JSON.stringify({ orgId }) }),

  // Notifications
  listNotifications: () => request<ListNotificationsResponse>('/notifications'),
  markNotificationRead: (id: string) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),

  // Incidents
  listIncidents: (teamFilter?: string) => request<ListIncidentsResponse>(`/incidents${teamFilter ? `?team=${teamFilter}` : ''}`),
  getIncident: (id: string) => request<Incident>(`/incidents/${id}`),
  getIncidentStats: () => request<IncidentStatsResponse>('/incidents/stats'),
  updateIncidentStatus: (id: string, status: IncidentStatus) =>
    request<Incident>(`/incidents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  escalateIncident: (id: string) =>
    request<Incident>(`/incidents/${id}/escalate`, { method: 'POST' }),
  completeRunbookStep: (id: string, stepOrder: number) =>
    request(`/incidents/${id}/runbook/step/${stepOrder}`, { method: 'POST' }),

  // Comments
  getComments: (id: string) => request<{ comments: Comment[] }>(`/incidents/${id}/comments`),
  addComment: (id: string, author: string, text: string) =>
    request<Comment>(`/incidents/${id}/comments`, { method: 'POST', body: JSON.stringify({ author, text }) }),

  // Team assignment
  assignTeam: (incidentId: string, teamId: string | null) =>
    request<Incident>(`/incidents/${incidentId}/assign-team`, { method: 'POST', body: JSON.stringify({ teamId }) }),

  // Alert Groups
  getGroups: () => request<{ groups: AlertGroup[] }>('/incidents/groups'),

  // SLA Metrics
  getSLAMetrics: () => request<{ sla: import('@incident-analyzer/shared').SLAMetrics }>('/incidents/sla'),

  // SSE Stream URL
  streamUrl: `${BASE}/incidents/stream`,

  // Runbooks
  listRunbooks: () => request<ListRunbooksResponse>('/runbooks'),
  getRunbook: (id: string) => request<Runbook>(`/runbooks/${id}`),
  createRunbook: (data: Partial<Runbook>) => request<Runbook>('/runbooks', { method: 'POST', body: JSON.stringify(data) }),
  deleteRunbook: (id: string) => request(`/runbooks/${id}`, { method: 'DELETE' }),

  // Analysis
  analyze: (data: AnalysisRequest) =>
    request<Incident>('/analyze', { method: 'POST', body: JSON.stringify(data) }),

  // Anomaly
  detectAnomalies: (data: AnomalyRequest) =>
    request<import('@incident-analyzer/shared').AnomalyResult>('/anomaly/detect', { method: 'POST', body: JSON.stringify(data) }),

  // Seed
  seed: () => request<SeedResponse>('/seed', { method: 'POST' }),

  // Health
  health: () => request<HealthResponse>('/health'),

  // Integration settings (admin-only)
  getIntegrationSettings: () => request<IntegrationSettings>('/settings/integrations'),
  updateIntegrationSettings: (data: Partial<IntegrationSettings>) =>
    request<IntegrationSettings>('/settings/integrations', { method: 'PUT', body: JSON.stringify(data) }),

  // User preferences (per-account)
  getPreferences: () => request<UserPreferences>('/settings/preferences'),
  updatePreferences: (data: Partial<UserPreferences>) =>
    request<UserPreferences>('/settings/preferences', { method: 'PUT', body: JSON.stringify(data) }),

  // Teams (admin manages, users see their own)
  listTeams: () => request<ListTeamsResponse>('/teams'),
  getTeam: (id: string) => request<Team>(`/teams/${id}`),
  createTeam: (name: string, description: string) =>
    request<Team>('/teams', { method: 'POST', body: JSON.stringify({ name, description }) }),
  updateTeam: (id: string, data: { name?: string; description?: string }) =>
    request<Team>(`/teams/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTeam: (id: string) =>
    request(`/teams/${id}`, { method: 'DELETE' }),
  addTeamMember: (teamId: string, userId: string, role: string = 'member') =>
    request<Team>(`/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify({ userId, role }) }),
  removeTeamMember: (teamId: string, userId: string) =>
    request(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' }),
  updateTeamMemberRole: (teamId: string, userId: string, role: string) =>
    request(`/teams/${teamId}/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  getTeamIntegrationOverrides: (teamId: string) =>
    request<TeamIntegrationOverrides>(`/teams/${teamId}/integration-overrides`),
  updateTeamIntegrationOverrides: (teamId: string, data: Partial<TeamIntegrationOverrides>) =>
    request<TeamIntegrationOverrides>(`/teams/${teamId}/integration-overrides`, { method: 'PUT', body: JSON.stringify(data) }),

  // Logs (observability)
  getLogs: () => request('/settings/integrations/logs'),

  // Audit log (admin-only)
  getAuditLog: (limit = 100, category?: string) =>
    request<AuditLogResponse>(`/audit-log?limit=${limit}${category ? `&category=${category}` : ''}`),
};
