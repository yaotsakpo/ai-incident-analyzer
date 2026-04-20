import { Request, Response, NextFunction } from 'express';
import { logger } from '../services/logger';

export function errorHandler(
  err: Error & { statusCode?: number },
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.statusCode ?? 500;
  logger.error(`[${req.method} ${req.path}] ${err.message}`, err.stack);
  const message =
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;
  res.status(status).json({ error: message });
}
