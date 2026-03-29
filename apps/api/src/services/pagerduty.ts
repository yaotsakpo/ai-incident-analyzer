import { v4 as uuidv4 } from 'uuid';
import { Incident, PagerDutyLink, PagerDutyConfig, Severity } from '@incident-analyzer/shared';

export class PagerDutyService {
  private config: PagerDutyConfig | null = null;

  configure(config: PagerDutyConfig): void {
    this.config = config;
    console.log('[pagerduty] configured with routing key: ...', config.routingKey.slice(-6));
  }

  isConfigured(): boolean {
    return this.config !== null && this.config.routingKey.length > 0;
  }

  shouldAutoTrigger(severity: Severity): boolean {
    if (!this.config) return false;
    return this.config.autoTriggerSeverities.includes(severity);
  }

  async triggerIncident(incident: Incident): Promise<PagerDutyLink> {
    const dedupKey = `incident-analyzer-${incident.id}`;

    if (!this.config || !this.isConfigured()) {
      console.log('[pagerduty] simulated trigger for incident:', incident.id);
      return {
        dedupKey,
        status: 'triggered',
        triggeredAt: new Date().toISOString(),
        incidentId: `PD-SIM-${uuidv4().slice(0, 8).toUpperCase()}`,
        htmlUrl: `https://your-org.pagerduty.com/incidents/SIMULATED`,
      };
    }

    try {
      const payload = {
        routing_key: this.config.routingKey,
        event_action: 'trigger',
        dedup_key: dedupKey,
        payload: {
          summary: `[${incident.analysis.severity.toUpperCase()}] ${incident.title} — ${incident.analysis.rootCause.category}`,
          source: incident.service || 'ai-incident-analyzer',
          severity: this.mapSeverity(incident.analysis.severity),
          component: incident.service,
          group: incident.analysis.rootCause.category,
          custom_details: {
            incident_id: incident.id,
            root_cause: incident.analysis.rootCause.description,
            confidence: incident.analysis.confidence,
            patterns: incident.analysis.patterns.map(p => p.name).join(', '),
            recommendations: incident.analysis.recommendations.slice(0, 3),
            analyzed_logs: incident.analysis.analyzedLogs,
            runbook: incident.runbook?.runbookName || 'None matched',
          },
        },
        links: [
          {
            href: `http://localhost:5173/incidents/${incident.id}`,
            text: 'View in Incident Analyzer Dashboard',
          },
        ],
      };

      const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json() as any;

      return {
        dedupKey,
        status: 'triggered',
        triggeredAt: new Date().toISOString(),
        incidentId: data.dedup_key,
      };
    } catch (error) {
      console.error('[pagerduty] trigger failed:', (error as Error).message);
      return {
        dedupKey,
        status: 'triggered',
        triggeredAt: new Date().toISOString(),
      };
    }
  }

  async resolveIncident(dedupKey: string): Promise<boolean> {
    if (!this.config || !this.isConfigured()) {
      console.log('[pagerduty] simulated resolve for:', dedupKey);
      return true;
    }

    try {
      await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routing_key: this.config.routingKey,
          event_action: 'resolve',
          dedup_key: dedupKey,
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  async acknowledgeIncident(dedupKey: string): Promise<boolean> {
    if (!this.config || !this.isConfigured()) {
      console.log('[pagerduty] simulated acknowledge for:', dedupKey);
      return true;
    }

    try {
      await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routing_key: this.config.routingKey,
          event_action: 'acknowledge',
          dedup_key: dedupKey,
        }),
      });
      return true;
    } catch {
      return false;
    }
  }

  private mapSeverity(severity: Severity): string {
    switch (severity) {
      case 'critical': return 'critical';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
    }
  }
}
