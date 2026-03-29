import { Router, Request, Response } from 'express';
import { UserStore } from '../stores/user-store';
import { UserPreferenceModel } from '../db/models';
import { isConnected } from '../db/connection';

const DEFAULTS = {
  pagerdutyKey: '',
  autoRefreshInterval: 15,
  theme: 'dark',
  notifyOnCritical: true,
  notifyOnEscalation: true,
  defaultSeverityFilter: 'all',
  tablePageSize: 12,
};

// In-memory fallback for when MongoDB is unavailable
const memoryPrefs = new Map<string, Record<string, any>>();

function extractUser(req: Request, userStore: UserStore) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return userStore.validateToken(header.slice(7));
}

export function preferencesRoutes(userStore: UserStore): Router {
  const router = Router();

  // GET /settings/preferences — returns current user's preferences
  router.get('/', async (req: Request, res: Response) => {
    const user = extractUser(req, userStore);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    if (isConnected()) {
      const doc = await UserPreferenceModel.findOne({ userId: user.id }).lean();
      if (doc) {
        const { _id, __v, userId, ...prefs } = doc as any;
        return res.json({ ...DEFAULTS, ...prefs });
      }
    } else {
      const cached = memoryPrefs.get(user.id);
      if (cached) return res.json({ ...DEFAULTS, ...cached });
    }

    return res.json(DEFAULTS);
  });

  // PUT /settings/preferences — update current user's preferences
  router.put('/', async (req: Request, res: Response) => {
    const user = extractUser(req, userStore);
    if (!user) return res.status(401).json({ error: 'Not authenticated' });

    const allowed = ['pagerdutyKey', 'autoRefreshInterval', 'theme', 'notifyOnCritical', 'notifyOnEscalation', 'defaultSeverityFilter', 'tablePageSize'];
    const update: Record<string, any> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    if (isConnected()) {
      await UserPreferenceModel.findOneAndUpdate(
        { userId: user.id },
        { userId: user.id, ...update },
        { upsert: true, returnDocument: 'after' }
      );
      const doc = await UserPreferenceModel.findOne({ userId: user.id }).lean();
      const { _id, __v, userId: _, ...prefs } = doc as any;
      return res.json({ ...DEFAULTS, ...prefs });
    } else {
      const existing = memoryPrefs.get(user.id) || {};
      const merged = { ...existing, ...update };
      memoryPrefs.set(user.id, merged);
      return res.json({ ...DEFAULTS, ...merged });
    }
  });

  return router;
}
