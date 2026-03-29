import { Router, Request, Response } from 'express';
import { UserStore } from '../stores/user-store';
import { TeamStore } from '../stores/team-store';
import { AuditStore } from '../stores/audit-store';
import { authMiddleware, requirePermission, requireOrgAdminOrTeamRole } from '../middleware/auth';

export function teamRoutes(teamStore: TeamStore, userStore: UserStore, auditStore?: AuditStore): Router {
  const router = Router();
  const auth = authMiddleware(userStore);
  const canManageTeams = [auth, requirePermission('teams:manage')];
  const teamAdminOrOrgAdmin = [auth, requireOrgAdminOrTeamRole(teamStore, 'owner', 'admin')];

  // GET /teams — list all teams (admin), or user's teams (non-admin)
  router.get('/', auth, requirePermission('teams:view'), async (req: Request, res: Response) => {
    if (req.user!.role === 'admin' || (req.user!.permissions && req.user!.permissions.includes('teams:manage'))) {
      return res.json({ teams: await teamStore.list(req.user!.orgId) });
    }
    return res.json({ teams: await teamStore.getTeamsForUser(req.user!.id, req.user!.orgId) });
  });

  // GET /teams/:id — get a single team
  router.get('/:id', auth, requirePermission('teams:view'), async (req: Request, res: Response) => {
    const team = await teamStore.get(req.params.id);
    if (!team || team.orgId !== req.user!.orgId) return res.status(404).json({ error: 'Team not found' });
    // Non-admins can only see their own teams
    if (req.user!.role !== 'admin' && !team.members.some(m => m.userId === req.user!.id)) {
      return res.status(403).json({ error: 'Not a member of this team' });
    }
    return res.json(team);
  });

  // POST /teams — create team (admin only)
  router.post('/', ...canManageTeams, async (req: Request, res: Response) => {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const team = await teamStore.create(name, description || '', req.user!.id, req.user!.orgId);
    if (auditStore) await auditStore.log(req.user!.orgId, req.user!.id, req.user!.username, 'team_created', 'team', `Created team "${name}"`, { teamId: team.id });
    return res.status(201).json(team);
  });

  // PUT /teams/:id — update team info (admin only)
  router.put('/:id', ...canManageTeams, async (req: Request, res: Response) => {
    const existing = await teamStore.get(req.params.id);
    if (!existing || existing.orgId !== req.user!.orgId) return res.status(404).json({ error: 'Team not found' });
    const { name, description } = req.body;
    const team = await teamStore.update(req.params.id, { name, description });
    if (!team) return res.status(404).json({ error: 'Team not found' });
    return res.json(team);
  });

  // DELETE /teams/:id — delete team (admin only)
  router.delete('/:id', ...canManageTeams, async (req: Request, res: Response) => {
    const team = await teamStore.get(req.params.id);
    if (!team || team.orgId !== req.user!.orgId) return res.status(404).json({ error: 'Team not found' });
    const deleted = await teamStore.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Team not found' });
    if (auditStore) await auditStore.log(req.user!.orgId, req.user!.id, req.user!.username, 'team_deleted', 'team', `Deleted team "${team?.name || req.params.id}"`, { teamId: req.params.id });
    return res.json({ deleted: true });
  });

  // POST /teams/:id/members — add member (org admin or team owner/admin)
  router.post('/:id/members', ...teamAdminOrOrgAdmin, async (req: Request, res: Response) => {
    const existingTeam = await teamStore.get(req.params.id);
    if (!existingTeam || existingTeam.orgId !== req.user!.orgId) return res.status(404).json({ error: 'Team not found' });
    const { userId, role } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const memberRole = role === 'admin' ? 'admin' : 'member';
    const team = await teamStore.addMember(req.params.id, userId, memberRole);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (auditStore) {
      const addedUser = await userStore.getUser(userId);
      await auditStore.log(req.user!.orgId, req.user!.id, req.user!.username, 'member_added', 'team', `Added ${addedUser?.displayName || userId} to "${team.name}"`, { teamId: req.params.id, addedUserId: userId });
    }
    return res.json(team);
  });

  // GET /teams/:id/integration-overrides — get team overrides
  router.get('/:id/integration-overrides', auth, requirePermission('integrations:view'), async (req: Request, res: Response) => {
    const team = await teamStore.get(req.params.id);
    if (!team || team.orgId !== req.user!.orgId) return res.status(404).json({ error: 'Team not found' });
    return res.json(team.integrationOverrides || {});
  });

  // PUT /teams/:id/integration-overrides — update team overrides (org admin or team owner/admin)
  router.put('/:id/integration-overrides', ...teamAdminOrOrgAdmin, async (req: Request, res: Response) => {
    const team = await teamStore.get(req.params.id);
    if (!team || team.orgId !== req.user!.orgId) return res.status(404).json({ error: 'Team not found' });
    const { slackChannel, slackMentionGroup, jiraProjectKey, jiraIssueType, opsgenieTeamName, opsgeniePriority, pagerdutyEscalationPolicyId } = req.body;
    const overrides: any = {};
    if (slackChannel !== undefined) overrides.slackChannel = slackChannel || undefined;
    if (slackMentionGroup !== undefined) overrides.slackMentionGroup = slackMentionGroup || undefined;
    if (jiraProjectKey !== undefined) overrides.jiraProjectKey = jiraProjectKey || undefined;
    if (jiraIssueType !== undefined) overrides.jiraIssueType = jiraIssueType || undefined;
    if (opsgenieTeamName !== undefined) overrides.opsgenieTeamName = opsgenieTeamName || undefined;
    if (opsgeniePriority !== undefined) overrides.opsgeniePriority = opsgeniePriority || undefined;
    if (pagerdutyEscalationPolicyId !== undefined) overrides.pagerdutyEscalationPolicyId = pagerdutyEscalationPolicyId || undefined;
    const updated = await teamStore.updateIntegrationOverrides(req.params.id, overrides);
    if (!updated) return res.status(404).json({ error: 'Team not found' });
    if (auditStore) await auditStore.log(req.user!.orgId, req.user!.id, req.user!.username, 'integration_updated', 'team', `Updated integration overrides for team "${team.name}"`, { teamId: req.params.id, overrides });
    return res.json(updated.integrationOverrides || {});
  });

  // PATCH /teams/:id/members/:userId — update member role (org admin or team owner/admin)
  router.patch('/:id/members/:userId', ...teamAdminOrOrgAdmin, async (req: Request, res: Response) => {
    const existingTeam = await teamStore.get(req.params.id);
    if (!existingTeam || existingTeam.orgId !== req.user!.orgId) return res.status(404).json({ error: 'Team not found' });
    const { role } = req.body;
    if (!role || !['owner', 'admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'role must be owner, admin, or member' });
    }
    const team = await teamStore.updateMemberRole(req.params.id, req.params.userId, role);
    if (!team) return res.status(404).json({ error: 'Team or member not found' });
    if (auditStore) {
      const targetUser = await userStore.getUser(req.params.userId);
      await auditStore.log(req.user!.orgId, req.user!.id, req.user!.username, 'member_role_updated', 'team', `Changed ${targetUser?.displayName || req.params.userId} role to ${role} in "${team.name}"`, { teamId: req.params.id, userId: req.params.userId, newRole: role });
    }
    return res.json(team);
  });

  // DELETE /teams/:id/members/:userId — remove member (org admin or team owner/admin)
  router.delete('/:id/members/:userId', ...teamAdminOrOrgAdmin, async (req: Request, res: Response) => {
    const existingTeam = await teamStore.get(req.params.id);
    if (!existingTeam || existingTeam.orgId !== req.user!.orgId) return res.status(404).json({ error: 'Team not found' });
    const removedUser = await userStore.getUser(req.params.userId);
    const team = await teamStore.removeMember(req.params.id, req.params.userId);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (auditStore) await auditStore.log(req.user!.orgId, req.user!.id, req.user!.username, 'member_removed', 'team', `Removed ${removedUser?.displayName || req.params.userId} from "${team.name}"`, { teamId: req.params.id, removedUserId: req.params.userId });
    return res.json(team);
  });

  return router;
}
