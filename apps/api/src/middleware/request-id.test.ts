import { describe, it, expect, vi } from 'vitest';
import { requestId } from './request-id';
import type { Request, Response, NextFunction } from 'express';

describe('requestId middleware', () => {
  it('generates an X-Request-ID when not present', () => {
    const req = { headers: {} } as unknown as Request;
    const res = { setHeader: vi.fn() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    requestId(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', expect.any(String));
    expect((req as any).requestId).toBeTruthy();
    expect(next).toHaveBeenCalled();
  });

  it('uses existing X-Request-ID from client', () => {
    const req = { headers: { 'x-request-id': 'client-provided-id' } } as unknown as Request;
    const res = { setHeader: vi.fn() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    requestId(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', 'client-provided-id');
    expect((req as any).requestId).toBe('client-provided-id');
  });

  it('always calls next()', () => {
    const req = { headers: {} } as unknown as Request;
    const res = { setHeader: vi.fn() } as unknown as Response;
    const next = vi.fn() as NextFunction;

    requestId(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
