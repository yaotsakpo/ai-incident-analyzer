# ai-incident-analyzer

An API that analyzes logs and error messages to determine root causes, detect anomalies, and provide actionable recommendations. Uses rule-based pattern matching with optional OpenAI integration.

## Architecture

```
src/
├── index.ts                     # Express server entry point
├── routes/
│   ├── analyze.ts               # POST /analyze — log analysis endpoint
│   └── anomaly.ts               # POST /anomaly/detect — anomaly detection
├── services/
│   ├── analyzer.ts              # Core analysis engine (root cause, severity, recs)
│   ├── pattern-detector.ts      # Regex-based error pattern matching
│   └── anomaly-detector.ts      # Statistical anomaly detection
└── types/
    └── index.ts                 # TypeScript interfaces
```

## Tech Stack

- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Analysis:** Rule-based pattern matching + statistical anomaly detection
- **Optional:** OpenAI API integration (set `USE_AI=true`)

## How to Run Locally

```bash
# Install dependencies
npm install

# Start the server (rule-based mode)
npm run dev

# Server runs at http://localhost:3000
```

## API Endpoints

### POST /analyze
Analyze logs or error messages for root cause and recommendations.

**Request body:**
```json
{
  "logs": [
    { "level": "error", "service": "user-api", "message": "Connection refused to database", "timestamp": "2024-01-15T10:30:00Z" },
    { "level": "error", "service": "user-api", "message": "Connection pool exhausted", "timestamp": "2024-01-15T10:30:05Z" },
    { "level": "fatal", "service": "user-api", "message": "Connection timeout after 30s", "timestamp": "2024-01-15T10:30:10Z" }
  ]
}
```

**Or with plain error messages:**
```json
{
  "errorMessages": [
    "ECONNREFUSED 127.0.0.1:5432",
    "Connection pool exhausted, all 20 connections in use",
    "Query timeout after 30000ms"
  ]
}
```

**Response:**
```json
{
  "id": "uuid",
  "summary": "Analyzed 3 log entries across service(s): user-api...",
  "rootCause": {
    "category": "Database Connectivity",
    "description": "Database connection failures detected...",
    "evidence": ["Connection refused to database", "..."]
  },
  "recommendations": [
    "Check database server health and availability",
    "Review connection pool configuration"
  ],
  "severity": "critical",
  "confidence": 0.75,
  "patterns": [
    { "name": "Connection Failure", "occurrences": 3, "description": "..." }
  ],
  "analyzedLogs": 3,
  "processingTimeMs": 2
}
```

### POST /anomaly/detect
Detect anomalies in a set of logs.

**Request body:**
```json
{
  "logs": [...],
  "baseline": {
    "errorRateThreshold": 0.1,
    "frequencyThreshold": 5
  }
}
```

## Example Usage

```bash
# Analyze database connection errors
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
```

## Real-World Use Case

This project mirrors how SRE/platform teams build incident analysis tools that:

- **Pattern match** against known error signatures (like PagerDuty's intelligent alerting)
- **Detect anomalies** using statistical analysis of log streams
- **Generate root cause analysis** with actionable recommendations
- **Calculate severity and confidence** scores for prioritization

Demonstrates: domain-driven design, configurable rule engines, statistical analysis, and clean API design for ML/AI-adjacent systems.
