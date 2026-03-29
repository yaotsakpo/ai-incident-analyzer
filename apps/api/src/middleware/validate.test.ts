import { describe, it, expect, vi } from 'vitest';
import { validate } from './validate';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';

function mockReqRes(body: unknown) {
  const req = { body } as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().min(0),
});

describe('validate middleware', () => {
  it('calls next() and assigns parsed body on valid input', () => {
    const { req, res, next } = mockReqRes({ name: 'Alice', age: 30 });
    validate(testSchema)(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.body).toEqual({ name: 'Alice', age: 30 });
  });

  it('returns 400 with details on invalid input', () => {
    const { req, res, next } = mockReqRes({ name: '', age: -1 });
    validate(testSchema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalled();
    const response = (res.json as any).mock.calls[0][0];
    expect(response.error).toBe('Validation failed');
    expect(response.details).toBeDefined();
    expect(response.details.length).toBeGreaterThan(0);
  });

  it('returns 400 when required fields are missing', () => {
    const { req, res, next } = mockReqRes({});
    validate(testSchema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('strips unknown fields from body', () => {
    const { req, res, next } = mockReqRes({ name: 'Bob', age: 25, extra: 'ignored' });
    validate(testSchema)(req, res, next);
    expect(next).toHaveBeenCalled();
    // zod strips unknown keys by default
    expect(req.body.extra).toBeUndefined();
  });
});
