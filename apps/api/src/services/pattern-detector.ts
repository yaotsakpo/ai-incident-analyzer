import { LogEntry, Pattern } from '@incident-analyzer/shared';

interface PatternRule {
  name: string;
  regex: RegExp;
  description: string;
}

export class PatternDetector {
  private rules: PatternRule[] = [
    {
      name: 'Connection Failure',
      regex: /connection\s*(refused|reset|timeout|closed|failed)/i,
      description: 'Repeated connection failures to an external dependency',
    },
    {
      name: 'OOM / Memory',
      regex: /(out\s*of\s*memory|heap|oom|memory\s*(leak|exceeded|limit))/i,
      description: 'Memory-related errors indicating resource exhaustion',
    },
    {
      name: 'Timeout',
      regex: /(timeout|timed?\s*out|ETIMEDOUT|deadline\s*exceeded)/i,
      description: 'Request or operation timeout errors',
    },
    {
      name: 'Authentication Error',
      regex: /(unauthorized|unauthenticated|401|invalid\s*token|jwt\s*(expired|invalid|malformed))/i,
      description: 'Authentication or token validation failures',
    },
    {
      name: 'Permission Denied',
      regex: /(forbidden|403|permission\s*denied|access\s*denied|rbac)/i,
      description: 'Authorization or permission errors',
    },
    {
      name: 'Rate Limiting',
      regex: /(rate\s*limit|429|too\s*many\s*requests|throttl)/i,
      description: 'Request throttling or rate limit breaches',
    },
    {
      name: 'Disk/Storage',
      regex: /(no\s*space|enospc|disk\s*full|storage\s*(full|exceeded))/i,
      description: 'Disk space or storage capacity issues',
    },
    {
      name: 'DNS Resolution',
      regex: /(dns|ENOTFOUND|name\s*resolution|resolve\s*failed)/i,
      description: 'DNS lookup failures preventing connectivity',
    },
    {
      name: 'Null/Undefined',
      regex: /(cannot\s*read\s*propert|undefined\s*is\s*not|null\s*pointer|TypeError)/i,
      description: 'Null reference or type errors in application code',
    },
    {
      name: 'Database Error',
      regex: /(deadlock|lock\s*timeout|duplicate\s*key|constraint\s*violation|query\s*failed)/i,
      description: 'Database query or constraint errors',
    },
  ];

  detect(logs: LogEntry[]): Pattern[] {
    const patternCounts = new Map<string, { rule: PatternRule; count: number }>();

    for (const log of logs) {
      for (const rule of this.rules) {
        if (rule.regex.test(log.message)) {
          const existing = patternCounts.get(rule.name);
          if (existing) {
            existing.count++;
          } else {
            patternCounts.set(rule.name, { rule, count: 1 });
          }
        }
      }
    }

    return Array.from(patternCounts.values())
      .map(({ rule, count }) => ({
        name: rule.name,
        occurrences: count,
        description: rule.description,
      }))
      .sort((a, b) => b.occurrences - a.occurrences);
  }
}
