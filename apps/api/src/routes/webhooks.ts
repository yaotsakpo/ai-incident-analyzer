import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { IncidentStore } from '../stores/incident-store';
import { logger } from '../services/logger';

export function verifyPagerDutySignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string | undefined
): boolean {
  // No secret configured → skip validation (opt-in security)
  if (!secret) return true;
  if (!signatureHeader) return false;
  // Header format: "v1=<hex_hmac>"
  if (!signatureHeader.startsWith('v1=')) return false;
  const expected = 'v1=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function webhookRoutes(incidentStore: IncidentStore, webhookSecret?: string): Router {
  const router = Router();

  // PagerDuty V3 Webhook receiver
  router.post('/pagerduty', async (req: Request, res: Response) => {
    try {
      const rawBody = JSON.stringify(req.body);
      const sig = req.headers['x-pagerduty-signature'] as string | undefined;

      if (!verifyPagerDutySignature(rawBody, sig, webhookSecret)) {
        logger.warn('[webhook] PagerDuty signature validation failed');
        return res.status(401).json({ error: 'Invalid webhook signature' });
      }

      const { event } = req.body;
      if (!event) return res.status(400).json({ error: 'Missing event payload' });

      const eventType = event.event_type;
      const dedupKey = event.data?.incident?.incident_key || event.data?.id;

      if (!dedupKey) {
        logger.debug('[webhook] PagerDuty event without dedup key, ignoring');
        return res.json({ status: 'ignored' });
      }

      let pdStatus: 'triggered' | 'acknowledged' | 'resolved' = 'triggered';
      if (eventType === 'incident.acknowledged') pdStatus = 'acknowledged';
      else if (eventType === 'incident.resolved') pdStatus = 'resolved';

      const updated = await incidentStore.updatePagerDutyStatus(dedupKey, pdStatus);
      logger.debug(`[webhook] PagerDuty ${eventType}: dedupKey=${dedupKey}, matched=${!!updated}`);

      return res.json({ status: 'received', eventType, dedupKey, incidentUpdated: !!updated });
    } catch (error) {
      logger.error('[webhook] Error processing PagerDuty webhook:', (error as Error).message);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  return router;
}
