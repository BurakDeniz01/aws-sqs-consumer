/**
 * Logging Middleware Example
 * 
 * This example demonstrates how to use logging middleware to track
 * message processing with timing information.
 */

import QueueConsumer, { MessageMiddleware } from '../../src';

// Create an SQS consumer
const consumer = new QueueConsumer({
  url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
  handler: async (message) => {
    console.log('Processing message payload:', message.body);
    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));
  },
  middlewareOptions: {
    enabled: true,
    respectFiltering: true,
    applyToBatches: true
  }
});

// Define logging middleware
const loggingMiddleware: MessageMiddleware = async (context, next) => {
  console.log(`Processing message: ${context.messageId}`, {
    body: context.body,
    groupId: context.groupId,
  });
  
  // Start timer for performance logging
  const startTime = Date.now();
  
  // Continue to the next middleware
  await next();
  
  // After all middleware and handler have completed
  const duration = Date.now() - startTime;
  console.log(`Message processed in ${duration}ms: ${context.messageId}`);
};

// Add the middleware to the consumer
consumer.use(loggingMiddleware);

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