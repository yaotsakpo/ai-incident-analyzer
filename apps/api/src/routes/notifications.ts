import { Router, Request, Response } from 'express';
import { NotificationStore } from '../stores/notification-store';
import { UserStore } from '../stores/user-store';
import { authMiddleware } from '../middleware/auth';

export function notificationRoutes(notificationStore: NotificationStore, userStore: UserStore): Router {
  const router = Router();
  const auth = authMiddleware(userStore);

  router.get('/', auth, async (req: Request, res: Response) => {
    const notifications = await notificationStore.listForUser(req.user!.id, req.user!.orgId);
    const unreadCount = await notificationStore.unreadCount(req.user!.id, req.user!.orgId);
    return res.json({ notifications, unreadCount });
  });

  router.post('/read-all', auth, async (req: Request, res: Response) => {
    await notificationStore.markAllRead(req.user!.id);
    return res.json({ message: 'All marked as read' });
  });

  router.post('/:id/read', auth, async (req: Request, res: Response) => {
    await notificationStore.markRead(req.params.id, req.user!.id);
    return res.json({ message: 'Marked as read' });
  });

  return router;
}
