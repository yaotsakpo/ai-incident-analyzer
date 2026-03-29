import { describe, it, expect, beforeEach } from 'vitest';
import { vi } from 'vitest';

vi.mock('../db/connection', () => ({ isConnected: () => false }));
vi.mock('../db/models', () => ({}));
vi.mock('../services/event-emitter', () => ({
  sseEmitter: { emit: vi.fn(), addClient: vi.fn(), removeClient: vi.fn() },
}));

import { IncidentStore } from './incident-store';
import type { Incident } from '@incident-analyzer/shared';

function makeIncident(overrides: Partial<Incident> & { orgId?: string } = {}): Incident & { orgId: string } {
  return {
    id: `inc-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Incident',
    status: 'open',
    source: 'manual',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    analysis: {
      id: 'a1', timestamp: new Date().toISOString(), summary: 'test',
      rootCause: { category: 'db', description: 'timeout', evidence: [] },
      recommendations: ['restart'], severity: 'high', confidence: 0.9,
      patterns: [], analyzedLogs: 10, processingTimeMs: 100,
    },
    orgId: 'org1',
    ...overrides,
  } as any;
}

describe('IncidentStore (in-memory)', () => {
  let store: IncidentStore;

  beforeEach(() => {
    store = new IncidentStore();
  });

  it('saves and retrieves an incident', async () => {
    const inc = makeIncident();
    await store.save(inc);
    const result = await store.get(inc.id);
    expect(result).toBeDefined();
    expect(result!.title).toBe('Test Incident');
  });

  it('lists incidents filtered by orgId', async () => {
    await store.save(makeIncident({ orgId: 'org1' }));
    await store.save(makeIncident({ orgId: 'org2' }));
    const org1 = await store.list(50, 'org1');
    const org2 = await store.list(50, 'org2');
    expect(org1).toHaveLength(1);
    expect(org2).toHaveLength(1);
  });

  it('updates incident status to acknowledged', async () => {
    const inc = makeIncident();
    await store.save(inc);
    const updated = await store.updateStatus(inc.id, 'acknowledged');
    expect(updated).toBeDefined();
    expect(updated!.status).toBe('acknowledged');
    expect(updated!.acknowledgedAt).toBeDefined();
    expect(updated!.timeToAckMs).toBeGreaterThanOrEqual(0);
  });

  it('updates incident status to resolved', async () => {
    const inc = makeIncident();
    await store.save(inc);
    const updated = await store.updateStatus(inc.id, 'resolved');
    expect(updated).toBeDefined();
    expect(updated!.status).toBe('resolved');
    expect(updated!.resolvedAt).toBeDefined();
    expect(updated!.timeToResolveMs).toBeGreaterThanOrEqual(0);
  });

  it('returns undefined for non-existent incident', async () => {
    const result = await store.get('non-existent');
    expect(result).toBeUndefined();
  });

  it('returns undefined when updating status of non-existent incident', async () => {
    const result = await store.updateStatus('non-existent', 'acknowledged');
    expect(result).toBeUndefined();
  });

  it('adds and retrieves comments', async () => {
    const inc = makeIncident();
    await store.save(inc);
    const comment = await store.addComment(inc.id, 'alice', 'Hello world');
    expect(comment).toBeDefined();
    expect(comment!.author).toBe('alice');
    expect(comment!.text).toBe('Hello world');

    const comments = await store.getComments(inc.id);
    expect(comments).toHaveLength(1);
    expect(comments[0].id).toBe(comment!.id);
  });

  it('parses mentions from comment text', async () => {
    const inc = makeIncident();
    await store.save(inc);
    const comment = await store.addComment(inc.id, 'alice', 'cc @bob @charlie');
    expect(comment!.mentions).toEqual(['bob', 'charlie']);
  });

  it('assigns a team to an incident', async () => {
    const inc = makeIncident();
    await store.save(inc);
    const updated = await store.assignTeam(inc.id, 'team1', 'Backend Team');
    expect(updated).toBeDefined();
    expect(updated!.assignedTeamId).toBe('team1');
    expect(updated!.assignedTeamName).toBe('Backend Team');
  });

  it('unassigns a team from an incident', async () => {
    const inc = makeIncident({ assignedTeamId: 'team1', assignedTeamName: 'Backend Team' });
    await store.save(inc);
    const updated = await store.assignTeam(inc.id, null, null);
    expect(updated).toBeDefined();
    expect(updated!.assignedTeamId).toBeUndefined();
    expect(updated!.assignedTeamName).toBeUndefined();
  });

  it('completes a runbook step', async () => {
    const inc = makeIncident({
      runbook: { runbookId: 'rb1', runbookName: 'Fix DB', matchScore: 0.8, matchReason: 'test', completedSteps: [] },
    });
    await store.save(inc);
    const updated = await store.completeRunbookStep(inc.id, 0);
    expect(updated).toBeDefined();
    expect(updated!.runbook!.completedSteps).toContain(0);
  });

  it('does not duplicate completed runbook steps', async () => {
    const inc = makeIncident({
      runbook: { runbookId: 'rb1', runbookName: 'Fix DB', matchScore: 0.8, matchReason: 'test', completedSteps: [0] },
    });
    await store.save(inc);
    const updated = await store.completeRunbookStep(inc.id, 0);
    expect(updated!.runbook!.completedSteps.filter(s => s === 0)).toHaveLength(1);
  });

  it('lists incidents sorted by createdAt descending', async () => {
    const old = makeIncident({ orgId: 'org1', createdAt: '2024-01-01T00:00:00Z' });
    const recent = makeIncident({ orgId: 'org1', createdAt: '2024-06-01T00:00:00Z' });
    await store.save(old);
    await store.save(recent);
    const list = await store.list(50, 'org1');
    expect(list[0].createdAt).toBe('2024-06-01T00:00:00Z');
    expect(list[1].createdAt).toBe('2024-01-01T00:00:00Z');
  });
});
