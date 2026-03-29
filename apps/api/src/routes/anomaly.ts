import { Router, Request, Response } from 'express';
import { AnomalyDetector } from '../services/anomaly-detector';
import { UserStore } from '../stores/user-store';
import { authMiddleware } from '../middleware/auth';

export function anomalyRoutes(userStore: UserStore): Router {
  const router = Router();
  const detector = new AnomalyDetector();
  const auth = authMiddleware(userStore);

  router.post('/detect', auth, (req: Request, res: Response) => {
    try {
      const { logs, baseline } = req.body;

      if (!logs || !Array.isArray(logs) || logs.length === 0) {
        return res.status(400).json({
          error: 'Provide "logs" as a non-empty array of log entries',
        });
      }

      const result = detector.detect({ logs, baseline });
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}
