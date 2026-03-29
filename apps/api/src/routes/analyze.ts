import { Router, Request, Response } from 'express';
import { Analyzer } from '../services/analyzer';
import { PagerDutyService } from '../services/pagerduty';
import { IncidentStore } from '../stores/incident-store';
import { RunbookStore } from '../stores/runbook-store';
import { UserStore } from '../stores/user-store';
import { v4 as uuidv4 } from 'uuid';
import { Incident } from '@incident-analyzer/shared';
import { authMiddleware, requirePermission } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { analyzeSchema } from '../schemas';

export function analyzeRoutes(
  incidentStore: IncidentStore,
  runbookStore: RunbookStore,
  userStore: UserStore,
  pagerduty: PagerDutyService,
): Router {
  const router = Router();
  const analyzer = new Analyzer();
  const auth = authMiddleware(userStore);

  router.post('/', auth, requirePermission('incidents:create'), validate(analyzeSchema), async (req: Request, res: Response) => {
    try {
      const { logs, errorMessages, context, service, title } = req.body;

      const result = analyzer.analyze({ logs, errorMessages, context });

      // Create incident from analysis
      const now = new Date().toISOString();
      const runbookMatch = await runbookStore.matchForIncident(
        result.rootCause.category,
        result.patterns.map((p) => p.name),
        req.user!.orgId,
      );

      const incident: any = {
        id: uuidv4(),
        orgId: req.user!.orgId,
        title: title || `${result.rootCause.category} — ${result.severity}`,
        analysis: result,
        status: 'open',
        source: 'api',
        service: service || (logs?.[0]?.service),
        runbook: runbookMatch ? {
          runbookId: runbookMatch.runbook.id,
          runbookName: runbookMatch.runbook.name,
          matchScore: runbookMatch.score,
          matchReason: runbookMatch.reason,
          completedSteps: [],
        } : undefined,
        createdAt: now,
        updatedAt: now,
      };

      // Auto-trigger PagerDuty if configured
      if (pagerduty.shouldAutoTrigger(result.severity)) {
        incident.pagerduty = await pagerduty.triggerIncident(incident);
      }

      await incidentStore.save(incident);

      res.json(incident);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}
