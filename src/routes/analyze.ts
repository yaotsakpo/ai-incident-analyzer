import { Router, Request, Response } from 'express';
import { Analyzer } from '../services/analyzer';

export function analyzeRoutes(): Router {
  const router = Router();
  const analyzer = new Analyzer();

  router.post('/', (req: Request, res: Response) => {
    try {
      const { logs, errorMessages, context } = req.body;

      if (!logs && !errorMessages) {
        return res.status(400).json({
          error: 'Provide either "logs" (array of log entries) or "errorMessages" (array of strings)',
        });
      }

      const result = analyzer.analyze({ logs, errorMessages, context });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}
