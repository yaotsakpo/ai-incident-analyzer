import { z } from 'zod';

// --- Auth ---

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const registerSchema = z.object({
  username: z.string().min(2, 'Username must be at least 2 characters').max(50),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  displayName: z.string().min(1, 'Display name is required').max(100),
  email: z.string().email().optional().or(z.literal('')),
});

export const createUserSchema = z.object({
  username: z.string().min(2).max(50),
  displayName: z.string().min(1).max(100),
  role: z.enum(['viewer', 'responder', 'admin', 'custom']),
  email: z.string().email().optional().or(z.literal('')),
  teamId: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['viewer', 'responder', 'admin', 'custom']),
  permissions: z.array(z.string()).optional(),
});

export const changePasswordSchema = z.object({
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

export const switchOrgSchema = z.object({
  orgId: z.string().min(1, 'Org ID is required'),
});

// --- Incidents ---

export const updateStatusSchema = z.object({
  status: z.enum(['open', 'acknowledged', 'investigating', 'resolved']),
});

export const addCommentSchema = z.object({
  author: z.string().min(1, 'Author is required'),
  text: z.string().min(1, 'Comment text is required').max(5000),
});

export const assignTeamSchema = z.object({
  teamId: z.string().nullable(),
});

// --- Analysis ---

export const analyzeSchema = z.object({
  logs: z.array(z.object({
    timestamp: z.string().optional(),
    level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']),
    service: z.string().optional(),
    message: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })).optional(),
  errorMessages: z.array(z.string()).optional(),
  context: z.string().optional(),
}).refine(data => (data.logs && data.logs.length > 0) || (data.errorMessages && data.errorMessages.length > 0), {
  message: 'At least one log entry or error message is required',
});

// --- Anomaly ---

export const anomalySchema = z.object({
  logs: z.array(z.object({
    timestamp: z.string().optional(),
    level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']),
    service: z.string().optional(),
    message: z.string(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })).min(1, 'At least one log entry is required'),
  baseline: z.object({
    errorRateThreshold: z.number().min(0).max(1).optional(),
    frequencyThreshold: z.number().min(0).optional(),
  }).optional(),
});

// --- Runbooks ---

export const createRunbookSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  description: z.string().max(2000).default(''),
  category: z.string().min(1, 'Category is required').max(100),
  tags: z.array(z.string()).default([]),
  estimatedTimeMinutes: z.number().min(0).default(0),
  steps: z.array(z.object({
    order: z.number().int().min(0),
    title: z.string().min(1),
    description: z.string().default(''),
    command: z.string().optional(),
    expectedOutcome: z.string().optional(),
    isAutomatable: z.boolean().default(false),
  })).min(1, 'At least one step is required'),
});

// --- Teams ---

export const createTeamSchema = z.object({
  name: z.string().min(1, 'Team name is required').max(100),
  description: z.string().max(500).default(''),
});

export const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export const addMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  role: z.enum(['owner', 'admin', 'member']).default('member'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'member']),
});

// --- Org ---

export const updateOrgSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(100),
});
