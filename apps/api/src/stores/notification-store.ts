import { v4 as uuidv4 } from 'uuid';
import { NotificationModel } from '../db/models';
import { isConnected } from '../db/connection';

export interface Notification {
  id: string;
  orgId: string;
  userId: string;
  type: 'incident_created' | 'incident_status' | 'mention' | 'assigned' | 'escalated' | 'comment';
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export class NotificationStore {
  private cache: Notification[] = [];

  private useMongo(): boolean { return isConnected(); }

  async create(orgId: string, userId: string, type: Notification['type'], title: string, body: string = '', link: string = ''): Promise<Notification> {
    const notif: Notification = {
      id: uuidv4(),
      orgId,
      userId,
      type,
      title,
      body,
      link,
      read: false,
      createdAt: new Date().toISOString(),
    };
    if (this.useMongo()) {
      await NotificationModel.create(notif);
    }
    this.cache.push(notif);
    return notif;
  }

  async createForAllUsers(orgId: string, userIds: string[], type: Notification['type'], title: string, body: string = '', link: string = ''): Promise<void> {
    for (const userId of userIds) {
      await this.create(orgId, userId, type, title, body, link);
    }
  }

  async listForUser(userId: string, orgId?: string, limit = 50): Promise<Notification[]> {
    if (this.useMongo()) {
      const filter: any = { userId };
      if (orgId) filter.orgId = orgId;
      const docs = await NotificationModel.find(filter).sort({ createdAt: -1 }).limit(limit).lean();
      return docs.map((d: any) => {
        const { _id, __v, ...n } = d;
        return n as Notification;
      });
    }
    let items = this.cache.filter(n => n.userId === userId);
    if (orgId) items = items.filter(n => n.orgId === orgId);
    return items
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async markRead(notifId: string, userId: string): Promise<boolean> {
    if (this.useMongo()) {
      const res = await NotificationModel.findOneAndUpdate({ id: notifId, userId }, { read: true });
      if (!res) return false;
    }
    const n = this.cache.find(n => n.id === notifId && n.userId === userId);
    if (n) n.read = true;
    return true;
  }

  async markAllRead(userId: string): Promise<void> {
    if (this.useMongo()) {
      await NotificationModel.updateMany({ userId, read: false }, { read: true });
    }
    this.cache.filter(n => n.userId === userId).forEach(n => n.read = true);
  }

  async unreadCount(userId: string, orgId?: string): Promise<number> {
    if (this.useMongo()) {
      const filter: any = { userId, read: false };
      if (orgId) filter.orgId = orgId;
      return NotificationModel.countDocuments(filter);
    }
    let items = this.cache.filter(n => n.userId === userId && !n.read);
    if (orgId) items = items.filter(n => n.orgId === orgId);
    return items.length;
  }

  async clear(): Promise<void> {
    if (this.useMongo()) {
      await NotificationModel.deleteMany({});
    }
    this.cache = [];
  }
}
