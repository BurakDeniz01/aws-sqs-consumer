/**
 * Middleware Usage Example
 * 
 * This example demonstrates how to use middleware to add functionality
 * to an SQS consumer without modifying the core message handler.
 */

import  { QueueConsumer, MessageMiddleware } from '../src';

// Create an SQS consumer with middleware support
const consumer = new QueueConsumer({
  // The URL of your SQS queue
  url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
  
  // Simple message handler
  handler: async (message) => {
    // The handler can focus on just processing the message
    // All cross-cutting concerns are handled by middleware
    console.log('Processing message:', message.body);
  },
  
  // Enable middleware
  middlewareOptions: {
    enabled: true,
    respectFiltering: true,  // Skip handler if middleware filters message
    applyToBatches: true     // Apply middleware to batch processing too
  }
});

// Logging middleware - logs when messages are received and processed
const loggingMiddleware: MessageMiddleware = async (context, next) => {
  console.log(`[${new Date().toISOString()}] Received message: ${context.messageId}`);
  
  // Track time for performance monitoring
  const startTime = Date.now();
  
  // Pass control to the next middleware
  await next();
  
  // Log after processing completes
  const duration = Date.now() - startTime;
  console.log(`[${new Date().toISOString()}] Processed message: ${context.messageId} in ${duration}ms`);
};

// Validation middleware - ensures message has required fields
const validationMiddleware: MessageMiddleware = async (context, next) => {
  // Check if message has required fields
  if (!context.body.userId || !context.body.action) {
    console.warn(`Invalid message ${context.messageId}: missing required fields`);
    context.shouldProcess = false;  // Skip further processing
    return;
  }
  
  // Pass control to the next middleware
  await next();
};

// Enrichment middleware - adds additional data to the message
const enrichmentMiddleware: MessageMiddleware = async (context, next) => {
  // Add a timestamp for when we received the message
  context.body.processedAt = new Date().toISOString();
  
  // Add metadata that handlers can use
  context.metadata.environment = process.env.NODE_ENV || 'development';
  
  // Pass control to the next middleware
  await next();
};

// Add middleware to the consumer in the desired execution order
consumer.use(loggingMiddleware);     // First, log message receipt
consumer.use(validationMiddleware);   // Then, validate message structure
consumer.use(enrichmentMiddleware);   // Finally, enrich with additional data

// Start consuming messages
consumer.run();

/**
 * Handle shutdown signals
 */
function handleShutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down middleware-enabled consumer...`);
  consumer.stop();
}

// Set up signal handlers as requested
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export default consumer; 