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

  it('paginates results with limit and offset', async () => {
    for (let i = 0; i < 5; i++) {
      await store.save(makeIncident({ orgId: 'org-page' }));
    }
    const page1 = await store.list(2, 'org-page', 0);
    expect(page1).toHaveLength(2);

    const page2 = await store.list(2, 'org-page', 2);
    expect(page2).toHaveLength(2);

    // No overlap between pages
    const ids1 = page1.map(i => i.id);
    const ids2 = page2.map(i => i.id);
    expect(ids1.filter(id => ids2.includes(id))).toHaveLength(0);
  });

  it('returns empty array when offset exceeds total', async () => {
    await store.save(makeIncident({ orgId: 'org-page2' }));
    const result = await store.list(10, 'org-page2', 999);
    expect(result).toHaveLength(0);
  });

  describe('multi-tenant isolation', () => {
    it('list() only returns incidents from the requested org', async () => {
      await store.save(makeIncident({ id: 'inc-iso-a1', orgId: 'org-A' }));
      await store.save(makeIncident({ id: 'inc-iso-a2', orgId: 'org-A' }));
      await store.save(makeIncident({ id: 'inc-iso-b1', orgId: 'org-B' }));

      const orgA = await store.list(50, 'org-A');
      const orgB = await store.list(50, 'org-B');

      expect(orgA.every((i: any) => i.orgId === 'org-A')).toBe(true);
      expect(orgA.some((i: any) => i.id === 'inc-iso-b1')).toBe(false);

      expect(orgB.every((i: any) => i.orgId === 'org-B')).toBe(true);
      expect(orgB.some((i: any) => i.id === 'inc-iso-a1')).toBe(false);
    });

    it('list() returns empty array for unknown org', async () => {
      await store.save(makeIncident({ orgId: 'org-A' }));
      const result = await store.list(50, 'org-unknown');
      expect(result).toHaveLength(0);
    });

    it('updateStatus() does not affect incidents in other orgs', async () => {
      await store.save(makeIncident({ id: 'inc-upd-a', orgId: 'org-A', status: 'open' }));
      await store.save(makeIncident({ id: 'inc-upd-b', orgId: 'org-B', status: 'open' }));

      await store.updateStatus('inc-upd-a', 'resolved');

      const orgB = await store.list(50, 'org-B');
      expect(orgB.find(i => i.id === 'inc-upd-b')?.status).toBe('open');
    });

    it('clear() only removes incidents for the specified org', async () => {
      await store.save(makeIncident({ id: 'inc-clr-a', orgId: 'org-A' }));
      await store.save(makeIncident({ id: 'inc-clr-b', orgId: 'org-B' }));

      await store.clear('org-A');

      const orgA = await store.list(50, 'org-A');
      const orgB = await store.list(50, 'org-B');

      expect(orgA).toHaveLength(0);
      expect(orgB.some((i: any) => i.id === 'inc-clr-b')).toBe(true);
    });

    it('pagination respects org isolation', async () => {
      for (let i = 0; i < 4; i++) {
        await store.save(makeIncident({ orgId: 'org-pag-A' }));
      }
      for (let i = 0; i < 3; i++) {
        await store.save(makeIncident({ orgId: 'org-pag-B' }));
      }

      const pageA = await store.list(2, 'org-pag-A', 0);
      const pageB = await store.list(2, 'org-pag-B', 0);

      expect(pageA.every((i: any) => i.orgId === 'org-pag-A')).toBe(true);
      expect(pageB.every((i: any) => i.orgId === 'org-pag-B')).toBe(true);
    });
  });
});
