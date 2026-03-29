import { User, UserRole } from '@incident-analyzer/shared';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserModel, OrganizationModel, OrgMembershipModel } from '../db/models';
import { isConnected } from '../db/connection';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'incident-analyzer-jwt-secret-change-in-production';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const DEMO_ORG_ID = 'demo-org';

const DEMO_USERS: Array<{ username: string; password: string; displayName: string; role: UserRole; email: string }> = [
  { username: 'admin', password: 'admin123', displayName: 'Admin User', role: 'admin', email: 'admin@example.com' },
  { username: 'responder', password: 'resp123', displayName: 'On-Call Engineer', role: 'responder', email: 'oncall@example.com' },
  { username: 'viewer', password: 'view123', displayName: 'Team Viewer', role: 'viewer', email: 'viewer@example.com' },
];

interface RefreshTokenEntry {
  userId: string;
  orgId: string;
  expiresAt: number;
}

export class UserStore {
  private cache: Map<string, User & { password: string }> = new Map();
  private tokens: Map<string, string> = new Map(); // legacy token -> userId (kept for migration)
  private revokedTokens: Set<string> = new Set(); // JWT blacklist for logout
  private refreshTokens: Map<string, RefreshTokenEntry> = new Map(); // refreshToken -> entry

  private useMongo(): boolean { return isConnected(); }

  private initialized: Promise<void>;

  constructor() {
    // Seed in-memory cache with hashed passwords
    this.initialized = this.initCache();
  }

  private async initCache(): Promise<void> {
    for (const u of DEMO_USERS) {
      const id = uuidv4();
      const hashed = await bcrypt.hash(u.password, SALT_ROUNDS);
      this.cache.set(id, { id, orgId: DEMO_ORG_ID, ...u, password: hashed, onboardingComplete: true, createdAt: new Date().toISOString() } as any);
    }
  }

  async ensureReady(): Promise<void> {
    await this.initialized;
  }

  async seedMongo(): Promise<void> {
    if (!this.useMongo()) return;
    await this.ensureReady();

    // Backfill orgId on any old users/data that predate multi-tenancy
    await UserModel.updateMany({ orgId: { $exists: false } }, { $set: { orgId: DEMO_ORG_ID } });
    const { IncidentModel, RunbookModel, TeamModel, SettingsModel, NotificationModel, AuditLogModel } = require('../db/models');
    await IncidentModel.updateMany({ orgId: { $exists: false } }, { $set: { orgId: DEMO_ORG_ID } });
    await RunbookModel.updateMany({ orgId: { $exists: false } }, { $set: { orgId: DEMO_ORG_ID } });
    await TeamModel.updateMany({ orgId: { $exists: false } }, { $set: { orgId: DEMO_ORG_ID } });
    await NotificationModel.updateMany({ orgId: { $exists: false } }, { $set: { orgId: DEMO_ORG_ID } });
    await AuditLogModel.updateMany({ orgId: { $exists: false } }, { $set: { orgId: DEMO_ORG_ID } });

    // Migrate any plaintext passwords to bcrypt hashes
    const allUsers = await UserModel.find({}).lean();
    for (const u of allUsers) {
      const pw = (u as any).password;
      if (pw && !pw.startsWith('$2a$') && !pw.startsWith('$2b$')) {
        const hashed = await bcrypt.hash(pw, SALT_ROUNDS);
        await UserModel.updateOne({ id: (u as any).id }, { $set: { password: hashed } });
      }
    }

    const count = await UserModel.countDocuments();
    if (count > 0) return; // already seeded
    for (const u of this.cache.values()) {
      await UserModel.findOneAndUpdate({ username: u.username }, u, { upsert: true, returnDocument: 'after' });
    }
  }

  /** Generate an access + refresh token pair for a user */
  private issueTokenPair(userId: string, orgId: string): { token: string; refreshToken: string } {
    const token = jwt.sign({ userId, orgId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = uuidv4();
    this.refreshTokens.set(refreshToken, { userId, orgId, expiresAt: Date.now() + REFRESH_TOKEN_EXPIRY_MS });
    // Prune expired refresh tokens periodically
    if (this.refreshTokens.size > 5000) {
      const now = Date.now();
      for (const [k, v] of this.refreshTokens) { if (v.expiresAt < now) this.refreshTokens.delete(k); }
    }
    return { token, refreshToken };
  }

  async authenticate(username: string, password: string): Promise<{ user: User; token: string; refreshToken: string } | null> {
    await this.ensureReady();
    if (this.useMongo()) {
      const doc = await UserModel.findOne({ username }).lean();
      if (doc) {
        const match = await bcrypt.compare(password, (doc as any).password);
        if (!match) return null;
        const { password: pw, _id, __v, ...user } = doc as any;
        const pair = this.issueTokenPair(doc.id, user.orgId);
        this.cache.set(doc.id, { ...user, password: pw });
        return { user, ...pair };
      }
      return null;
    }
    for (const u of this.cache.values()) {
      if (u.username === username) {
        const match = await bcrypt.compare(password, u.password);
        if (!match) continue;
        const { password: _, ...user } = u;
        const pair = this.issueTokenPair(u.id, u.orgId);
        return { user, ...pair };
      }
    }
    return null;
  }

  /** Validate a refresh token and issue a new token pair (rotation) */
  async refreshAccessToken(refreshToken: string): Promise<{ user: User; token: string; refreshToken: string } | null> {
    const entry = this.refreshTokens.get(refreshToken);
    if (!entry || entry.expiresAt < Date.now()) {
      if (entry) this.refreshTokens.delete(refreshToken);
      return null;
    }
    // Rotate: delete old, issue new pair
    this.refreshTokens.delete(refreshToken);
    const user = await this.getUser(entry.userId);
    if (!user) return null;
    const pair = this.issueTokenPair(entry.userId, entry.orgId);
    return { user, ...pair };
  }

  validateToken(token: string): User | null {
    // Check blacklist
    if (this.revokedTokens.has(token)) return null;

    // Try JWT first
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string; orgId: string };
      const u = this.cache.get(payload.userId);
      if (u) {
        const { password: _, ...user } = u;
        return user;
      }
      // User not in cache — will be loaded async by ensureUserCached
      return null;
    } catch {
      // Fallback: legacy UUID token (for sessions created before JWT migration)
      const userId = this.tokens.get(token);
      if (!userId) return null;
      const u = this.cache.get(userId);
      if (!u) return null;
      const { password: _, ...user } = u;
      return user;
    }
  }

  /** Async token validation — loads user from DB if not cached */
  async validateTokenAsync(token: string): Promise<User | null> {
    if (this.revokedTokens.has(token)) return null;
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string; orgId: string };
      const cached = this.cache.get(payload.userId);
      if (cached) {
        const { password: _, ...user } = cached;
        return user;
      }
      // Load from DB
      if (this.useMongo()) {
        const doc = await UserModel.findOne({ id: payload.userId }).lean();
        if (doc) {
          const { password: pw, _id, __v, ...user } = doc as any;
          this.cache.set(payload.userId, { ...user, password: pw });
          return user;
        }
      }
      return null;
    } catch {
      const userId = this.tokens.get(token);
      if (!userId) return null;
      const u = this.cache.get(userId);
      if (!u) return null;
      const { password: _, ...user } = u;
      return user;
    }
  }

  logout(token: string, refreshToken?: string): void {
    this.tokens.delete(token);
    this.revokedTokens.add(token);
    if (refreshToken) this.refreshTokens.delete(refreshToken);
    // Prune old entries periodically (simple size cap)
    if (this.revokedTokens.size > 10000) {
      const entries = Array.from(this.revokedTokens);
      this.revokedTokens = new Set(entries.slice(-5000));
    }
  }

  async getUser(id: string): Promise<User | undefined> {
    if (this.useMongo()) {
      const doc = await UserModel.findOne({ id }).lean();
      if (doc) { const { password: _, _id, __v, ...user } = doc as any; return user; }
      return undefined;
    }
    const u = this.cache.get(id);
    if (!u) return undefined;
    const { password: _, ...user } = u;
    return user;
  }

  async listUsers(orgId?: string): Promise<User[]> {
    if (this.useMongo()) {
      const filter = orgId ? { orgId } : { orgId: '__none__' };
      const docs = await UserModel.find(filter).lean();
      return docs.map((d: any) => { const { password: _, _id, __v, ...user } = d; return user; });
    }
    let users = Array.from(this.cache.values());
    users = users.filter(u => (u as any).orgId === orgId);
    return users.map(({ password: _, ...u }) => u);
  }

  async updateProfile(id: string, data: { displayName?: string; username?: string; onboardingComplete?: boolean }): Promise<User | null> {
    // If username is changing, check global uniqueness
    if (data.username) {
      const existing = await this.getUserByUsername(data.username);
      if (existing && existing.id !== id) return { __usernameTaken: true } as any;
    }

    const updateData: any = {};
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.username !== undefined) updateData.username = data.username;
    if (data.onboardingComplete !== undefined) updateData.onboardingComplete = data.onboardingComplete;

    if (this.useMongo()) {
      const doc = await UserModel.findOneAndUpdate({ id }, updateData, { returnDocument: 'after' }).lean();
      if (!doc) return null;
      const { password: pw, _id, __v, ...user } = doc as any;
      const cached = this.cache.get(id);
      if (cached) Object.assign(cached, updateData);
      return user;
    }
    const cached = this.cache.get(id);
    if (!cached) return null;
    Object.assign(cached, updateData);
    const { password: _, ...user } = cached;
    return user;
  }

  async resetPassword(userId: string): Promise<string | null> {
    // Generate a random 10-char temporary password
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let tempPw = '';
    for (let i = 0; i < 10; i++) tempPw += chars[Math.floor(Math.random() * chars.length)];
    const hashed = await bcrypt.hash(tempPw, SALT_ROUNDS);

    if (this.useMongo()) {
      const doc = await UserModel.findOneAndUpdate(
        { id: userId },
        { password: hashed, mustChangePassword: true },
        { returnDocument: 'after' }
      ).lean();
      if (!doc) return null;
      const cached = this.cache.get(userId);
      if (cached) { cached.password = hashed; (cached as any).mustChangePassword = true; }
      return tempPw;
    }
    const cached = this.cache.get(userId);
    if (!cached) return null;
    cached.password = hashed;
    (cached as any).mustChangePassword = true;
    return tempPw;
  }

  async changePassword(userId: string, newPassword: string): Promise<boolean> {
    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    if (this.useMongo()) {
      const doc = await UserModel.findOneAndUpdate(
        { id: userId },
        { password: hashed, mustChangePassword: false },
        { returnDocument: 'after' }
      ).lean();
      if (!doc) return false;
      const cached = this.cache.get(userId);
      if (cached) { cached.password = hashed; (cached as any).mustChangePassword = false; }
      return true;
    }
    const cached = this.cache.get(userId);
    if (!cached) return false;
    cached.password = hashed;
    (cached as any).mustChangePassword = false;
    return true;
  }

  async updateUserRole(userId: string, role: UserRole, permissions?: string[]): Promise<User | null> {
    const update: any = { role };
    if (role === 'custom' && permissions) {
      update.permissions = permissions;
    } else {
      update.permissions = undefined;
    }

    if (this.useMongo()) {
      const doc = await UserModel.findOneAndUpdate(
        { id: userId },
        role === 'custom' ? { role, permissions: permissions || [] } : { role, $unset: { permissions: 1 } },
        { returnDocument: 'after' }
      ).lean();
      if (!doc) return null;
      const cached = this.cache.get(userId);
      if (cached) { (cached as any).role = role; (cached as any).permissions = role === 'custom' ? (permissions || []) : undefined; }
      const { _id, __v, password: _, ...user } = doc as any;
      return user;
    }
    const cached = this.cache.get(userId);
    if (!cached) return null;
    (cached as any).role = role;
    (cached as any).permissions = role === 'custom' ? (permissions || []) : undefined;
    const { password: _, ...user } = cached as any;
    return user;
  }

  async createUser(data: { username: string; password: string; displayName: string; role: UserRole; email?: string; orgId: string; permissions?: string[] }): Promise<User | null> {
    const existing = await this.getUserByUsername(data.username);
    if (existing) return null;

    const id = uuidv4();
    const now = new Date().toISOString();
    const hashed = await bcrypt.hash(data.password, SALT_ROUNDS);
    const userRecord: any = { id, orgId: data.orgId, username: data.username, password: hashed, displayName: data.displayName, role: data.role, email: data.email || '', mustChangePassword: true, createdAt: now };
    if (data.role === 'custom' && data.permissions) {
      userRecord.permissions = data.permissions;
    }

    if (this.useMongo()) {
      await UserModel.create(userRecord);
    }
    this.cache.set(id, userRecord);
    const { password: _, ...user } = userRecord;
    return user;
  }

  async register(data: { username: string; password: string; displayName: string; email?: string }): Promise<User | null> {
    // Check if username already taken
    const existing = await this.getUserByUsername(data.username);
    if (existing) return null;

    const orgId = uuidv4();
    const id = uuidv4();
    const now = new Date().toISOString();

    // Create the organization
    const org = { id: orgId, name: `${data.displayName}'s Org`, createdBy: id, createdAt: now };
    if (this.useMongo()) {
      await OrganizationModel.create(org);
    }

    const hashed = await bcrypt.hash(data.password, SALT_ROUNDS);
    const userRecord = { id, orgId, username: data.username, password: hashed, displayName: data.displayName, role: 'admin' as UserRole, email: data.email || '', onboardingComplete: false, createdAt: now };

    if (this.useMongo()) {
      await UserModel.create(userRecord);
      // Create org membership record for multi-org tracking
      await OrgMembershipModel.create({ userId: id, orgId, role: 'admin', joinedAt: now });
    }
    this.cache.set(id, userRecord);
    const { password: _, ...user } = userRecord;
    return user;
  }

  async deleteUser(userId: string): Promise<boolean> {
    if (this.useMongo()) {
      const result = await UserModel.deleteOne({ id: userId });
      if (result.deletedCount === 0) return false;
    }
    this.cache.delete(userId);
    // Invalidate any tokens for this user
    for (const [token, uid] of this.tokens) {
      if (uid === userId) this.tokens.delete(token);
    }
    return true;
  }

  // --- Multi-org methods ---

  async getOrgMemberships(userId: string): Promise<Array<{ orgId: string; orgName: string; role: UserRole; joinedAt: string }>> {
    if (!this.useMongo()) return [];
    const memberships = await OrgMembershipModel.find({ userId }).lean();
    const result: Array<{ orgId: string; orgName: string; role: UserRole; joinedAt: string }> = [];
    for (const m of memberships) {
      const org = await OrganizationModel.findOne({ id: (m as any).orgId }).lean();
      result.push({
        orgId: (m as any).orgId,
        orgName: (org as any)?.name || 'Unknown',
        role: (m as any).role as UserRole,
        joinedAt: (m as any).joinedAt,
      });
    }
    return result;
  }

  async switchOrg(userId: string, targetOrgId: string): Promise<{ user: User; token: string } | null> {
    if (!this.useMongo()) return null;
    // Verify membership
    const membership = await OrgMembershipModel.findOne({ userId, orgId: targetOrgId }).lean();
    if (!membership) return null;

    // Update active orgId and role from membership
    const memberRole = (membership as any).role as UserRole;
    const memberPerms = (membership as any).permissions;
    const updateData: any = { orgId: targetOrgId, role: memberRole };
    if (memberPerms) updateData.permissions = memberPerms;

    const doc = await UserModel.findOneAndUpdate({ id: userId }, updateData, { returnDocument: 'after' }).lean();
    if (!doc) return null;

    const { password: pw, _id, __v, ...user } = doc as any;
    this.cache.set(userId, { ...user, password: pw });

    const pair = this.issueTokenPair(userId, targetOrgId);
    return { user, ...pair };
  }

  async addOrgMembership(userId: string, orgId: string, role: UserRole): Promise<boolean> {
    if (!this.useMongo()) return false;
    const now = new Date().toISOString();
    try {
      await OrgMembershipModel.findOneAndUpdate(
        { userId, orgId },
        { userId, orgId, role, joinedAt: now },
        { upsert: true }
      );
      return true;
    } catch { return false; }
  }

  async removeOrgMembership(userId: string, orgId: string): Promise<boolean> {
    if (!this.useMongo()) return false;
    const result = await OrgMembershipModel.deleteOne({ userId, orgId });
    return result.deletedCount > 0;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (this.useMongo()) {
      const doc = await UserModel.findOne({ username }).lean();
      if (doc) { const { password: _, _id, __v, ...user } = doc as any; return user; }
      return undefined;
    }
    for (const u of this.cache.values()) {
      if (u.username === username) {
        const { password: _, ...user } = u;
        return user;
      }
    }
    return undefined;
  }
}
