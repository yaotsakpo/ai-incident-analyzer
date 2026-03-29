import mongoose, { Schema, Document } from 'mongoose';

// --- Organization ---
const OrganizationSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  createdBy: { type: String, required: true },
  createdAt: { type: String, required: true },
}, { timestamps: false, versionKey: false });

export const OrganizationModel = mongoose.model('Organization', OrganizationSchema);

// --- Org Membership (multi-org support) ---
const OrgMembershipSchema = new Schema({
  userId: { type: String, required: true, index: true },
  orgId: { type: String, required: true, index: true },
  role: { type: String, required: true, default: 'viewer' },
  permissions: { type: [String], default: undefined },
  joinedAt: { type: String, required: true },
}, { timestamps: false, versionKey: false });

OrgMembershipSchema.index({ userId: 1, orgId: 1 }, { unique: true });

export const OrgMembershipModel = mongoose.model('OrgMembership', OrgMembershipSchema);

// --- Incident ---
const CommentSchema = new Schema({
  id: { type: String, required: true },
  incidentId: { type: String, required: true },
  author: { type: String, required: true },
  text: { type: String, required: true },
  mentions: [String],
  createdAt: { type: String, required: true },
}, { _id: false });

const AuditEntrySchema = new Schema({
  id: { type: String, required: true },
  incidentId: { type: String, required: true },
  userId: { type: String, required: true },
  username: { type: String, required: true },
  action: { type: String, required: true },
  fromValue: String,
  toValue: String,
  details: String,
  timestamp: { type: String, required: true },
}, { _id: false });

const PagerDutyLinkSchema = new Schema({
  incidentId: String,
  dedupKey: { type: String, required: true },
  status: { type: String, required: true },
  htmlUrl: String,
  triggeredAt: { type: String, required: true },
  acknowledgedAt: String,
  resolvedAt: String,
}, { _id: false });

const RunbookMatchSchema = new Schema({
  runbookId: { type: String, required: true },
  runbookName: { type: String, required: true },
  matchScore: { type: Number, required: true },
  matchReason: { type: String, required: true },
  completedSteps: [Number],
}, { _id: false });

const PatternSchema = new Schema({
  name: String,
  occurrences: Number,
  description: String,
}, { _id: false });

const RootCauseSchema = new Schema({
  category: String,
  description: String,
  evidence: [String],
}, { _id: false });

const AnalysisResultSchema = new Schema({
  id: String,
  timestamp: String,
  summary: String,
  rootCause: RootCauseSchema,
  recommendations: [String],
  severity: String,
  confidence: Number,
  patterns: [PatternSchema],
  analyzedLogs: Number,
  processingTimeMs: Number,
}, { _id: false });

const IncidentSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  orgId: { type: String, required: true, index: true },
  title: { type: String, required: true },
  analysis: { type: AnalysisResultSchema, required: true },
  status: { type: String, required: true, index: true },
  source: { type: String, required: true },
  service: { type: String, index: true },
  assignee: String,
  pagerduty: PagerDutyLinkSchema,
  runbook: RunbookMatchSchema,
  comments: [CommentSchema],
  auditLog: [AuditEntrySchema],
  groupId: String,
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
  acknowledgedAt: String,
  resolvedAt: String,
  timeToAckMs: Number,
  timeToResolveMs: Number,
}, { timestamps: false, versionKey: false });

export interface IIncident extends Document {
  id: string;
  title: string;
  analysis: any;
  status: string;
  source: string;
  service?: string;
  assignee?: string;
  pagerduty?: any;
  runbook?: any;
  comments?: any[];
  auditLog?: any[];
  groupId?: string;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  timeToAckMs?: number;
  timeToResolveMs?: number;
}

export const IncidentModel = mongoose.model<IIncident>('Incident', IncidentSchema);

// --- Runbook ---
const RunbookStepSchema = new Schema({
  order: Number,
  title: String,
  description: String,
  command: String,
  expectedOutcome: String,
  isAutomatable: Boolean,
}, { _id: false });

const RunbookSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  orgId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: String,
  category: String,
  tags: [String],
  steps: [RunbookStepSchema],
  estimatedTimeMinutes: Number,
  lastUpdated: String,
}, { timestamps: false, versionKey: false });

export const RunbookModel = mongoose.model('Runbook', RunbookSchema);

// --- User ---
const UserSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  orgId: { type: String, required: true, index: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  displayName: { type: String, required: true },
  role: { type: String, required: true },
  permissions: { type: [String], default: undefined },
  email: String,
  avatar: String,
  mustChangePassword: { type: Boolean, default: false },
  onboardingComplete: { type: Boolean, default: false },
  createdAt: { type: String, required: true },
}, { timestamps: false, versionKey: false });

export const UserModel = mongoose.model('User', UserSchema);

// --- Settings ---
const SettingsSchema = new Schema({
  key: { type: String, required: true, unique: true },
  orgId: { type: String, required: true, index: true },
  slack: { type: Schema.Types.Mixed },
  jira: { type: Schema.Types.Mixed },
  opsgenie: { type: Schema.Types.Mixed },
  ai: { type: Schema.Types.Mixed },
  pagerduty: { type: Schema.Types.Mixed },
}, { timestamps: false, versionKey: false });

export const SettingsModel = mongoose.model('Settings', SettingsSchema);

// --- User Preferences (per-account) ---
const UserPreferenceSchema = new Schema({
  userId: { type: String, required: true, unique: true, index: true },
  pagerdutyKey: String,
  autoRefreshInterval: { type: Number, default: 15 },
  theme: { type: String, default: 'dark' },
  notifyOnCritical: { type: Boolean, default: true },
  notifyOnEscalation: { type: Boolean, default: true },
  defaultSeverityFilter: { type: String, default: 'all' },
  tablePageSize: { type: Number, default: 12 },
}, { timestamps: false, versionKey: false });

export const UserPreferenceModel = mongoose.model('UserPreference', UserPreferenceSchema);

// --- Team ---
const TeamMemberSchema = new Schema({
  userId: { type: String, required: true },
  role: { type: String, required: true, default: 'member' }, // owner | admin | member
  joinedAt: { type: String, required: true },
}, { _id: false });

const TeamSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  orgId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  members: [TeamMemberSchema],
  integrationOverrides: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
}, { timestamps: false, versionKey: false });

export const TeamModel = mongoose.model('Team', TeamSchema);

// --- Notification ---
const NotificationSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  orgId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  type: { type: String, required: true }, // 'incident_created' | 'incident_status' | 'mention' | 'assigned' | 'escalated' | 'comment'
  title: { type: String, required: true },
  body: { type: String, default: '' },
  link: { type: String, default: '' },
  read: { type: Boolean, default: false },
  createdAt: { type: String, required: true },
}, { timestamps: false, versionKey: false });

export const NotificationModel = mongoose.model('Notification', NotificationSchema);

// --- Audit Log ---
const AuditLogSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  orgId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  action: { type: String, required: true },
  category: { type: String, required: true }, // 'integration' | 'user' | 'team' | 'auth'
  details: { type: String, default: '' },
  metadata: { type: Schema.Types.Mixed, default: {} },
  createdAt: { type: String, required: true },
}, { timestamps: false, versionKey: false });

export const AuditLogModel = mongoose.model('AuditLog', AuditLogSchema);
