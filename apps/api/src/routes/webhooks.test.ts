import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyPagerDutySignature } from './webhooks';

describe('verifyPagerDutySignature', () => {
  const secret = 'test-webhook-secret';

  it('returns true when signature matches', () => {
    const body = JSON.stringify({ event: { event_type: 'incident.triggered' } });
    const sig = 'v1=' + crypto.createHmac('sha256', secret).update(body).digest('hex');
    expect(verifyPagerDutySignature(body, sig, secret)).toBe(true);
  });

  it('returns false when signature is wrong', () => {
    const body = JSON.stringify({ event: {} });
    expect(verifyPagerDutySignature(body, 'v1=badsignature', secret)).toBe(false);
  });

  it('returns false when header format is invalid', () => {
    const body = JSON.stringify({ event: {} });
    expect(verifyPagerDutySignature(body, 'nosuchprefix=abc', secret)).toBe(false);
  });

  it('returns true when no secret configured (skip validation)', () => {
    const body = JSON.stringify({ event: {} });
    expect(verifyPagerDutySignature(body, undefined, undefined)).toBe(true);
  });

  it('returns false when header is missing but secret is configured', () => {
    const body = JSON.stringify({ event: {} });
    expect(verifyPagerDutySignature(body, undefined, secret)).toBe(false);
  });
});
