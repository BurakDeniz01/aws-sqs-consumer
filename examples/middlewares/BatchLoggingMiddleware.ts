/**
 * Batch Logging Middleware Example
 * 
 * This example demonstrates how to use batch logging middleware to track
 * the processing of batches of messages.
 */

import { QueueConsumer, BatchMiddleware } from '../../src';

// Create an SQS consumer with batch processing
const consumer = new QueueConsumer({
  url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
  batchHandler: async (messages) => {
    console.log(`Handler processing ${messages.length} messages`);
    // Simulate batch processing
    await new Promise(resolve => setTimeout(resolve, 200));
    
    return {
      successful: messages.map(msg => msg.id),
      failed: []
    };
  },
  batchOptions: {
    enabled: true,
    maxBatchSize: 10,
    waitTimeSeconds: 5,
    batchDeletes: true,
    atomicBatches: false,
    visibilityTimeout: 30
  },
  middlewareOptions: {
    enabled: true,
    respectFiltering: true,
    applyToBatches: true
  }
});

// Define batch logging middleware
const batchLoggingMiddleware: BatchMiddleware = async (context, next) => {
  console.log(`Processing batch with ${context.messages.length} messages for group: ${context.groupId}`);
  
  // Start timer for performance logging
  const startTime = Date.now();
  
  // Continue to the next middleware
  await next();
  
  // After all middleware and handler have completed
  const duration = Date.now() - startTime;
  console.log(`Batch processed in ${duration}ms for group: ${context.groupId}`);
};

// Add the middleware to the consumer
consumer.useBatch(batchLoggingMiddleware);

// Start consuming messages
consumer.run();

// Handle shutdown
 function handleShutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down...`);
   consumer.stop();
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export default consumer; 