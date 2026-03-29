import { Router, Request, Response } from 'express';
import { UserStore } from '../stores/user-store';
import { OrganizationModel } from '../db/models';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { isConnected } from '../db/connection';

export function orgRoutes(userStore: UserStore): Router {
  const router = Router();
  const auth = authMiddleware(userStore);

  // GET /org — get current user's organization
  router.get('/', auth, async (req: Request, res: Response) => {
    const orgId = req.user!.orgId;
    if (isConnected()) {
      const doc = await OrganizationModel.findOne({ id: orgId }).lean();
      if (doc) {
        const { _id, __v, ...org } = doc as any;
        return res.json(org);
      }
    }
    // Fallback for in-memory (demo org)
    return res.json({ id: orgId, name: `Organization`, createdAt: new Date().toISOString() });
  });

  // PATCH /org — rename organization (admin only)
  router.patch('/', auth, requirePermission('settings:manage'), async (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const orgId = req.user!.orgId;
    if (isConnected()) {
      const doc = await OrganizationModel.findOneAndUpdate(
        { id: orgId },
        { name: name.trim() },
        { returnDocument: 'after' }
      ).lean();
      if (doc) {
        const { _id, __v, ...org } = doc as any;
        return res.json(org);
      }
    }
    return res.json({ id: orgId, name: name.trim() });
  });

  return router;
}
