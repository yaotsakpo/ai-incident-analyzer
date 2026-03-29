import { v4 as uuidv4 } from 'uuid';
import { AuditLogModel } from '../db/models';
import { isConnected } from '../db/connection';

export interface AuditEntry {
  id: string;
  userId: string;
  username: string;
  action: string;
  category: 'integration' | 'user' | 'team' | 'auth';
  details: string;
  metadata: Record<string, any>;
  createdAt: string;
}

export class AuditStore {
  private cache: AuditEntry[] = [];

  private useMongo(): boolean { return isConnected(); }

  async log(orgId: string, userId: string, username: string, action: string, category: AuditEntry['category'], details: string = '', metadata: Record<string, any> = {}): Promise<AuditEntry> {
    const entry: any = {
      id: uuidv4(),
      orgId,
      userId,
      username,
      action,
      category,
      details,
      metadata,
      createdAt: new Date().toISOString(),
    };
    if (this.useMongo()) {
      await AuditLogModel.create(entry);
    }
    this.cache.push(entry);
    return entry;
  }

  async list(orgId: string, limit = 100, category?: string): Promise<AuditEntry[]> {
    if (this.useMongo()) {
      const filter: any = { orgId };
      if (category) filter.category = category;
      const docs = await AuditLogModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
      return docs.map((d: any) => {
        const { _id, __v, ...entry } = d;
        return entry as AuditEntry;
      });
    }
    let entries = this.cache.filter((e: any) => e.orgId === orgId);
    if (category) entries = entries.filter(e => e.category === category);
    return entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }
}
