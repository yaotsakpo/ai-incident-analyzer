import { Router, Request, Response } from 'express';
import { IncidentStore } from '../stores/incident-store';
import { UserStore } from '../stores/user-store';
import { PagerDutyService } from '../services/pagerduty';
import { NotificationStore } from '../stores/notification-store';
import { TeamStore } from '../stores/team-store';
import { sseEmitter } from '../services/event-emitter';
import { authMiddleware, requirePermission } from '../middleware/auth';

export function incidentRoutes(incidentStore: IncidentStore, userStore: UserStore, pagerduty: PagerDutyService, notificationStore: NotificationStore, teamStore: TeamStore): Router {
  const router = Router();
  const auth = authMiddleware(userStore);
  const canAck = [auth, requirePermission('incidents:acknowledge')];
  const canEscalate = [auth, requirePermission('incidents:escalate')];
  const canAssign = [auth, requirePermission('incidents:assign')];

  // SSE stream for real-time updates
  router.get('/stream', auth, (req: Request, res: Response) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);
    const clientId = sseEmitter.addClient(res);

    // Heartbeat every 30s
    const heartbeat = setInterval(() => {
      try { res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`); } catch { clearInterval(heartbeat); }
    }, 30000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseEmitter.removeClient(clientId);
    });
  });

  router.get('/', auth, requirePermission('incidents:view'), async (req: Request, res: Response) => {
    let incidents = await incidentStore.list(100, req.user!.orgId);

    // Team-scoped filtering: ?team=mine returns only incidents assigned to user's teams
    if (req.query.team === 'mine') {
      const userTeams = await teamStore.getTeamsForUser(req.user!.id, req.user!.orgId);
      const teamIds = new Set(userTeams.map(t => t.id));
      incidents = incidents.filter(inc => inc.assignedTeamId && teamIds.has(inc.assignedTeamId));
    } else if (typeof req.query.team === 'string' && req.query.team !== 'all') {
      // Filter by specific team ID
      incidents = incidents.filter(inc => inc.assignedTeamId === req.query.team);
    }

    return res.json({ count: incidents.length, incidents });
  });

  router.get('/stats', auth, requirePermission('incidents:view'), async (req: Request, res: Response) => {
    return res.json(await incidentStore.getStats(req.user!.orgId));
  });

  router.get('/sla', auth, requirePermission('incidents:view'), async (req: Request, res: Response) => {
    return res.json(await incidentStore.getSLAMetrics(req.user!.orgId));
  });

  router.get('/groups', auth, requirePermission('incidents:view'), async (req: Request, res: Response) => {
    return res.json(await incidentStore.getGroups(req.user!.orgId));
  });

  router.get('/:id', auth, requirePermission('incidents:view'), async (req: Request, res: Response) => {
    const incident = await incidentStore.get(req.params.id);
    if (!incident || (incident as any).orgId !== req.user!.orgId) return res.status(404).json({ error: 'Incident not found' });
    return res.json(incident);
  });

  router.patch('/:id/status', ...canAck, async (req: Request, res: Response) => {
    const { status } = req.body;
    if (!['open', 'acknowledged', 'investigating', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    // Verify org ownership before mutation
    const existing = await incidentStore.get(req.params.id);
    if (!existing || (existing as any).orgId !== req.user!.orgId) return res.status(404).json({ error: 'Incident not found' });
    const updated = await incidentStore.updateStatus(req.params.id, status);
    if (!updated) return res.status(404).json({ error: 'Incident not found' });

    // Sync to PagerDuty if linked
    if (updated.pagerduty) {
      if (status === 'acknowledged') pagerduty.acknowledgeIncident(updated.pagerduty.dedupKey);
      if (status === 'resolved') pagerduty.resolveIncident(updated.pagerduty.dedupKey);
    }

    // Notify all users about status change
    const allUsers = await userStore.listUsers(req.user!.orgId);
    const actor = req.user?.displayName || 'Someone';
    allUsers.filter(u => u.id !== req.user?.id).forEach(u => {
      notificationStore.create(req.user!.orgId, u.id, 'incident_status', `Incident ${status}`, `${actor} changed "${updated.title}" to ${status}`, `/incidents/${updated.id}`);
    });

    return res.json(updated);
  });

  router.post('/:id/escalate', ...canEscalate, async (req: Request, res: Response) => {
    const incident = await incidentStore.get(req.params.id);
    if (!incident || (incident as any).orgId !== req.user!.orgId) return res.status(404).json({ error: 'Incident not found' });
    if (incident.pagerduty) return res.status(400).json({ error: 'Already escalated to PagerDuty' });

    incident.pagerduty = await pagerduty.triggerIncident(incident);
    incident.updatedAt = new Date().toISOString();
    await incidentStore.save(incident);

    // Notify all users about escalation
    const usersForEsc = await userStore.listUsers(req.user!.orgId);
    const escActor = req.user?.displayName || 'Someone';
    usersForEsc.filter(u => u.id !== req.user?.id).forEach(u => {
      notificationStore.create(req.user!.orgId, u.id, 'escalated', 'Incident escalated', `${escActor} escalated "${incident.title}" to PagerDuty`, `/incidents/${incident.id}`);
    });

    return res.json(incident);
  });

  router.post('/:id/runbook/step/:stepOrder', ...canAck, async (req: Request, res: Response) => {
    const check = await incidentStore.get(req.params.id);
    if (!check || (check as any).orgId !== req.user!.orgId) return res.status(404).json({ error: 'Incident not found' });
    const stepOrder = parseInt(req.params.stepOrder);
    const updated = await incidentStore.completeRunbookStep(req.params.id, stepOrder);
    if (!updated) return res.status(404).json({ error: 'Incident or runbook not found' });
    return res.json(updated);
  });

  // --- Comments ---

  router.get('/:id/comments', auth, requirePermission('incidents:view'), async (req: Request, res: Response) => {
    const check = await incidentStore.get(req.params.id);
    if (!check || (check as any).orgId !== req.user!.orgId) return res.status(404).json({ error: 'Incident not found' });
    const comments = await incidentStore.getComments(req.params.id);
    return res.json({ comments });
  });

  router.post('/:id/comments', auth, requirePermission('incidents:view'), async (req: Request, res: Response) => {
    const { author, text } = req.body;
    if (!author || !text) return res.status(400).json({ error: 'author and text are required' });
    const checkInc = await incidentStore.get(req.params.id);
    if (!checkInc || (checkInc as any).orgId !== req.user!.orgId) return res.status(404).json({ error: 'Incident not found' });
    const comment = await incidentStore.addComment(req.params.id, author, text);
    if (!comment) return res.status(404).json({ error: 'Incident not found' });

    // Notify on @mentions
    const mentions = text.match(/@(\w+)/g);
    if (mentions) {
      const allUsersForMention = await userStore.listUsers(req.user!.orgId);
      for (const m of mentions) {
        const mentionedUsername = m.slice(1);
        const mentionedUser = allUsersForMention.find(u => u.username === mentionedUsername);
        if (mentionedUser && mentionedUser.id !== req.user?.id) {
          await notificationStore.create(req.user!.orgId, mentionedUser.id, 'mention', 'You were mentioned', `${author} mentioned you in a comment`, `/incidents/${req.params.id}`);
        }
      }
    }

    // Notify all other users about the comment
    const incident = await incidentStore.get(req.params.id);
    const commentUsers = await userStore.listUsers(req.user!.orgId);
    commentUsers.filter(u => u.id !== req.user?.id && !(mentions || []).some((m: string) => u.username === m.slice(1))).forEach(u => {
      notificationStore.create(req.user!.orgId, u.id, 'comment', 'New comment', `${author} commented on "${incident?.title || 'an incident'}"`, `/incidents/${req.params.id}`);
    });

    return res.status(201).json(comment);
  });

  // --- Team Assignment ---

  router.post('/:id/assign-team', ...canAssign, async (req: Request, res: Response) => {
    const { teamId } = req.body;
    const incident = await incidentStore.get(req.params.id);
    if (!incident || (incident as any).orgId !== req.user!.orgId) return res.status(404).json({ error: 'Incident not found' });

    if (teamId) {
      const team = await teamStore.get(teamId);
      if (!team || team.orgId !== req.user!.orgId) return res.status(404).json({ error: 'Team not found' });

      const updated = await incidentStore.assignTeam(req.params.id, team.id, team.name, req.user!.id, req.user!.displayName);
      if (!updated) return res.status(404).json({ error: 'Incident not found' });

      // Notify all team members
      const actor = req.user!.displayName || 'Someone';
      for (const member of team.members) {
        if (member.userId !== req.user!.id) {
          await notificationStore.create(req.user!.orgId, member.userId, 'assigned', `Team "${team.name}" tagged`, `${actor} tagged your team on "${updated.title}"`, `/incidents/${updated.id}`);
        }
      }

      return res.json(updated);
    } else {
      // Unassign team
      const updated = await incidentStore.assignTeam(req.params.id, null, null, req.user!.id, req.user!.displayName);
      if (!updated) return res.status(404).json({ error: 'Incident not found' });
      return res.json(updated);
    }
  });

  return router;
}
