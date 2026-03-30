import express from 'express';
import cors from 'cors';
import { analyzeRoutes } from './routes/analyze';
import { anomalyRoutes } from './routes/anomaly';
import { incidentRoutes } from './routes/incidents';
import { runbookRoutes } from './routes/runbooks';
import { seedRoutes } from './routes/seed';
import { webhookRoutes } from './routes/webhooks';
import { authRoutes } from './routes/auth';
import { settingsRoutes } from './routes/settings';
import { preferencesRoutes } from './routes/preferences';
import { teamRoutes } from './routes/teams';
import { notificationRoutes } from './routes/notifications';
import { auditRoutes } from './routes/audit';
import { orgRoutes } from './routes/org';
import { IncidentStore } from './stores/incident-store';
import { RunbookStore } from './stores/runbook-store';
import { UserStore } from './stores/user-store';
import { SettingsStore } from './stores/settings-store';
import { TeamStore } from './stores/team-store';
import { NotificationStore } from './stores/notification-store';
import { AuditStore } from './stores/audit-store';
import { PagerDutyService } from './services/pagerduty';
import { SlackService, JiraService, OpsGenieService } from './services/integrations';
import { AIProviderService } from './services/ai-provider';
import { logger } from './services/logger';
import { connectDB, isConnected } from './db/connection';
import { authLimiter, webhookLimiter, apiLimiter } from './middleware/rate-limit';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const app: express.Express = express();

// Configure CORS - allow all origins in development, specific in production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.FRONTEND_URL || true) // Allow specific origin or all if not set
    : true, // Allow all origins in development
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));

// Initialize stores and services
const incidentStore = new IncidentStore();
const runbookStore = new RunbookStore();
const userStore = new UserStore();
const settingsStore = new SettingsStore();
const teamStore = new TeamStore();
const notificationStore = new NotificationStore();
const auditStore = new AuditStore();
const pagerduty = new PagerDutyService();
const slack = new SlackService();
const jira = new JiraService();
const opsgenie = new OpsGenieService();
const aiProvider = new AIProviderService();

// Configure PagerDuty if key is provided
if (process.env.PAGERDUTY_ROUTING_KEY) {
  pagerduty.configure({
    routingKey: process.env.PAGERDUTY_ROUTING_KEY,
    webhookSecret: process.env.PAGERDUTY_WEBHOOK_SECRET,
    autoTriggerSeverities: (process.env.PAGERDUTY_AUTO_SEVERITIES || 'critical,high').split(',') as any[],
  });
}

// Configure integrations from env
if (process.env.SLACK_WEBHOOK_URL) {
  slack.configure({ webhookUrl: process.env.SLACK_WEBHOOK_URL, channel: process.env.SLACK_CHANNEL || '#incidents', enabled: true });
}
if (process.env.JIRA_BASE_URL) {
  jira.configure({ baseUrl: process.env.JIRA_BASE_URL, projectKey: process.env.JIRA_PROJECT_KEY || 'INC', apiToken: process.env.JIRA_API_TOKEN || '', email: process.env.JIRA_EMAIL || '', enabled: true });
}
if (process.env.OPSGENIE_API_KEY) {
  opsgenie.configure({ apiKey: process.env.OPSGENIE_API_KEY, enabled: true });
}
if (process.env.AI_API_KEY) {
  aiProvider.configure({ provider: (process.env.AI_PROVIDER as any) || 'openai', apiKey: process.env.AI_API_KEY, model: process.env.AI_MODEL || 'gpt-4', enabled: true });
}

// Request logging middleware
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', async (_req, res) => {
  res.json({
    service: 'ai-incident-analyzer',
    status: 'ok',
    mongodb: isConnected() ? 'connected' : 'disconnected (in-memory fallback)',
    pagerduty: pagerduty.isConfigured() ? 'configured' : 'simulated',
    slack: slack.isEnabled() ? 'configured' : 'disabled',
    jira: jira.isEnabled() ? 'configured' : 'disabled',
    opsgenie: opsgenie.isEnabled() ? 'configured' : 'disabled',
    ai: aiProvider.isEnabled() ? 'configured' : 'local-only',
    uptime: process.uptime(),
  });
});

// Mount routes
app.use('/auth', authLimiter, authRoutes(userStore, teamStore, auditStore));
app.use('/analyze', apiLimiter, analyzeRoutes(incidentStore, runbookStore, userStore, pagerduty));
app.use('/anomaly', apiLimiter, anomalyRoutes(userStore));
app.use('/incidents', apiLimiter, incidentRoutes(incidentStore, userStore, pagerduty, notificationStore, teamStore));
app.use('/runbooks', apiLimiter, runbookRoutes(runbookStore, userStore));
app.use('/seed', apiLimiter, seedRoutes(incidentStore, runbookStore, userStore, teamStore, notificationStore));
app.use('/webhooks', webhookLimiter, webhookRoutes(incidentStore));
app.use('/settings/integrations', settingsRoutes(settingsStore, userStore, slack, jira, opsgenie, aiProvider, pagerduty, auditStore));
app.use('/settings/preferences', preferencesRoutes(userStore));
app.use('/teams', teamRoutes(teamStore, userStore, auditStore));
app.use('/notifications', notificationRoutes(notificationStore, userStore));
app.use('/audit-log', auditRoutes(auditStore, userStore));
app.use('/org', orgRoutes(userStore));

async function start() {
  // Connect to MongoDB (falls back to in-memory if unavailable)
  await connectDB();

  // Seed demo users into MongoDB if connected
  await userStore.seedMongo();

  app.listen(PORT, () => {
    logger.info(`AI Incident Analyzer running on http://localhost:${PORT}`);
    logger.info(`MongoDB: ${isConnected() ? 'connected' : 'in-memory fallback'}`);
    logger.info(`PagerDuty: ${pagerduty.isConfigured() ? 'live' : 'simulated'}`);
    logger.info(`Slack: ${slack.isEnabled() ? 'live' : 'disabled'}`);
    logger.info(`AI Provider: ${aiProvider.isEnabled() ? 'configured' : 'local-only'}`);
    logger.info(`Dashboard: http://localhost:5173`);
  });
}

start().catch(err => {
  logger.error('Failed to start server', err);
  process.exit(1);
});

export default app;
