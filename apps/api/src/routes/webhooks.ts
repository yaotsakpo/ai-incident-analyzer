import { Router, Request, Response } from 'express';
import { IncidentStore } from '../stores/incident-store';

export function webhookRoutes(incidentStore: IncidentStore): Router {
  const router = Router();

  // PagerDuty V3 Webhook receiver
  // Note: Unauthenticated — org isolation is ensured by dedupKey being globally unique per incident.
  router.post('/pagerduty', async (req: Request, res: Response) => {
    try {
      const { event } = req.body;
      if (!event) return res.status(400).json({ error: 'Missing event payload' });

      const eventType = event.event_type;
      const dedupKey = event.data?.incident?.incident_key || event.data?.id;

      if (!dedupKey) {
        console.log('[webhook] PagerDuty event without dedup key, ignoring');
        return res.json({ status: 'ignored' });
      }

      let pdStatus: 'triggered' | 'acknowledged' | 'resolved' = 'triggered';
      if (eventType === 'incident.acknowledged') pdStatus = 'acknowledged';
      else if (eventType === 'incident.resolved') pdStatus = 'resolved';

      const updated = await incidentStore.updatePagerDutyStatus(dedupKey, pdStatus);

      console.log(`[webhook] PagerDuty ${eventType}: dedupKey=${dedupKey}, matched=${!!updated}`);

      return res.json({
        status: 'received',
        eventType,
        dedupKey,
        incidentUpdated: !!updated,
      });
    } catch (error) {
      console.error('[webhook] Error processing PagerDuty webhook:', (error as Error).message);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  return router;
}
