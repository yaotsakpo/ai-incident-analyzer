import { Runbook } from '@incident-analyzer/shared';
import { RunbookModel } from '../db/models';
import { isConnected } from '../db/connection';

export class RunbookStore {
  private cache: Map<string, Runbook> = new Map();

  private useMongo(): boolean { return isConnected(); }

  async save(runbook: Runbook): Promise<void> {
    this.cache.set(runbook.id, runbook);
    if (this.useMongo()) {
      await RunbookModel.findOneAndUpdate({ id: runbook.id }, runbook, { upsert: true, returnDocument: 'after' });
    }
  }

  async get(id: string): Promise<Runbook | undefined> {
    if (this.useMongo()) {
      const doc = await RunbookModel.findOne({ id }).lean();
      if (doc) { const r = { ...doc } as any; delete r._id; delete r.__v; this.cache.set(id, r); return r; }
      return undefined;
    }
    return this.cache.get(id);
  }

  async list(orgId?: string): Promise<Runbook[]> {
    if (this.useMongo()) {
      const filter: any = orgId ? { orgId } : { orgId: '__none__' };
      const docs = await RunbookModel.find(filter).sort({ name: 1 }).lean();
      return docs.map((d: any) => { delete d._id; delete d.__v; return d as Runbook; });
    }
    let items = Array.from(this.cache.values());
    items = items.filter((r: any) => r.orgId === orgId);
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  async findByCategory(category: string, orgId?: string): Promise<Runbook | undefined> {
    const all = await this.list(orgId);
    const normalized = category.toLowerCase();
    // Exact match first
    for (const rb of all) {
      if (rb.category.toLowerCase() === normalized) return rb;
    }
    // Partial match
    for (const rb of all) {
      if (normalized.includes(rb.category.toLowerCase()) || rb.category.toLowerCase().includes(normalized)) {
        return rb;
      }
    }
    // Tag match
    for (const rb of all) {
      for (const tag of rb.tags) {
        if (normalized.includes(tag.toLowerCase())) return rb;
      }
    }
    return undefined;
  }

  async matchForIncident(rootCauseCategory: string, patterns: string[], orgId?: string): Promise<{ runbook: Runbook; score: number; reason: string } | undefined> {
    const catMatch = await this.findByCategory(rootCauseCategory, orgId);
    if (catMatch) {
      return { runbook: catMatch, score: 0.9, reason: `Matched root cause category: ${rootCauseCategory}` };
    }

    const all = await this.list(orgId);
    for (const rb of all) {
      for (const pattern of patterns) {
        for (const tag of rb.tags) {
          if (pattern.toLowerCase().includes(tag.toLowerCase()) || tag.toLowerCase().includes(pattern.toLowerCase())) {
            return { runbook: rb, score: 0.7, reason: `Matched pattern "${pattern}" via tag "${tag}"` };
          }
        }
      }
    }

    return undefined;
  }

  async delete(id: string): Promise<boolean> {
    this.cache.delete(id);
    if (this.useMongo()) {
      const res = await RunbookModel.deleteOne({ id });
      return res.deletedCount > 0;
    }
    return true;
  }

  async clear(orgId?: string): Promise<void> {
    if (orgId) {
      for (const [k, v] of this.cache) { if ((v as any).orgId === orgId) this.cache.delete(k); }
      if (this.useMongo()) await RunbookModel.deleteMany({ orgId });
    } else {
      this.cache.clear();
      if (this.useMongo()) await RunbookModel.deleteMany({});
    }
  }
}
