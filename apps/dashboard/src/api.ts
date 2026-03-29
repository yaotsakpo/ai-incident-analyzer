const BASE = '/api';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('auth-token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function request(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    headers: getAuthHeaders(),
    ...opts,
  });
  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (data: { username: string; password: string; displayName: string; email?: string }) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  updateProfile: (data: { displayName?: string; username?: string; onboardingComplete?: boolean }) =>
    request('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
  changePassword: (newPassword: string) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify({ newPassword }) }),
  resetUserPassword: (userId: string) =>
    request(`/auth/users/${userId}/reset-password`, { method: 'POST' }),
  createUser: (data: { username: string; displayName: string; role: string; email?: string; teamId?: string; permissions?: string[] }) =>
    request('/auth/users', { method: 'POST', body: JSON.stringify(data) }),
  listUsers: () => request('/auth/users'),
  deleteUser: (userId: string) => request(`/auth/users/${userId}`, { method: 'DELETE' }),
  updateUserRole: (userId: string, role: string, permissions?: string[]) =>
    request(`/auth/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role, permissions }) }),
  getOrgs: () => request('/auth/orgs'),
  switchOrg: (orgId: string) => request('/auth/switch-org', { method: 'POST', body: JSON.stringify({ orgId }) }),

  // Notifications
  listNotifications: () => request('/notifications'),
  markNotificationRead: (id: string) => request(`/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),

  // Incidents
  listIncidents: (teamFilter?: string) => request(`/incidents${teamFilter ? `?team=${teamFilter}` : ''}`),
  getIncident: (id: string) => request(`/incidents/${id}`),
  getIncidentStats: () => request('/incidents/stats'),
  updateIncidentStatus: (id: string, status: string) =>
    request(`/incidents/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  escalateIncident: (id: string) =>
    request(`/incidents/${id}/escalate`, { method: 'POST' }),
  completeRunbookStep: (id: string, stepOrder: number) =>
    request(`/incidents/${id}/runbook/step/${stepOrder}`, { method: 'POST' }),

  // Comments
  getComments: (id: string) => request(`/incidents/${id}/comments`),
  addComment: (id: string, author: string, text: string) =>
    request(`/incidents/${id}/comments`, { method: 'POST', body: JSON.stringify({ author, text }) }),

  // Team assignment
  assignTeam: (incidentId: string, teamId: string | null) =>
    request(`/incidents/${incidentId}/assign-team`, { method: 'POST', body: JSON.stringify({ teamId }) }),

  // Alert Groups
  getGroups: () => request('/incidents/groups'),

  // SLA Metrics
  getSLAMetrics: () => request('/incidents/sla'),

  // SSE Stream URL
  streamUrl: `${BASE}/incidents/stream`,

  // Runbooks
  listRunbooks: () => request('/runbooks'),
  getRunbook: (id: string) => request(`/runbooks/${id}`),
  createRunbook: (data: any) => request('/runbooks', { method: 'POST', body: JSON.stringify(data) }),
  deleteRunbook: (id: string) => request(`/runbooks/${id}`, { method: 'DELETE' }),

  // Analysis
  analyze: (data: any) =>
    request('/analyze', { method: 'POST', body: JSON.stringify(data) }),

  // Anomaly
  detectAnomalies: (data: any) =>
    request('/anomaly/detect', { method: 'POST', body: JSON.stringify(data) }),

  // Seed
  seed: () => request('/seed', { method: 'POST' }),

  // Health
  health: () => request('/health'),

  // Integration settings (admin-only)
  getIntegrationSettings: () => request('/settings/integrations'),
  updateIntegrationSettings: (data: any) =>
    request('/settings/integrations', { method: 'PUT', body: JSON.stringify(data) }),

  // User preferences (per-account)
  getPreferences: () => request('/settings/preferences'),
  updatePreferences: (data: any) =>
    request('/settings/preferences', { method: 'PUT', body: JSON.stringify(data) }),

  // Teams (admin manages, users see their own)
  listTeams: () => request('/teams'),
  getTeam: (id: string) => request(`/teams/${id}`),
  createTeam: (name: string, description: string) =>
    request('/teams', { method: 'POST', body: JSON.stringify({ name, description }) }),
  updateTeam: (id: string, data: { name?: string; description?: string }) =>
    request(`/teams/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTeam: (id: string) =>
    request(`/teams/${id}`, { method: 'DELETE' }),
  addTeamMember: (teamId: string, userId: string, role: string = 'member') =>
    request(`/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify({ userId, role }) }),
  removeTeamMember: (teamId: string, userId: string) =>
    request(`/teams/${teamId}/members/${userId}`, { method: 'DELETE' }),
  updateTeamMemberRole: (teamId: string, userId: string, role: string) =>
    request(`/teams/${teamId}/members/${userId}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  getTeamIntegrationOverrides: (teamId: string) =>
    request(`/teams/${teamId}/integration-overrides`),
  updateTeamIntegrationOverrides: (teamId: string, data: { slackChannel?: string; slackMentionGroup?: string; jiraProjectKey?: string; jiraIssueType?: string; opsgenieTeamName?: string; opsgeniePriority?: string; pagerdutyEscalationPolicyId?: string }) =>
    request(`/teams/${teamId}/integration-overrides`, { method: 'PUT', body: JSON.stringify(data) }),

  // Logs (observability)
  getLogs: () => request('/settings/integrations/logs'),

  // Audit log (admin-only)
  getAuditLog: (limit = 100, category?: string) =>
    request(`/audit-log?limit=${limit}${category ? `&category=${category}` : ''}`),
};
