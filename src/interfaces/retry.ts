/**
 * Retry options for message processing
 */
export default interface RetryOptions {
    /**
     * Maximum number of retries before giving up
     */
    maxRetries: number;
    /**
     * Initial delay in milliseconds before the first retry
     */
    initialDelayMs: number;
    /**
     * Factor by which the delay increases after each retry
     */
    backoffMultiplier: number;
    /**
     * Maximum delay in milliseconds between retries
     */
    maxDelayMs: number;
    /**
     * Whether to extend message visibility timeout during retries
     */
    extendVisibilityTimeout: boolean;
} 