/**
 * Queue consumer events
 */
export enum QueueConsumerEvents {
    // Lifecycle events
    STARTED = 'consumer.started',
    STOPPED = 'consumer.stopped',
    ERROR = 'consumer.error',
    // Message events
    MESSAGE_RECEIVED = 'message.received',
    MESSAGE_PROCESSING_STARTED = 'message.processing.started',
    MESSAGE_PROCESSED = 'message.processing.success',
    MESSAGE_PROCESSING_FAILED = 'message.processing.failed',
    MESSAGE_PROCESSING_RETRY = 'message.processing.retry',
    // Batch events
    BATCH_PROCESSING_STARTED = 'batch.processing.started',
    BATCH_PROCESSING_COMPLETED = 'batch.processing.completed',
    BATCH_PROCESSING_FAILED = 'batch.processing.failed',
    BATCH_PROCESSING_RETRY = 'batch.processing.retry',
    // DLQ events
    MESSAGE_SENT_TO_DLQ = 'message.sent.to.dlq',
    MESSAGE_DLQ_FAILED = 'message.dlq.failed',
    // Performance metrics
    PERFORMANCE_METRICS = 'performance.metrics',
} 