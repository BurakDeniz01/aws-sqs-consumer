/**
 * Configuration options for metrics
 */
export default interface MetricsOptions {
    /**
     * Whether to emit metrics events
     */
    enabled: boolean;
    /**
     * Whether to include message body in metrics events (can be sensitive data)
     */
    includeMessageBody: boolean;
    /**
     * Whether to emit detailed performance metrics
     */
    emitPerformanceMetrics: boolean;
}

/**
 * Message processing metrics
 */
export interface MessageProcessingMetrics {
    /**
     * Message ID
     */
    messageId: string | undefined;
    /**
     * Message group ID (for FIFO queues)
     */
    groupId: string | undefined;
    /**
     * Time taken to process message in milliseconds
     */
    processingTimeMs: number;
    /**
     * Number of retry attempts made
     */
    retryCount: number;
    /**
     * Timestamp when processing started
     */
    startTime: string;
    /**
     * Timestamp when processing completed
     */
    endTime: string;
    /**
     * Original message body (if configured)
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: any;
}

/**
 * Error metrics
 */
export interface ErrorMetrics {
    /**
     * Message ID
     */
    messageId: string | undefined;
    /**
     * Error details
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error: any;
    /**
     * Retry attempt number
     */
    retryAttempt: number;
    /**
     * Whether retry will be attempted
     */
    willRetry: boolean;
    /**
     * Original message body (if configured)
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: any;
}

/**
 * Batch processing metrics
 */
export interface BatchMetrics {
    /**
     * Number of messages in the batch
     */
    messageCount: number;
    /**
     * Group ID for the batch
     */
    groupId: string;
    /**
     * Time taken to process the batch in milliseconds
     */
    processingTimeMs: number;
    /**
     * Timestamp when processing started
     */
    startTime: string;
    /**
     * Timestamp when processing completed
     */
    endTime: string;
}

/**
 * Consumer metrics event
 */
export interface ConsumerMetrics {
    /**
     * Queue URL
     */
    queueUrl: string;
    /**
     * Time active in milliseconds
     */
    activeTimeMs: number;
    /**
     * Number of messages processed
     */
    messagesProcessed: number;
    /**
     * Number of messages failed
     */
    messagesFailed: number;
    /**
     * Number of messages sent to DLQ
     */
    messagesSentToDlq: number;
    /**
     * Number of retries performed
     */
    retryCount: number;
    /**
     * Timestamp when consumer started
     */
    startTime: string;
    /**
     * Average processing time per message in milliseconds
     */
    averageProcessingTimeMs: number;
} 