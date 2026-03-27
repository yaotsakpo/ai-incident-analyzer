import { Router, Request, Response } from 'express';
import { AnomalyDetector } from '../services/anomaly-detector';

export function anomalyRoutes(): Router {
  const router = Router();
  const detector = new AnomalyDetector();

  router.post('/detect', (req: Request, res: Response) => {
    try {
      const { logs, baseline } = req.body;

      if (!logs || !Array.isArray(logs) || logs.length === 0) {
        return res.status(400).json({
          error: 'Provide "logs" as a non-empty array of log entries',
        });
      }

      const result = detector.detect({ logs, baseline });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}
