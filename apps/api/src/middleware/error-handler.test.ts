import { describe, it, expect, vi } from 'vitest';
import { errorHandler } from './error-handler';
import type { Request, Response, NextFunction } from 'express';

function mockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

describe('errorHandler middleware', () => {
  it('returns 500 with generic message in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const err = new Error('Internal DB connection string: mongodb://secret:pass@host');
    const res = mockRes();
    errorHandler(err, {} as Request, res, vi.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Internal server error' });

    process.env.NODE_ENV = originalEnv;
  });

  it('returns 500 with actual message in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const err = new Error('some debug error');
    const res = mockRes();
    errorHandler(err, {} as Request, res, vi.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'some debug error' });

    process.env.NODE_ENV = originalEnv;
  });

  it('uses statusCode from error if set', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const err = Object.assign(new Error('not found'), { statusCode: 404 });
    const res = mockRes();
    errorHandler(err, {} as Request, res, vi.fn() as NextFunction);

    expect(res.status).toHaveBeenCalledWith(404);

    process.env.NODE_ENV = originalEnv;
  });
});
