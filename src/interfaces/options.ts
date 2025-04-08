/**
 * Batch processing configuration
 */
export default interface BatchOptions {
    /**
     * Whether to use batch processing mode
     */
    enabled: boolean;
    /**
     * Maximum number of messages to retrieve per batch
     * (1-10, limited by AWS SQS)
     */
    maxBatchSize: number;
    /**
     * Whether to use batch deletes to remove processed messages
     */
    batchDeletes: boolean;
    /**
     * Wait time in seconds for long polling
     * (0-20, where 0 means short polling)
     */
    waitTimeSeconds: number;
    /**
     * Visibility timeout in seconds
     */
    visibilityTimeout: number;
    /**
     * Whether all-or-nothing batch processing is required
     * (if true, all messages must be successful or the entire batch is retried)
     */
    atomicBatches: boolean;
} 