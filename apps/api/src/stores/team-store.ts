import { v4 as uuidv4 } from 'uuid';
import { TeamModel } from '../db/models';
import { isConnected } from '../db/connection';
import { TeamIntegrationOverrides } from '@incident-analyzer/shared';

export interface TeamMember {
  userId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

export interface Team {
  id: string;
  orgId: string;
  name: string;
  description: string;
  members: TeamMember[];
  integrationOverrides?: TeamIntegrationOverrides;
  createdAt: string;
  updatedAt: string;
}

export class TeamStore {
  private cache: Map<string, Team> = new Map();

  private useMongo(): boolean { return isConnected(); }

  async list(orgId?: string): Promise<Team[]> {
    if (this.useMongo()) {
      const filter: any = orgId ? { orgId } : { orgId: '__none__' };
      const docs = await TeamModel.find(filter).lean();
      return docs.map((d: any) => {
        const { _id, __v, ...team } = d;
        return team as Team;
      });
    }
    let items = Array.from(this.cache.values());
    items = items.filter(t => t.orgId === orgId);
    return items;
  }

  async get(id: string): Promise<Team | undefined> {
    if (this.useMongo()) {
      const doc = await TeamModel.findOne({ id }).lean();
      if (!doc) return undefined;
      const { _id, __v, ...team } = doc as any;
      return team as Team;
    }
    return this.cache.get(id);
  }

  async create(name: string, description: string, ownerUserId: string, orgId: string): Promise<Team> {
    const now = new Date().toISOString();
    const team: Team = {
      id: uuidv4(),
      orgId,
      name,
      description: description || '',
      members: [{ userId: ownerUserId, role: 'owner', joinedAt: now }],
      createdAt: now,
      updatedAt: now,
    };
    if (this.useMongo()) {
      await TeamModel.create(team);
    }
    this.cache.set(team.id, team);
    return team;
  }

  async update(id: string, data: { name?: string; description?: string }): Promise<Team | null> {
    const now = new Date().toISOString();
    if (this.useMongo()) {
      const doc = await TeamModel.findOneAndUpdate(
        { id },
        { ...data, updatedAt: now },
        { returnDocument: 'after' }
      ).lean();
      if (!doc) return null;
      const { _id, __v, ...team } = doc as any;
      this.cache.set(id, team as Team);
      return team as Team;
    }
    const team = this.cache.get(id);
    if (!team) return null;
    if (data.name !== undefined) team.name = data.name;
    if (data.description !== undefined) team.description = data.description;
    team.updatedAt = now;
    return team;
  }

  async delete(id: string): Promise<boolean> {
    if (this.useMongo()) {
      const result = await TeamModel.deleteOne({ id });
      this.cache.delete(id);
      return result.deletedCount > 0;
    }
    return this.cache.delete(id);
  }

  async addMember(teamId: string, userId: string, role: 'admin' | 'member' = 'member'): Promise<Team | null> {
    const now = new Date().toISOString();
    const member: TeamMember = { userId, role, joinedAt: now };

    if (this.useMongo()) {
      // Remove existing membership first, then add
      await TeamModel.updateOne({ id: teamId }, { $pull: { members: { userId } } });
      const doc = await TeamModel.findOneAndUpdate(
        { id: teamId },
        { $push: { members: member }, updatedAt: now },
        { returnDocument: 'after' }
      ).lean();
      if (!doc) return null;
      const { _id, __v, ...team } = doc as any;
      this.cache.set(teamId, team as Team);
      return team as Team;
    }
    const team = this.cache.get(teamId);
    if (!team) return null;
    team.members = team.members.filter(m => m.userId !== userId);
    team.members.push(member);
    team.updatedAt = now;
    return team;
  }

  async updateMemberRole(teamId: string, userId: string, role: 'owner' | 'admin' | 'member'): Promise<Team | null> {
    const now = new Date().toISOString();
    if (this.useMongo()) {
      const doc = await TeamModel.findOneAndUpdate(
        { id: teamId, 'members.userId': userId },
        { $set: { 'members.$.role': role }, updatedAt: now },
        { returnDocument: 'after' }
      ).lean();
      if (!doc) return null;
      const { _id, __v, ...team } = doc as any;
      this.cache.set(teamId, team as Team);
      return team as Team;
    }
    const team = this.cache.get(teamId);
    if (!team) return null;
    const member = team.members.find(m => m.userId === userId);
    if (!member) return null;
    member.role = role;
    team.updatedAt = now;
    return team;
  }

  async removeMember(teamId: string, userId: string): Promise<Team | null> {
    const now = new Date().toISOString();

    if (this.useMongo()) {
      const doc = await TeamModel.findOneAndUpdate(
        { id: teamId },
        { $pull: { members: { userId } }, updatedAt: now },
        { returnDocument: 'after' }
      ).lean();
      if (!doc) return null;
      const { _id, __v, ...team } = doc as any;
      this.cache.set(teamId, team as Team);
      return team as Team;
    }
    const team = this.cache.get(teamId);
    if (!team) return null;
    team.members = team.members.filter(m => m.userId !== userId);
    team.updatedAt = now;
    return team;
  }

  async getIntegrationOverrides(teamId: string): Promise<TeamIntegrationOverrides> {
    const team = await this.get(teamId);
    return team?.integrationOverrides || {};
  }

  async updateIntegrationOverrides(teamId: string, overrides: TeamIntegrationOverrides): Promise<Team | null> {
    const now = new Date().toISOString();
    if (this.useMongo()) {
      const doc = await TeamModel.findOneAndUpdate(
        { id: teamId },
        { integrationOverrides: overrides, updatedAt: now },
        { returnDocument: 'after' }
      ).lean();
      if (!doc) return null;
      const { _id, __v, ...team } = doc as any;
      this.cache.set(teamId, team as Team);
      return team as Team;
    }
    const team = this.cache.get(teamId);
    if (!team) return null;
    team.integrationOverrides = overrides;
    team.updatedAt = now;
    return team;
  }

  async getTeamsForUser(userId: string, orgId?: string): Promise<Team[]> {
    if (this.useMongo()) {
      const filter: any = { 'members.userId': userId, orgId: orgId || '__none__' };
      const docs = await TeamModel.find(filter).lean();
      return docs.map((d: any) => {
        const { _id, __v, ...team } = d;
        return team as Team;
      });
    }
    let items = Array.from(this.cache.values()).filter(t => t.members.some(m => m.userId === userId));
    items = items.filter(t => t.orgId === orgId);
    return items;
  }
}
