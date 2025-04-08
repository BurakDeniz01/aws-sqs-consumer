/**
 * Retry Configuration Example
 * 
 * This example demonstrates how to configure retry behavior
 * for handling transient failures when processing SQS messages.
 */

import QueueConsumer from '../src';

// Create an SQS consumer with custom retry options
const consumer = new QueueConsumer({
  // The URL of your SQS queue
  url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
  
  // Handler function that sometimes fails
  handler: async (message) => {
    // Simulate a failure for demonstration purposes
    // In real applications, this would be actual business logic
    const shouldFail = Math.random() < 0.3; // 30% chance of failure
    
    if (shouldFail) {
      console.log(`Message ${message.messageId} processing failed, will retry`);
      throw new Error('Simulated transient error');
    }
    
    console.log(`Message ${message.messageId} processed successfully`);
  },
  
  // Configure retry behavior
  retryOptions: {
    maxRetries: 5,                // Try up to 5 times before giving up
    initialDelayMs: 1000,         // Start with a 1 second delay
    backoffMultiplier: 2,         // Double the delay on each retry
    maxDelayMs: 30000,            // Cap delays at 30 seconds
    extendVisibilityTimeout: true // Keep the message invisible during retries
  }
});

// Start consuming messages
consumer.run();

// Listen for retry events (optional)
consumer.on('message_retry', ({ messageId, retryCount, error }) => {
  console.log(`Retrying message ${messageId} (attempt ${retryCount}): ${error.message}`);
});

// Listen for failure events (messages that exceeded max retries)
consumer.on('message_processing_error', ({ messageId, error }) => {
  console.error(`Failed to process message ${messageId} after all retries: ${error.message}`);
});

/**
 * Handle shutdown signals
 */
function handleShutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down retry-enabled consumer...`);
  consumer.stop();
}

// Set up signal handlers as requested
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export default consumer; 