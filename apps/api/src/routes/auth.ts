import { Router, Request, Response } from 'express';
import { UserStore } from '../stores/user-store';
import { TeamStore } from '../stores/team-store';
import { AuditStore } from '../stores/audit-store';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { loginSchema, registerSchema, createUserSchema, updateUserRoleSchema, changePasswordSchema, switchOrgSchema } from '../schemas';
import { UserRole } from '@incident-analyzer/shared';

export function authRoutes(userStore: UserStore, teamStore?: TeamStore, auditStore?: AuditStore): Router {
  const router = Router();
  const auth = authMiddleware(userStore);

  router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
    const { username, password, displayName, email } = req.body;
    const user = await userStore.register({ username, password, displayName, email });
    if (!user) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    // Auto-login after registration
    const result = await userStore.authenticate(username, password);
    return res.status(201).json(result);
  });

  router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
    const { username, password } = req.body;
    const result = await userStore.authenticate(username, password);
    if (!result) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    // Include mustChangePassword flag in response
    return res.json({
      ...result,
      mustChangePassword: !!result.user.mustChangePassword,
      onboardingComplete: !!result.user.onboardingComplete,
    });
  });

  router.post('/logout', (req: Request, res: Response) => {
    const header = req.headers.authorization;
    const { refreshToken } = req.body || {};
    if (header?.startsWith('Bearer ')) {
      userStore.logout(header.slice(7), refreshToken);
    }
    return res.json({ message: 'Logged out' });
  });

  router.post('/refresh', async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken is required' });
    }
    const result = await userStore.refreshAccessToken(refreshToken);
    if (!result) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    return res.json(result);
  });

  router.get('/me', auth, (req: Request, res: Response) => {
    return res.json(req.user);
  });

  router.patch('/me', auth, async (req: Request, res: Response) => {
    const { displayName, username, onboardingComplete } = req.body;
    if (!displayName && !username && onboardingComplete === undefined) {
      return res.status(400).json({ error: 'At least one field is required' });
    }

    const profileData: { displayName?: string; username?: string; onboardingComplete?: boolean } = {};
    if (onboardingComplete !== undefined) profileData.onboardingComplete = !!onboardingComplete;
    if (displayName && typeof displayName === 'string' && displayName.trim()) {
      profileData.displayName = displayName.trim();
    }
    if (username && typeof username === 'string' && username.trim()) {
      const trimmed = username.trim().toLowerCase();
      if (trimmed.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
      if (!/^[a-z0-9_]+$/.test(trimmed)) return res.status(400).json({ error: 'Username can only contain lowercase letters, numbers, and underscores' });

      profileData.username = trimmed;
    }

    const updated = await userStore.updateProfile(req.user!.id, profileData);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    if ((updated as any).__usernameTaken) return res.status(409).json({ error: 'Username already taken' });
    return res.json(updated);
  });

  router.post('/change-password', auth, validate(changePasswordSchema), async (req: Request, res: Response) => {
    const { newPassword } = req.body;
    const ok = await userStore.changePassword(req.user!.id, newPassword);
    if (!ok) return res.status(404).json({ error: 'User not found' });
    return res.json({ message: 'Password changed successfully' });
  });

  router.post('/users/:id/reset-password', auth, requirePermission('users:manage'), async (req: Request, res: Response) => {
    const targetUser = await userStore.getUser(req.params.id);
    const tempPassword = await userStore.resetPassword(req.params.id);
    if (!tempPassword) return res.status(404).json({ error: 'User not found' });
    if (auditStore) await auditStore.log(req.user!.orgId, req.user!.id, req.user!.username, 'password_reset', 'user', `Reset password for ${targetUser?.displayName || req.params.id}`, { targetUserId: req.params.id });
    return res.json({ tempPassword });
  });

  router.post('/users', auth, requirePermission('users:manage'), validate(createUserSchema), async (req: Request, res: Response) => {
    const { username, displayName, role, email, teamId, permissions } = req.body;

    // Generate a random initial password
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let initialPassword = '';
    for (let i = 0; i < 10; i++) initialPassword += chars[Math.floor(Math.random() * chars.length)];

    const newUser = await userStore.createUser({ username, password: initialPassword, displayName, role: role as UserRole, email, orgId: req.user!.orgId, permissions });
    if (!newUser) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // Auto-add to team if teamId provided
    if (teamId && teamStore) {
      try { await teamStore.addMember(teamId, newUser.id, 'member'); } catch {}
    }

    // Create org membership for the new user (P6: multi-org tracking)
    try { await userStore.addOrgMembership(newUser.id, req.user!.orgId, role as any); } catch {}

    if (auditStore) await auditStore.log(req.user!.orgId, req.user!.id, req.user!.username, 'user_created', 'user', `Created user "${displayName}" (@${username}) as ${role}`, { newUserId: newUser.id, role, teamId });
    return res.status(201).json({ user: newUser, initialPassword });
  });

  router.patch('/users/:id/role', auth, requirePermission('users:manage'), validate(updateUserRoleSchema), async (req: Request, res: Response) => {
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }
    const target = await userStore.getUser(req.params.id);
    if (!target || target.orgId !== req.user!.orgId) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { role, permissions } = req.body;
    const updated = await userStore.updateUserRole(req.params.id, role as UserRole, role === 'custom' ? permissions : undefined);
    if (!updated) return res.status(404).json({ error: 'User not found' });
    if (auditStore) await auditStore.log(req.user!.orgId, req.user!.id, req.user!.username, 'user_role_updated', 'user', `Changed ${target.displayName} role from ${target.role} to ${role}`, { targetUserId: req.params.id, oldRole: target.role, newRole: role });
    return res.json(updated);
  });

  router.delete('/users/:id', auth, requirePermission('users:manage'), async (req: Request, res: Response) => {
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    // Verify user belongs to the same org
    const target = await userStore.getUser(req.params.id);
    if (!target || target.orgId !== req.user!.orgId) {
      return res.status(404).json({ error: 'User not found' });
    }
    // Remove user from all teams in the org
    if (teamStore) {
      const userTeams = await teamStore.getTeamsForUser(req.params.id, req.user!.orgId);
      for (const t of userTeams) {
        await teamStore.removeMember(t.id, req.params.id);
      }
    }
    const deleted = await userStore.deleteUser(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    // Also remove org membership
    try { await userStore.removeOrgMembership(req.params.id, req.user!.orgId); } catch {}
    if (auditStore) await auditStore.log(req.user!.orgId, req.user!.id, req.user!.username, 'user_deleted', 'user', `Deleted user "${target.displayName}" (@${target.username})`, { deletedUserId: req.params.id });
    return res.json({ message: 'User deleted' });
  });

  router.get('/users', auth, requirePermission('users:view'), async (req: Request, res: Response) => {
    return res.json(await userStore.listUsers(req.user!.orgId));
  });

  // --- Multi-org endpoints ---

  // GET /auth/orgs — list orgs the current user belongs to
  router.get('/orgs', auth, async (req: Request, res: Response) => {
    const memberships = await userStore.getOrgMemberships(req.user!.id);
    // If no memberships found (legacy data), return current org
    if (memberships.length === 0) {
      return res.json({ orgs: [{ orgId: req.user!.orgId, orgName: 'Current Org', role: req.user!.role, active: true }] });
    }
    return res.json({
      orgs: memberships.map(m => ({ ...m, active: m.orgId === req.user!.orgId })),
    });
  });

  // POST /auth/switch-org — switch active org
  router.post('/switch-org', auth, async (req: Request, res: Response) => {
    const { orgId } = req.body;
    if (!orgId) return res.status(400).json({ error: 'orgId is required' });
    const result = await userStore.switchOrg(req.user!.id, orgId);
    if (!result) return res.status(403).json({ error: 'Not a member of that organization' });
    return res.json(result);
  });

  return router;
}
