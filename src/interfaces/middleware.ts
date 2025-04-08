import {Message} from '@aws-sdk/client-sqs';

/**
 * Middleware execution context
 */
export interface MiddlewareContext {
    /**
     * Original SQS message
     */
    message: Message;
    /**
     * Parsed message body
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body: any;
    /**
     * Message ID
     */
    messageId: string;
    /**
     * Message group ID
     */
    groupId: string;
    /**
     * Custom metadata that middleware can use to pass information
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: Record<string, any>;
    /**
     * Whether this message should be processed
     * (middleware can set false to skip processing)
     */
    shouldProcess: boolean;
}

/**
 * Batch middleware execution context
 */
export interface BatchMiddlewareContext {
    /**
     * Messages in the batch
     */
    messages: MiddlewareContext[];
    /**
     * Group ID for the batch
     */
    groupId: string;
    /**
     * Custom metadata that middleware can use to pass information
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata: Record<string, any>;
}

/**
 * Configuration options for middleware
 */
export interface MiddlewareOptions {
    /**
     * Whether to use middleware for message preprocessing
     */
    enabled: boolean;
    /**
     * Whether to short-circuit message processing if a middleware filters it out
     */
    respectFiltering: boolean;
    /**
     * Whether to apply middleware to batch operations
     */
    applyToBatches: boolean;
} 