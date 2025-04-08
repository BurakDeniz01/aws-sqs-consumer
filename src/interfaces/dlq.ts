/**
 * Dead letter queue configuration
 */
export default interface DeadLetterQueueOptions {
    /**
     * URL of the dead letter queue
     */
    queueUrl: string;
    /**
     * Whether to send failed messages to DLQ
     */
    enabled: boolean;
    /**
     * Additional metadata to include with failed messages
     */
    includeFailureMetadata: boolean;
} 