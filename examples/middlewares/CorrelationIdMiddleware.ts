/**
 * Correlation ID Middleware Example
 * 
 * This example demonstrates how to add correlation IDs to messages
 * for tracing purposes across distributed systems.
 */

import QueueConsumer, { MessageMiddleware } from '../../src';

// Create an SQS consumer
const consumer = new QueueConsumer({
  url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
  handler: async (message) => {
    // Access the correlation ID from the message body
    const correlationId = message.body.correlationId;
    
    console.log(`Processing message with correlation ID: ${correlationId}`);
    
    // Use correlation ID in downstream operations (e.g., database saves, API calls)
    await processMessageWithCorrelationId(message, correlationId);
  },
  middlewareOptions: {
    enabled: true,
    respectFiltering: true,
    applyToBatches: true
  }
});

/**
 * Example function that uses the correlation ID in downstream operations
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processMessageWithCorrelationId(message: any, correlationId: string): Promise<void> {
  // Simulate processing with correlation ID
  console.log(`[${correlationId}] Processing started`);
  await new Promise(resolve => setTimeout(resolve, 100));
  console.log(`[${correlationId}] Processing completed`);
}

// Define correlation ID middleware
const correlationIdMiddleware: MessageMiddleware = async (context, next) => {
  // Ensure body is an object before accessing properties
  if (typeof context.body !== 'object' || context.body === null) {
    context.body = {};
  }
  
  // If the message doesn't have a correlation ID, generate one
  if (!context.body.correlationId) {
    context.body.correlationId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    console.log(`Added correlation ID: ${context.body.correlationId} to message: ${context.messageId}`);
  }
  
  // Add to metadata for use by other middleware or handlers
  context.metadata.correlationId = context.body.correlationId;
  
  // Continue to the next middleware
  await next();
};

// Add the middleware to the consumer
consumer.use(correlationIdMiddleware);

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