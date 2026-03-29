import { describe, it, expect, vi } from 'vitest';
import { requirePermission } from './auth';
import type { Request, Response, NextFunction } from 'express';
import type { User } from '@incident-analyzer/shared';

function mockReqRes(user?: Partial<User>) {
  const req = { user: user ? { id: 'u1', orgId: 'org1', username: 'test', displayName: 'Test', createdAt: '', ...user } : undefined } as unknown as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('requirePermission middleware', () => {
  it('calls next() for admin with any permission', () => {
    const { req, res, next } = mockReqRes({ role: 'admin' });
    requirePermission('incidents:view')(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows viewer to view incidents', () => {
    const { req, res, next } = mockReqRes({ role: 'viewer' });
    requirePermission('incidents:view')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks viewer from managing users', () => {
    const { req, res, next } = mockReqRes({ role: 'viewer' });
    requirePermission('users:manage')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows responder to acknowledge incidents', () => {
    const { req, res, next } = mockReqRes({ role: 'responder' });
    requirePermission('incidents:acknowledge')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks responder from managing teams', () => {
    const { req, res, next } = mockReqRes({ role: 'responder' });
    requirePermission('teams:manage')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('allows custom role with matching permission', () => {
    const { req, res, next } = mockReqRes({ role: 'custom', permissions: ['incidents:view', 'teams:manage'] });
    requirePermission('teams:manage')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks custom role without matching permission', () => {
    const { req, res, next } = mockReqRes({ role: 'custom', permissions: ['incidents:view'] });
    requirePermission('users:manage')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 401 when no user is attached', () => {
    const { req, res, next } = mockReqRes();
    req.user = undefined;
    requirePermission('incidents:view')(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('passes if any of multiple permissions match (OR logic)', () => {
    const { req, res, next } = mockReqRes({ role: 'viewer' });
    requirePermission('users:manage', 'incidents:view')(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
