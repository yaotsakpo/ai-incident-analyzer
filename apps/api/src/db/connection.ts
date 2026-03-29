import mongoose from 'mongoose';
import { logger } from '../services/logger';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/incident-analyzer';

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(MONGO_URI);
    logger.info(`MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    logger.error('MongoDB connection failed', err);
    // Fallback: app still works with in-memory if Mongo is unavailable
    logger.warn('Running without persistent storage — data will be lost on restart');
  }
}

export function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
