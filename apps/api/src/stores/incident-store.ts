import { Incident, IncidentStatus, Comment, Severity, AlertGroup, SLAMetrics, AuditEntry } from '@incident-analyzer/shared';
import { v4 as uuidv4 } from 'uuid';
import { sseEmitter } from '../services/event-emitter';
import { IncidentModel } from '../db/models';
import { isConnected } from '../db/connection';

export class IncidentStore {
  // In-memory fallback when MongoDB is unavailable
  private cache: Map<string, Incident> = new Map();

  private useMongo(): boolean { return isConnected(); }

  private toPlain(doc: any): Incident {
    const obj = doc.toObject ? doc.toObject() : doc;
    delete obj._id;
    delete obj.__v;
    return obj as Incident;
  }

  async save(incident: Incident & { orgId?: string }, emitEvent = true): Promise<void> {
    this.cache.set(incident.id, incident);
    if (this.useMongo()) {
      await IncidentModel.findOneAndUpdate({ id: incident.id }, incident, { upsert: true, returnDocument: 'after' });
    }
    if (emitEvent) sseEmitter.emit('incident:created', incident);
  }

  async get(id: string): Promise<Incident | undefined> {
    if (this.useMongo()) {
      const doc = await IncidentModel.findOne({ id }).lean();
      if (doc) { const inc = { ...doc, _id: undefined, __v: undefined } as any; delete inc._id; delete inc.__v; this.cache.set(id, inc); return inc; }
      return undefined;
    }
    return this.cache.get(id);
  }

  async list(limit = 50, orgId?: string): Promise<Incident[]> {
    if (this.useMongo()) {
      const filter: any = orgId ? { orgId } : { orgId: '__none__' };
      const docs = await IncidentModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
      return docs.map((d: any) => { delete d._id; delete d.__v; return d as Incident; });
    }
    let items = Array.from(this.cache.values());
    items = items.filter((i: any) => i.orgId === orgId);
    return items
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  async addAudit(incidentId: string, entry: Omit<AuditEntry, 'id' | 'incidentId' | 'timestamp'>): Promise<void> {
    const auditEntry = { ...entry, id: uuidv4(), incidentId, timestamp: new Date().toISOString() };
    // Update cache
    const cached = this.cache.get(incidentId);
    if (cached) {
      if (!cached.auditLog) cached.auditLog = [];
      cached.auditLog.push(auditEntry);
    }
    if (this.useMongo()) {
      await IncidentModel.updateOne({ id: incidentId }, { $push: { auditLog: auditEntry } });
    }
  }

  async updateStatus(id: string, status: IncidentStatus, userId?: string, username?: string): Promise<Incident | undefined> {
    const incident = await this.get(id);
    if (!incident) return undefined;
    const prevStatus = incident.status;
    incident.status = status;
    incident.updatedAt = new Date().toISOString();
    if (status === 'acknowledged' && !incident.acknowledgedAt) {
      incident.acknowledgedAt = incident.updatedAt;
      incident.timeToAckMs = new Date(incident.acknowledgedAt).getTime() - new Date(incident.createdAt).getTime();
    }
    if (status === 'resolved') {
      incident.resolvedAt = incident.updatedAt;
      incident.timeToResolveMs = new Date(incident.resolvedAt).getTime() - new Date(incident.createdAt).getTime();
    }
    this.cache.set(id, incident);
    if (this.useMongo()) {
      await IncidentModel.findOneAndUpdate({ id }, incident);
    }
    await this.addAudit(id, { userId: userId || 'system', username: username || 'system', action: 'status_change', fromValue: prevStatus, toValue: status });
    sseEmitter.emit('incident:updated', incident);
    return incident;
  }

  async updatePagerDutyStatus(dedupKey: string, pdStatus: 'triggered' | 'acknowledged' | 'resolved'): Promise<Incident | undefined> {
    let incident: Incident | undefined;
    if (this.useMongo()) {
      const doc = await IncidentModel.findOne({ 'pagerduty.dedupKey': dedupKey }).lean();
      if (doc) { delete (doc as any)._id; delete (doc as any).__v; incident = doc as any; }
    } else {
      for (const inc of this.cache.values()) {
        if (inc.pagerduty?.dedupKey === dedupKey) { incident = inc; break; }
      }
    }
    if (!incident || !incident.pagerduty) return undefined;

    incident.pagerduty.status = pdStatus;
    if (pdStatus === 'acknowledged') {
      incident.pagerduty.acknowledgedAt = new Date().toISOString();
      if (incident.status === 'open') incident.status = 'acknowledged';
    }
    if (pdStatus === 'resolved') {
      incident.pagerduty.resolvedAt = new Date().toISOString();
      if (incident.status !== 'resolved') {
        incident.status = 'resolved';
        incident.resolvedAt = new Date().toISOString();
        incident.timeToResolveMs = new Date(incident.resolvedAt).getTime() - new Date(incident.createdAt).getTime();
      }
    }
    incident.updatedAt = new Date().toISOString();
    this.cache.set(incident.id, incident);
    if (this.useMongo()) {
      await IncidentModel.findOneAndUpdate({ id: incident.id }, incident);
    }
    return incident;
  }

  async completeRunbookStep(incidentId: string, stepOrder: number): Promise<Incident | undefined> {
    const incident = await this.get(incidentId);
    if (!incident || !incident.runbook) return undefined;
    if (!incident.runbook.completedSteps.includes(stepOrder)) {
      incident.runbook.completedSteps.push(stepOrder);
      incident.runbook.completedSteps.sort((a, b) => a - b);
    }
    incident.updatedAt = new Date().toISOString();
    this.cache.set(incidentId, incident);
    if (this.useMongo()) {
      await IncidentModel.findOneAndUpdate({ id: incidentId }, incident);
    }
    sseEmitter.emit('incident:updated', incident);
    return incident;
  }

  async assignTeam(incidentId: string, teamId: string | null, teamName: string | null, userId?: string, username?: string): Promise<Incident | undefined> {
    const incident = await this.get(incidentId);
    if (!incident) return undefined;
    const prevTeam = incident.assignedTeamName || 'none';
    incident.assignedTeamId = teamId || undefined;
    incident.assignedTeamName = teamName || undefined;
    incident.updatedAt = new Date().toISOString();
    this.cache.set(incidentId, incident);
    if (this.useMongo()) {
      await IncidentModel.findOneAndUpdate({ id: incidentId }, { assignedTeamId: incident.assignedTeamId || null, assignedTeamName: incident.assignedTeamName || null, updatedAt: incident.updatedAt });
    }
    await this.addAudit(incidentId, { userId: userId || 'system', username: username || 'system', action: 'assigned', details: teamName ? `Assigned to team "${teamName}"` : 'Unassigned team', fromValue: prevTeam, toValue: teamName || 'none' });
    sseEmitter.emit('incident:updated', incident);
    return incident;
  }

  // --- Comments ---

  async addComment(incidentId: string, author: string, text: string, userId?: string): Promise<Comment | undefined> {
    const incident = await this.get(incidentId);
    if (!incident) return undefined;
    if (!incident.comments) incident.comments = [];
    const mentions = (text.match(/@(\w+)/g) || []).map(m => m.slice(1));
    const comment: Comment = {
      id: uuidv4(),
      incidentId,
      author,
      text,
      mentions: mentions.length > 0 ? mentions : undefined,
      createdAt: new Date().toISOString(),
    };
    incident.comments.push(comment);
    incident.updatedAt = new Date().toISOString();
    this.cache.set(incidentId, incident);
    if (this.useMongo()) {
      await IncidentModel.updateOne({ id: incidentId }, { $push: { comments: comment }, $set: { updatedAt: incident.updatedAt } });
    }
    await this.addAudit(incidentId, { userId: userId || 'system', username: author, action: 'commented', details: text.slice(0, 100) });
    sseEmitter.emit('incident:commented', { incidentId, comment });
    return comment;
  }

  async getComments(incidentId: string): Promise<Comment[]> {
    const inc = await this.get(incidentId);
    return inc?.comments || [];
  }

  // --- Alert Grouping ---

  async getGroups(orgId?: string): Promise<AlertGroup[]> {
    const incidents = await this.list(1000, orgId);
    const groups = new Map<string, AlertGroup>();
    for (const inc of incidents) {
      const key = `${inc.service || 'unknown'}::${inc.analysis.rootCause.category}`;
      const existing = groups.get(key);
      if (existing) {
        existing.count++;
        existing.incidents.push(inc.id);
        if (new Date(inc.createdAt) > new Date(existing.updatedAt)) {
          existing.updatedAt = inc.createdAt;
          existing.latestIncidentId = inc.id;
        }
        const sevOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
        if ((sevOrder[inc.analysis.severity] || 0) > (sevOrder[existing.severity] || 0)) {
          existing.severity = inc.analysis.severity;
        }
      } else {
        groups.set(key, {
          groupId: key,
          service: inc.service || 'unknown',
          category: inc.analysis.rootCause.category,
          count: 1,
          latestIncidentId: inc.id,
          incidents: [inc.id],
          severity: inc.analysis.severity,
          createdAt: inc.createdAt,
          updatedAt: inc.createdAt,
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  // --- SLA Metrics ---

  async getSLAMetrics(orgId?: string): Promise<SLAMetrics> {
    const incidents = await this.list(1000, orgId);
    const resolveTimes: number[] = [];
    const ackTimes: number[] = [];
    let slaBreaches = 0;
    const SLA_ACK_MS = 15 * 60 * 1000;
    const SLA_RESOLVE_MS = 4 * 60 * 60 * 1000;

    for (const inc of incidents) {
      if (inc.timeToAckMs != null) {
        ackTimes.push(inc.timeToAckMs);
        if (inc.timeToAckMs > SLA_ACK_MS) slaBreaches++;
      }
      if (inc.timeToResolveMs != null) {
        resolveTimes.push(inc.timeToResolveMs);
        if (inc.timeToResolveMs > SLA_RESOLVE_MS) slaBreaches++;
      }
    }

    const percentile = (arr: number[], p: number) => {
      if (arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const idx = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, idx)];
    };
    const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;

    return {
      avgTimeToAckMs: avg(ackTimes),
      avgTimeToResolveMs: avg(resolveTimes),
      p50TimeToResolveMs: percentile(resolveTimes, 50),
      p95TimeToResolveMs: percentile(resolveTimes, 95),
      slaBreaches,
      totalResolved: resolveTimes.length,
      totalAcknowledged: ackTimes.length,
    };
  }

  async getStats(orgId?: string): Promise<{
    total: number;
    bySeverity: Record<string, number>;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
    byService: Record<string, number>;
    avgTimeToResolveMs: number;
  }> {
    const incidents = await this.list(1000, orgId);
    const bySeverity: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    const byService: Record<string, number> = {};
    let totalResolveTime = 0;
    let resolvedCount = 0;

    for (const inc of incidents) {
      bySeverity[inc.analysis.severity] = (bySeverity[inc.analysis.severity] || 0) + 1;
      byStatus[inc.status] = (byStatus[inc.status] || 0) + 1;
      const cat = inc.analysis.rootCause.category;
      byCategory[cat] = (byCategory[cat] || 0) + 1;
      if (inc.service) {
        byService[inc.service] = (byService[inc.service] || 0) + 1;
      }
      if (inc.timeToResolveMs) {
        totalResolveTime += inc.timeToResolveMs;
        resolvedCount++;
      }
    }

    return {
      total: incidents.length,
      bySeverity,
      byStatus,
      byCategory,
      byService,
      avgTimeToResolveMs: resolvedCount > 0 ? Math.round(totalResolveTime / resolvedCount) : 0,
    };
  }

  async clear(orgId?: string): Promise<void> {
    if (orgId) {
      for (const [k, v] of this.cache) { if ((v as any).orgId === orgId) this.cache.delete(k); }
      if (this.useMongo()) await IncidentModel.deleteMany({ orgId });
    } else {
      this.cache.clear();
      if (this.useMongo()) await IncidentModel.deleteMany({});
    }
  }
}
