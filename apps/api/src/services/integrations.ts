import { SlackConfig, JiraConfig, OpsGenieConfig, Incident } from '@incident-analyzer/shared';
import { logger } from './logger';

export class SlackService {
  private config: SlackConfig | null = null;

  configure(config: SlackConfig) { this.config = config; }
  isEnabled(): boolean { return !!this.config?.enabled; }

  async notify(incident: Incident, message?: string): Promise<boolean> {
    if (!this.config?.enabled) {
      logger.info('Slack notification skipped (not configured)');
      return false;
    }
    const text = message || `🚨 *${incident.title}* [${incident.analysis.severity.toUpperCase()}]\nService: ${incident.service || 'unknown'}\nStatus: ${incident.status}`;
    try {
      const res = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: this.config.channel, text }),
      });
      logger.info(`Slack notification sent: ${res.status}`);
      return res.ok;
    } catch (err) {
      logger.error('Slack notification failed', err);
      return false;
    }
  }
}

export class JiraService {
  private config: JiraConfig | null = null;

  configure(config: JiraConfig) { this.config = config; }
  isEnabled(): boolean { return !!this.config?.enabled; }

  async createTicket(incident: Incident): Promise<{ key: string; url: string } | null> {
    if (!this.config?.enabled) {
      logger.info('Jira ticket creation skipped (not configured)');
      return null;
    }
    try {
      const auth = Buffer.from(`${this.config.email}:${this.config.apiToken}`).toString('base64');
      const res = await fetch(`${this.config.baseUrl}/rest/api/3/issue`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fields: {
            project: { key: this.config.projectKey },
            summary: `[${incident.analysis.severity.toUpperCase()}] ${incident.title}`,
            description: {
              type: 'doc', version: 1,
              content: [{ type: 'paragraph', content: [{ type: 'text', text: incident.analysis.summary }] }],
            },
            issuetype: { name: 'Bug' },
            priority: { name: incident.analysis.severity === 'critical' ? 'Highest' : incident.analysis.severity === 'high' ? 'High' : 'Medium' },
          },
        }),
      });
      if (res.ok) {
        const data: any = await res.json();
        const url = `${this.config.baseUrl}/browse/${data.key}`;
        logger.info(`Jira ticket created: ${data.key}`);
        return { key: data.key, url };
      }
      logger.error(`Jira ticket creation failed: ${res.status}`);
      return null;
    } catch (err) {
      logger.error('Jira ticket creation failed', err);
      return null;
    }
  }
}

export class OpsGenieService {
  private config: OpsGenieConfig | null = null;

  configure(config: OpsGenieConfig) { this.config = config; }
  isEnabled(): boolean { return !!this.config?.enabled; }

  async createAlert(incident: Incident): Promise<boolean> {
    if (!this.config?.enabled) {
      logger.info('OpsGenie alert skipped (not configured)');
      return false;
    }
    try {
      const res = await fetch('https://api.opsgenie.com/v2/alerts', {
        method: 'POST',
        headers: {
          'Authorization': `GenieKey ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: incident.title,
          description: incident.analysis.summary,
          priority: incident.analysis.severity === 'critical' ? 'P1' : incident.analysis.severity === 'high' ? 'P2' : 'P3',
          tags: [incident.service || 'unknown', incident.analysis.rootCause.category],
        }),
      });
      logger.info(`OpsGenie alert created: ${res.status}`);
      return res.ok;
    } catch (err) {
      logger.error('OpsGenie alert failed', err);
      return false;
    }
  }
}
