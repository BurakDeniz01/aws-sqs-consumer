import {Message} from '@aws-sdk/client-sqs';

/**
 * Processed message result
 */
export interface ProcessedMessage {
    /**
     * Message ID
     */
    id: string;
    /**
     * Whether the message was successfully processed
     */
    success: boolean;
    /**
     * Error if processing failed
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error?: any;
}

/**
 * Processed batch result
 */
export interface ProcessedBatch {
    /**
     * Successfully processed message IDs
     */
    successful: string[];
    /**
     * Failed message IDs and errors
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    failed: { id: string; error: any }[];
}

/**
 * Message with parsed body
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ParsedMessage<T = any> {
    /**
     * Original SQS message
     */
    original: Message;
    /**
     * Parsed message body
     */
    body: T;
    /**
     * Message ID
     */
    id: string;
    /**
     * Message group ID (FIFO queues)
     */
    groupId?: string;
} 