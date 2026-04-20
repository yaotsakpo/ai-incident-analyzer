import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../db/connection', () => ({ isConnected: () => false }));
vi.mock('../db/models', () => ({
  UserModel: {
    findOne: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    countDocuments: vi.fn(() => 0),
    find: vi.fn(() => ({ lean: () => [] })),
    updateMany: vi.fn(),
    updateOne: vi.fn(),
    deleteOne: vi.fn(),
  },
  OrganizationModel: { create: vi.fn() },
  OrgMembershipModel: {
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
    deleteOne: vi.fn(),
    findOne: vi.fn(),
  },
  RefreshTokenModel: {
    create: vi.fn(),
    findOne: vi.fn(),
    deleteOne: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

import { UserStore } from './user-store';

describe('UserStore refresh tokens (in-memory fallback)', () => {
  let store: UserStore;

  beforeEach(async () => {
    store = new UserStore();
    await store.ensureReady();
  });

  it('issues a refresh token on authenticate', async () => {
    const result = await store.authenticate('admin', 'admin123');
    expect(result).not.toBeNull();
    expect(result!.refreshToken).toBeTruthy();
    expect(result!.token).toBeTruthy();
  });

  it('refreshes access token with valid refresh token', async () => {
    const auth = await store.authenticate('admin', 'admin123');
    const refreshed = await store.refreshAccessToken(auth!.refreshToken);
    expect(refreshed).not.toBeNull();
    expect(refreshed!.token).toBeTruthy();
    // Old refresh token should be invalidated (rotation)
    const second = await store.refreshAccessToken(auth!.refreshToken);
    expect(second).toBeNull();
  });

  it('returns null for expired or unknown refresh token', async () => {
    const result = await store.refreshAccessToken('nonexistent-token');
    expect(result).toBeNull();
  });

  it('invalidates refresh token on logout', async () => {
    const auth = await store.authenticate('admin', 'admin123');
    store.logout(auth!.token, auth!.refreshToken);
    const result = await store.refreshAccessToken(auth!.refreshToken);
    expect(result).toBeNull();
  });
});
