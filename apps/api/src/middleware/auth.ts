import { Request, Response, NextFunction } from 'express';
import { UserStore } from '../stores/user-store';
import { TeamStore } from '../stores/team-store';
import { User, UserRole, Permission, hasPermission } from '@incident-analyzer/shared';

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function authMiddleware(userStore: UserStore) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = header.slice(7);
    // Try sync first (fast path), fall back to async DB lookup
    let user = userStore.validateToken(token);
    if (!user) {
      user = await userStore.validateTokenAsync(token);
    }
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  };
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/**
 * Middleware that checks if the user has a specific permission.
 * Works with built-in roles (viewer/responder/admin) and custom roles.
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const allowed = permissions.some(p => hasPermission(req.user!.role, p, req.user!.permissions));
    if (!allowed) {
      return res.status(403).json({ error: `Missing permission: ${permissions.join(' or ')}` });
    }
    next();
  };
}

/**
 * Middleware that allows access if user is org admin OR has a specific role
 * within the team identified by req.params.id (owner or admin).
 */
export function requireOrgAdminOrTeamRole(teamStore: TeamStore, ...teamRoles: ('owner' | 'admin')[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    // Org admins always pass
    if (req.user.role === 'admin') return next();

    const teamId = req.params.id;
    if (!teamId) return res.status(400).json({ error: 'Team ID required' });

    const team = await teamStore.get(teamId);
    if (!team || team.orgId !== req.user.orgId) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const membership = team.members.find(m => m.userId === req.user!.id);
    if (membership && teamRoles.includes(membership.role as any)) {
      return next();
    }

    return res.status(403).json({ error: 'Insufficient permissions — requires org admin or team owner/admin' });
  };
}
