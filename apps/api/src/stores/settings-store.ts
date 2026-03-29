import { IntegrationSettings } from '@incident-analyzer/shared';
import { SettingsModel } from '../db/models';
import { isConnected } from '../db/connection';

export class SettingsStore {
  private cache: Map<string, IntegrationSettings> = new Map();

  private useMongo(): boolean { return isConnected(); }

  async get(orgId: string): Promise<IntegrationSettings> {
    if (this.useMongo()) {
      const doc = await SettingsModel.findOne({ key: orgId }).lean();
      if (doc) {
        const { _id, __v, key, orgId: _, ...settings } = doc as any;
        this.cache.set(orgId, settings);
        return { ...settings };
      }
    }
    return { ...(this.cache.get(orgId) || {}) };
  }

  async update(orgId: string, partial: Partial<IntegrationSettings>): Promise<IntegrationSettings> {
    const current = this.cache.get(orgId) || {};
    const merged = { ...current, ...partial };
    this.cache.set(orgId, merged);
    if (this.useMongo()) {
      await SettingsModel.findOneAndUpdate(
        { key: orgId },
        { key: orgId, orgId, ...merged },
        { upsert: true, returnDocument: 'after' }
      );
    }
    return this.get(orgId);
  }

  async clear(orgId?: string): Promise<void> {
    if (orgId) {
      this.cache.delete(orgId);
      if (this.useMongo()) await SettingsModel.deleteMany({ key: orgId });
    } else {
      this.cache.clear();
      if (this.useMongo()) await SettingsModel.deleteMany({});
    }
  }
}
