import { IntegrationSettings, TeamIntegrationOverrides } from '@incident-analyzer/shared';

/**
 * Resolves effective integration settings for a team by merging
 * team-level overrides on top of org-level defaults.
 *
 * Resolution order: Team override → Org default
 *
 * Only routing/destination fields are overridable per-team:
 * - Slack channel
 * - Jira project key
 * - OpsGenie team name
 *
 * Credentials (API keys, tokens, webhookUrl) always come from org-level.
 */
export function resolveSettings(
  orgSettings: IntegrationSettings,
  teamOverrides?: TeamIntegrationOverrides
): IntegrationSettings & { _teamOverrides?: TeamIntegrationOverrides } {
  if (!teamOverrides) return orgSettings;

  const resolved = JSON.parse(JSON.stringify(orgSettings)) as IntegrationSettings & { _teamOverrides?: TeamIntegrationOverrides };

  if (teamOverrides.slackChannel && resolved.slack) {
    resolved.slack.channel = teamOverrides.slackChannel;
  }

  if (teamOverrides.jiraProjectKey && resolved.jira) {
    resolved.jira.projectKey = teamOverrides.jiraProjectKey;
  }

  // Pass through fields that don't map directly to IntegrationSettings
  // but are needed by notification/ticket-creation logic
  resolved._teamOverrides = teamOverrides;

  return resolved;
}

/**
 * Returns a human-readable summary of what a team overrides vs org defaults.
 */
export function describeOverrides(
  orgSettings: IntegrationSettings,
  teamOverrides?: TeamIntegrationOverrides
): { field: string; orgValue: string; teamValue: string }[] {
  if (!teamOverrides) return [];
  const diffs: { field: string; orgValue: string; teamValue: string }[] = [];

  if (teamOverrides.slackChannel && orgSettings.slack?.channel) {
    diffs.push({ field: 'Slack Channel', orgValue: orgSettings.slack.channel, teamValue: teamOverrides.slackChannel });
  }
  if (teamOverrides.slackMentionGroup) {
    diffs.push({ field: 'Slack Mention Group', orgValue: '(none)', teamValue: teamOverrides.slackMentionGroup });
  }
  if (teamOverrides.jiraProjectKey && orgSettings.jira?.projectKey) {
    diffs.push({ field: 'Jira Project', orgValue: orgSettings.jira.projectKey, teamValue: teamOverrides.jiraProjectKey });
  }
  if (teamOverrides.jiraIssueType) {
    diffs.push({ field: 'Jira Issue Type', orgValue: '(default)', teamValue: teamOverrides.jiraIssueType });
  }
  if (teamOverrides.opsgenieTeamName) {
    diffs.push({ field: 'OpsGenie Team', orgValue: '(default)', teamValue: teamOverrides.opsgenieTeamName });
  }
  if (teamOverrides.opsgeniePriority) {
    diffs.push({ field: 'OpsGenie Priority', orgValue: '(default)', teamValue: teamOverrides.opsgeniePriority });
  }
  if (teamOverrides.pagerdutyEscalationPolicyId) {
    diffs.push({ field: 'PagerDuty Escalation Policy', orgValue: '(default)', teamValue: teamOverrides.pagerdutyEscalationPolicyId });
  }

  return diffs;
}
