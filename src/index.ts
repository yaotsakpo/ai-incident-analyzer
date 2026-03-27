import express from 'express';
import cors from 'cors';
import { analyzeRoutes } from './routes/analyze';
import { anomalyRoutes } from './routes/anomaly';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ service: 'ai-incident-analyzer', status: 'ok', uptime: process.uptime() });
});

app.use('/analyze', analyzeRoutes());
app.use('/anomaly', anomalyRoutes());

app.listen(PORT, () => {
  console.log(`AI Incident Analyzer running on http://localhost:${PORT}`);
  console.log(`AI mode: ${process.env.USE_AI === 'true' ? 'OpenAI' : 'Rule-based'}`);
});

export default app;
