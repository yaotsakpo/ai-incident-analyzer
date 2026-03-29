import { AIProviderConfig, AnalysisResult, LogEntry } from '@incident-analyzer/shared';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger';

export class AIProviderService {
  private config: AIProviderConfig | null = null;

  configure(config: AIProviderConfig) { this.config = config; }
  isEnabled(): boolean { return !!this.config?.enabled && !!this.config?.apiKey; }

  async analyzeWithAI(logs: LogEntry[], context?: string): Promise<AnalysisResult | null> {
    if (!this.config?.enabled || !this.config?.apiKey) {
      logger.info('AI provider not configured, using local analysis');
      return null;
    }

    const prompt = this.buildPrompt(logs, context);

    try {
      if (this.config.provider === 'openai') {
        return await this.callOpenAI(prompt);
      } else if (this.config.provider === 'anthropic') {
        return await this.callAnthropic(prompt);
      }
      return null;
    } catch (err) {
      logger.error('AI analysis failed, falling back to local', err);
      return null;
    }
  }

  private buildPrompt(logs: LogEntry[], context?: string): string {
    const logText = logs.slice(0, 50).map(l =>
      `[${l.level}] ${l.service || ''}: ${l.message}`
    ).join('\n');

    return `Analyze these application logs and provide incident analysis.
${context ? `Context: ${context}\n` : ''}
Logs:
${logText}

Respond in JSON format:
{
  "summary": "brief summary of findings",
  "rootCause": { "category": "category name", "description": "what happened", "evidence": ["evidence1", "evidence2"] },
  "recommendations": ["action1", "action2"],
  "severity": "low|medium|high|critical",
  "confidence": 0.0-1.0,
  "patterns": [{ "name": "pattern", "occurrences": N, "description": "desc" }]
}`;
  }

  private async callOpenAI(prompt: string): Promise<AnalysisResult | null> {
    const start = Date.now();
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config!.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config!.model || 'gpt-4',
        messages: [
          { role: 'system', content: 'You are an expert SRE incident analyst. Respond only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      logger.error(`OpenAI API error: ${res.status}`, err);
      return null;
    }

    const data: any = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    logger.info(`OpenAI analysis completed in ${Date.now() - start}ms`);

    return {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      summary: parsed.summary,
      rootCause: parsed.rootCause,
      recommendations: parsed.recommendations || [],
      severity: parsed.severity || 'medium',
      confidence: parsed.confidence || 0.7,
      patterns: parsed.patterns || [],
      analyzedLogs: 0,
      processingTimeMs: Date.now() - start,
    };
  }

  private async callAnthropic(prompt: string): Promise<AnalysisResult | null> {
    const start = Date.now();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.config!.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config!.model || 'claude-3-sonnet-20240229',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
        system: 'You are an expert SRE incident analyst. Respond only with valid JSON.',
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      logger.error(`Anthropic API error: ${res.status}`, err);
      return null;
    }

    const data: any = await res.json();
    const content = data.content?.[0]?.text;
    if (!content) return null;

    const parsed = JSON.parse(content);
    logger.info(`Anthropic analysis completed in ${Date.now() - start}ms`);

    return {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      summary: parsed.summary,
      rootCause: parsed.rootCause,
      recommendations: parsed.recommendations || [],
      severity: parsed.severity || 'medium',
      confidence: parsed.confidence || 0.7,
      patterns: parsed.patterns || [],
      analyzedLogs: 0,
      processingTimeMs: Date.now() - start,
    };
  }
}
