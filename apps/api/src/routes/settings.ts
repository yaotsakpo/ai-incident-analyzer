import { Router, Request, Response, NextFunction } from 'express';
import { SettingsStore } from '../stores/settings-store';
import { UserStore } from '../stores/user-store';
import { SlackService, JiraService, OpsGenieService } from '../services/integrations';
import { AIProviderService } from '../services/ai-provider';
import { PagerDutyService } from '../services/pagerduty';
import { logger } from '../services/logger';
import { AuditStore } from '../stores/audit-store';
import { authMiddleware, requirePermission } from '../middleware/auth';

export function settingsRoutes(
  settingsStore: SettingsStore,
  userStore: UserStore,
  slack: SlackService,
  jira: JiraService,
  opsgenie: OpsGenieService,
  aiProvider: AIProviderService,
  pagerduty: PagerDutyService,
  auditStore?: AuditStore,
): Router {
  const router = Router();
  const auth = authMiddleware(userStore);

  // All integration routes require integrations or settings permissions
  router.use(auth);

  router.get('/', requirePermission('integrations:view'), async (req: Request, res: Response) => {
    const settings = await settingsStore.get(req.user!.orgId);
    // Mask sensitive keys
    const masked = JSON.parse(JSON.stringify(settings));
    if (masked.slack?.webhookUrl) masked.slack.webhookUrl = masked.slack.webhookUrl.slice(0, 20) + '...';
    if (masked.jira?.apiToken) masked.jira.apiToken = '***';
    if (masked.opsgenie?.apiKey) masked.opsgenie.apiKey = '***';
    if (masked.ai?.apiKey) masked.ai.apiKey = masked.ai.apiKey.slice(0, 8) + '...';
    if (masked.pagerduty?.routingKey) masked.pagerduty.routingKey = '***';
    return res.json(masked);
  });

  router.put('/', requirePermission('settings:manage'), async (req: Request, res: Response) => {
    const body = req.body;
    const actor = req.user!;
    const changed: string[] = [];

    // Apply integrations
    if (body.slack) {
      await settingsStore.update(actor.orgId, { slack: body.slack });
      slack.configure(body.slack);
      changed.push('Slack');
      logger.info('Slack integration updated');
    }
    if (body.jira) {
      await settingsStore.update(actor.orgId, { jira: body.jira });
      jira.configure(body.jira);
      changed.push('Jira');
      logger.info('Jira integration updated');
    }
    if (body.opsgenie) {
      await settingsStore.update(actor.orgId, { opsgenie: body.opsgenie });
      opsgenie.configure(body.opsgenie);
      changed.push('OpsGenie');
      logger.info('OpsGenie integration updated');
    }
    if (body.ai) {
      await settingsStore.update(actor.orgId, { ai: body.ai });
      aiProvider.configure(body.ai);
      changed.push('AI Provider');
      logger.info('AI provider updated');
    }
    if (body.pagerduty) {
      await settingsStore.update(actor.orgId, { pagerduty: body.pagerduty });
      pagerduty.configure(body.pagerduty);
      changed.push('PagerDuty');
      logger.info('PagerDuty integration updated');
    }

    if (auditStore && changed.length > 0) {
      await auditStore.log(actor.orgId, actor.id, actor.username || actor.displayName, 'integration_updated', 'integration',
        `Updated: ${changed.join(', ')}`, { integrations: changed });
    }

    return res.json(await settingsStore.get(actor.orgId));
  });

  // Logs endpoint for observability
  router.get('/logs', (_req: Request, res: Response) => {
    return res.json(logger.getEntries(200));
  });

  return router;
}
