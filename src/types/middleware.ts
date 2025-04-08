import { BatchMiddlewareContext, MiddlewareContext } from '../interfaces/middleware';

/**
 * Middleware function for processing individual messages
 */
export type MessageMiddleware = (context: MiddlewareContext, next: () => Promise<void>) => Promise<void>;

/**
 * Middleware function for processing batches of messages
 */
export type BatchMiddleware = (context: BatchMiddlewareContext, next: () => Promise<void>) => Promise<void>; 