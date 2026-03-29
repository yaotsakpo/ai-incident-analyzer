import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { RunbookStore } from '../stores/runbook-store';
import { UserStore } from '../stores/user-store';
import { Runbook } from '@incident-analyzer/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';

export function runbookRoutes(runbookStore: RunbookStore, userStore: UserStore): Router {
  const router = Router();
  const auth = authMiddleware(userStore);
  const canManageRunbooks = [auth, requirePermission('runbooks:manage')];

  router.get('/', auth, requirePermission('runbooks:view'), async (req: Request, res: Response) => {
    return res.json({ runbooks: await runbookStore.list(req.user!.orgId) });
  });

  router.get('/:id', auth, requirePermission('runbooks:view'), async (req: Request, res: Response) => {
    const rb = await runbookStore.get(req.params.id);
    if (!rb || (rb as any).orgId !== req.user!.orgId) return res.status(404).json({ error: 'Runbook not found' });
    return res.json(rb);
  });

  router.post('/', ...canManageRunbooks, async (req: Request, res: Response) => {
    const { name, description, category, tags, steps, estimatedTimeMinutes } = req.body;
    if (!name || !category || !steps?.length) {
      return res.status(400).json({ error: 'name, category, and steps are required' });
    }
    const runbook: any = {
      id: uuidv4(),
      orgId: req.user!.orgId,
      name,
      description: description || '',
      category,
      tags: tags || [],
      steps: steps.map((s: any, i: number) => ({
        order: i,
        title: s.title,
        description: s.description || '',
        command: s.command,
        expectedOutcome: s.expectedOutcome,
        isAutomatable: s.isAutomatable || false,
      })),
      estimatedTimeMinutes: estimatedTimeMinutes || 15,
      lastUpdated: new Date().toISOString(),
    };
    await runbookStore.save(runbook);
    return res.status(201).json(runbook);
  });

  router.delete('/:id', ...canManageRunbooks, async (req: Request, res: Response) => {
    const rb = await runbookStore.get(req.params.id);
    if (!rb || (rb as any).orgId !== req.user!.orgId) return res.status(404).json({ error: 'Runbook not found' });
    const deleted = await runbookStore.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Runbook not found' });
    return res.json({ deleted: true });
  });

  router.get('/match/:category', auth, requirePermission('runbooks:view'), async (req: Request, res: Response) => {
    const rb = await runbookStore.findByCategory(req.params.category, req.user!.orgId);
    if (!rb) return res.json({ match: null });
    return res.json({ match: rb });
  });

  return router;
}
