/**
 * Dead Letter Queue Example
 * 
 * This example demonstrates how to configure a Dead Letter Queue (DLQ)
 * to handle messages that cannot be processed successfully after several retries.
 */

import QueueConsumer from '../src';

// Create an SQS consumer with DLQ configuration
const consumer = new QueueConsumer({
  // The URL of your SQS queue
  url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
  
  // Handler that will sometimes fail permanently
  handler: async (message) => {
    // For demonstration, simulate a permanent failure
    // In real applications, this would be business logic that detects
    // messages that can never be processed successfully
    if (message.body.includes('PERMANENT_ERROR')) {
      console.log(`Message ${message.messageId} has a permanent error`);
      throw new Error('Permanent error - cannot process this message');
    }
    
    console.log(`Message ${message.messageId} processed successfully`);
  },
  
  // Configure retry behavior - limited attempts before going to DLQ
  retryOptions: {
    maxRetries: 2,                // Only try 2 times before sending to DLQ
    initialDelayMs: 1000,         // Start with a 1 second delay
    backoffMultiplier: 2,         // Double the delay on each retry
    maxDelayMs: 10000,            // Cap delays at 10 seconds
    extendVisibilityTimeout: true // Keep the message invisible during retries
  },
  
  // Configure Dead Letter Queue
  deadLetterQueueOptions: {
    enabled: true,   // Enable DLQ functionality
    queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-dlq', // DLQ URL
    includeFailureMetadata: true  // Include error details with the message
  }
});

// Start consuming messages
consumer.run();

// Listen for DLQ events
consumer.on('message_sent_to_dlq', ({ messageId, error }) => {
  console.log(`Message ${messageId} sent to DLQ: ${error.message}`);
  
  // In real applications, you might want to:
  // 1. Alert operations team
  // 2. Log details for investigation
  // 3. Trigger a fallback process
});

/**
 * Handle shutdown signals
 */
function handleShutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down DLQ-enabled consumer...`);
  consumer.stop();
}

// Set up signal handlers as requested
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export default consumer; 