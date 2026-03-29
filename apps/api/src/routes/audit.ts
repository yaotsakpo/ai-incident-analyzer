import { Router, Request, Response } from 'express';
import { AuditStore } from '../stores/audit-store';
import { UserStore } from '../stores/user-store';
import { authMiddleware, requirePermission } from '../middleware/auth';

export function auditRoutes(auditStore: AuditStore, userStore: UserStore): Router {
  const router = Router();
  const auth = authMiddleware(userStore);

  router.get('/', auth, requirePermission('audit:view'), async (req: Request, res: Response) => {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const category = req.query.category as string | undefined;
    const entries = await auditStore.list(req.user!.orgId, limit, category);
    return res.json({ entries });
  });

  return router;
}
