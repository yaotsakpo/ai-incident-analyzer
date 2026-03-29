import { describe, it, expect, beforeEach } from 'vitest';

// Stub out mongoose so the store always uses in-memory cache
import { vi } from 'vitest';
vi.mock('../db/connection', () => ({ isConnected: () => false }));
vi.mock('../db/models', () => ({}));

import { NotificationStore } from './notification-store';

describe('NotificationStore (in-memory)', () => {
  let store: NotificationStore;

  beforeEach(() => {
    store = new NotificationStore();
  });

  it('creates a notification and lists it for the user', async () => {
    await store.create('org1', 'user1', 'incident_created', 'New Incident', 'body', '/link');
    const list = await store.listForUser('user1', 'org1');
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('New Incident');
    expect(list[0].read).toBe(false);
  });

  it('does not return notifications for other users', async () => {
    await store.create('org1', 'user1', 'mention', 'Mentioned', '', '');
    const list = await store.listForUser('user2', 'org1');
    expect(list).toHaveLength(0);
  });

  it('marks a notification as read', async () => {
    const notif = await store.create('org1', 'user1', 'comment', 'Comment', '', '');
    await store.markRead(notif.id, 'user1');
    const list = await store.listForUser('user1', 'org1');
    expect(list[0].read).toBe(true);
  });

  it('marks all notifications as read for a user', async () => {
    await store.create('org1', 'user1', 'incident_created', 'A', '', '');
    await store.create('org1', 'user1', 'incident_status', 'B', '', '');
    await store.markAllRead('user1');
    const count = await store.unreadCount('user1', 'org1');
    expect(count).toBe(0);
  });

  it('counts unread correctly', async () => {
    await store.create('org1', 'user1', 'incident_created', 'A', '', '');
    await store.create('org1', 'user1', 'escalated', 'B', '', '');
    const notif = await store.create('org1', 'user1', 'assigned', 'C', '', '');
    await store.markRead(notif.id, 'user1');
    const count = await store.unreadCount('user1', 'org1');
    expect(count).toBe(2);
  });

  it('clearForOrg removes only that org notifications', async () => {
    await store.create('org1', 'user1', 'incident_created', 'A', '', '');
    await store.create('org2', 'user1', 'incident_created', 'B', '', '');
    await store.clearForOrg('org1');
    const org1 = await store.listForUser('user1', 'org1');
    const org2 = await store.listForUser('user1', 'org2');
    expect(org1).toHaveLength(0);
    expect(org2).toHaveLength(1);
  });

  it('clear removes all notifications', async () => {
    await store.create('org1', 'user1', 'incident_created', 'A', '', '');
    await store.create('org2', 'user2', 'incident_created', 'B', '', '');
    await store.clear();
    const list1 = await store.listForUser('user1');
    const list2 = await store.listForUser('user2');
    expect(list1).toHaveLength(0);
    expect(list2).toHaveLength(0);
  });

  it('respects limit parameter', async () => {
    for (let i = 0; i < 10; i++) {
      await store.create('org1', 'user1', 'incident_created', `N${i}`, '', '');
    }
    const list = await store.listForUser('user1', 'org1', 3);
    expect(list).toHaveLength(3);
  });
});
