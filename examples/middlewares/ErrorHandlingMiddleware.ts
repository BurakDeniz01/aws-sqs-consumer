/**
 * Error Handling Middleware Example
 * 
 * This example demonstrates how to use middleware to handle errors
 * that occur during message processing.
 */

import { QueueConsumer, MessageMiddleware } from '../../src';

// Create an SQS consumer
const consumer = new QueueConsumer({
  url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
  handler: async (message) => {
    // Simulate random errors for demonstration
    if (Math.random() < 0.3) {
      throw new Error('Simulated handler error');
    }
    
    console.log('Processing message:', message.body);
  },
  middlewareOptions: {
    enabled: true,
    respectFiltering: true,
    applyToBatches: true
  },
  // Configure retry behavior
  retryOptions: {
    maxRetries: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
    maxDelayMs: 10000,
    extendVisibilityTimeout: true
  }
});

// Define error handling middleware
const errorHandlingMiddleware: MessageMiddleware = async (context, next) => {
  try {
    // Continue to the next middleware
    await next();
  } catch (error) {
    // Log detailed error information
    console.error(`Error processing message ${context.messageId}:`, error);
    
    // Add error information to context metadata
    context.metadata.error = {
      message: error instanceof Error ? error.message : String(error),
      time: new Date().toISOString(),
      // For certain error types, we might want special handling
      requiresManualIntervention: isBusinessCriticalError(error)
    };
    
    // Determine if we should retry based on error type
    if (isRetryableError(error)) {
      console.log(`Error is retryable, SQS consumer will handle retry logic`);
      // Re-throw to allow the consumer to handle the error with retries
      throw error;
    } else {
      console.log(`Error is non-retryable, marking as processed to prevent retries`);
      // For non-retryable errors, we can choose to not re-throw
      // This will cause the message to be deleted from the queue
      // Instead, you might want to send to a dead letter queue or log for manual review
    }
  }
};

/**
 * Helper function to determine if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  // Retryable errors are typically transient issues that might resolve on retry
  // Examples: network errors, timeouts, throttling, temporary service unavailability
  
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  return (
    errorMessage.includes('timeout') ||
    errorMessage.includes('network') ||
    errorMessage.includes('throttl') ||
    errorMessage.includes('rate limit') ||
    errorMessage.includes('temporary')
  );
}

/**
 * Helper function to identify business-critical errors that need manual attention
 */
function isBusinessCriticalError(error: unknown): boolean {
  // Business critical errors might require human intervention
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  return (
    errorMessage.includes('data integrity') ||
    errorMessage.includes('critical') ||
    errorMessage.includes('security')
  );
}

// Add the middleware to the consumer
// Error handling middleware should be the first one to be registered
// so it can catch errors from all subsequent middleware
consumer.use(errorHandlingMiddleware);

// Start consuming messages
consumer.run();

// Listen for error events
consumer.on('error', (err) => {
  console.error('Consumer error event:', err);
});

// Handle shutdown
function handleShutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down...`);
  consumer.stop();
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export default consumer; 