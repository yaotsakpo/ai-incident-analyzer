# AI Incident Analyzer

A full-stack incident management platform that analyzes logs and error messages to determine root causes, detect anomalies, auto-match runbooks, and provide actionable recommendations. Includes a React dashboard for real-time incident management and bi-directional PagerDuty integration.

## Architecture

pnpm monorepo with three packages:

```
├── apps/
│   ├── api/                         # Express.js backend
│   │   └── src/
│   │       ├── index.ts             # Server entry point
│   │       ├── routes/
│   │       │   ├── analyze.ts       # POST /analyze — creates incidents, matches runbooks
│   │       │   ├── anomaly.ts       # POST /anomaly/detect — statistical anomaly detection
│   │       │   ├── incidents.ts     # CRUD, status updates, escalation, runbook steps
│   │       │   ├── runbooks.ts      # CRUD and category-based matching
│   │       │   ├── seed.ts          # POST /seed — realistic demo data
│   │       │   └── webhooks.ts      # PagerDuty inbound webhooks
│   │       ├── services/
│   │       │   ├── analyzer.ts      # Root cause analysis engine
│   │       │   ├── anomaly-detector.ts
│   │       │   ├── pattern-detector.ts
│   │       │   └── pagerduty.ts     # PagerDuty Events API v2 integration
│   │       └── stores/
│   │           ├── incident-store.ts
│   │           └── runbook-store.ts
│   └── dashboard/                   # React + Vite frontend
│       └── src/
│           ├── App.tsx              # Sidebar nav + routing
│           ├── api.ts               # API client
│           └── pages/
│               ├── IncidentsFeed.tsx    # Filterable incident list with seed button
│               ├── IncidentDetail.tsx   # Full analysis, runbook steps, PD status
│               ├── AnomalyDashboard.tsx # Service health, top patterns, active anomalies
│               └── Analytics.tsx        # Recharts: severity/status pies, category/service bars
└── packages/
    └── shared/                      # Shared TypeScript types
        └── src/types.ts
```

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **API:** Express.js with in-memory stores
- **Dashboard:** React 18, Vite, TailwindCSS, Recharts, Lucide icons
- **Monorepo:** pnpm workspaces
- **Analysis:** Rule-based pattern matching and statistical anomaly detection
- **Integrations:** PagerDuty Events API v2 (outbound) + Webhooks v3 (inbound)
- **Runbooks:** Auto-matched by root cause category with step-by-step tracking

## How to Run Locally

```bash
# Install dependencies
pnpm install

# Build the API
pnpm --filter @incident-analyzer/api run build

# Start the API (http://localhost:3000)
pnpm --filter @incident-analyzer/api run start

# Start the dashboard (http://localhost:5173)
pnpm --filter @incident-analyzer/dashboard run dev
```

### Seed demo data

Click **Seed Demo Data** on the Incidents page, or:

```bash
curl -X POST http://localhost:3000/seed
# → {"message":"Seeded 12 incidents and 6 runbooks","incidents":12,"runbooks":6}
```

## Dashboard Pages

### Incidents Feed
Filterable list of all incidents with severity badges, status icons, service tags, PagerDuty/runbook indicators. Search by title or service. One-click seed button for demo data.

### Incident Detail
Full analysis view including root cause, evidence, recommendations, detected patterns, confidence/stats. Runbook steps with checkable completion tracking. Status management (acknowledge → investigate → resolve) and PagerDuty escalation.

### Anomaly Dashboard
Service health grid color-coded by severity. Aggregated error pattern leaderboard with bar visualization. Active incidents sorted by severity.

### Analytics
Interactive charts (Recharts): severity distribution pie, status distribution pie, root cause categories bar chart, incidents-by-service bar chart. Summary row with total incidents, avg confidence, mean TTR, PagerDuty/runbook stats. Full incidents summary table.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health and stats |
| `POST` | `/analyze` | Analyze logs → create incident, match runbook, trigger PD |
| `POST` | `/anomaly/detect` | Detect anomalies in log stream |
| `GET` | `/incidents` | List all incidents |
| `GET` | `/incidents/stats` | Aggregated statistics |
| `GET` | `/incidents/:id` | Get single incident |
| `PATCH` | `/incidents/:id/status` | Update status |
| `POST` | `/incidents/:id/escalate` | Escalate to PagerDuty |
| `POST` | `/incidents/:id/runbook/step/:order` | Complete a runbook step |
| `GET` | `/runbooks` | List all runbooks |
| `GET` | `/runbooks/:id` | Get single runbook |
| `GET` | `/runbooks/match/:category` | Match runbooks by category |
| `POST` | `/runbooks` | Create a runbook |
| `POST` | `/seed` | Seed realistic demo data |
| `POST` | `/webhooks/pagerduty` | PagerDuty webhook receiver |

## Example Usage

```bash
# Analyze logs — auto-creates incident + matches runbook
curl -X POST http://localhost:3000/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "logs": [
      {"level":"error","service":"api","message":"Connection refused: postgres:5432"},
      {"level":"error","service":"api","message":"Connection pool exhausted"},
      {"level":"fatal","service":"api","message":"FATAL: too many connections"}
    ]
  }'

# Detect anomalies
curl -X POST http://localhost:3000/anomaly/detect \
  -H "Content-Type: application/json" \
  -d '{
    "logs": [
      {"level":"info","service":"api","message":"Request processed","timestamp":"2024-01-15T10:00:00Z"},
      {"level":"error","service":"api","message":"Timeout","timestamp":"2024-01-15T10:00:01Z"},
      {"level":"error","service":"api","message":"Timeout","timestamp":"2024-01-15T10:00:02Z"},
      {"level":"error","service":"api","message":"Timeout","timestamp":"2024-01-15T10:00:03Z"},
      {"level":"error","service":"api","message":"Timeout","timestamp":"2024-01-15T10:00:04Z"},
      {"level":"error","service":"api","message":"Timeout","timestamp":"2024-01-15T10:00:05Z"}
    ]
  }'

# Update incident status
curl -X PATCH http://localhost:3000/incidents/<id>/status \
  -H "Content-Type: application/json" \
  -d '{"status":"investigating"}'

# Complete a runbook step
curl -X POST http://localhost:3000/incidents/<id>/runbook/step/0
```

## PagerDuty Integration

Set environment variables to enable live PagerDuty:

```bash
PAGERDUTY_ROUTING_KEY=your-routing-key
PAGERDUTY_WEBHOOK_SECRET=your-webhook-secret
PAGERDUTY_AUTO_SEVERITIES=critical,high  # auto-trigger for these severities
```

Without these, PagerDuty runs in simulated mode — incidents still log trigger/resolve actions locally.

## Real-World Use Case

This project mirrors how SRE/platform teams build incident management platforms:

- **Pattern match** against known error signatures with auto-categorization
- **Detect anomalies** using statistical analysis of log streams
- **Generate root cause analysis** with actionable recommendations
- **Auto-match runbooks** with step-by-step remediation tracking
- **Bi-directional PagerDuty** integration for escalation and status sync
- **Real-time dashboard** for incident triage, analytics, and service health

Demonstrates: domain-driven design, monorepo architecture, full-stack TypeScript, configurable rule engines, statistical analysis, and clean API design for ML/AI-adjacent systems.
