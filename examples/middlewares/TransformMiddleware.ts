/**
 * Transform Middleware Example
 * 
 * This example demonstrates how to transform message bodies
 * before they reach the handler.
 */

import { QueueConsumer, MessageMiddleware } from '../../src';

// Create an SQS consumer
const consumer = new QueueConsumer({
  url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
  handler: async (message) => {
    // The handler receives the transformed message body
    console.log('Processing transformed message:', message.body);
    
    // You can access transformation-specific fields that were added
    if (message.body.transformedAt) {
      console.log(`Message was transformed at: ${message.body.transformedAt}`);
    }
  },
  middlewareOptions: {
    enabled: true,
    respectFiltering: true,
    applyToBatches: true
  }
});

// Create a transform middleware factory
const createTransformMiddleware = <T = Record<string, unknown>>(
  transform: (body: Record<string, unknown>) => T
): MessageMiddleware => {
  return async (context, next) => {
    // Transform the body
    context.body = transform(context.body);
    
    // Continue to the next middleware
    await next();
  };
};

// Create different transformation middlewares

// Transform 1: Add timestamp and format data
const timestampTransformMiddleware = createTransformMiddleware((body) => ({
  ...body,
  transformedAt: new Date().toISOString(),
  // Convert numeric strings to actual numbers
  amount: body.amount ? Number(body.amount) : undefined
}));

// Transform 2: Normalize field names (e.g., from legacy systems)
const normalizeFieldsMiddleware = createTransformMiddleware((body) => {
  const normalized: Record<string, unknown> = { ...body };
  
  // Map old field names to new ones
  if (body.user_id) {
    normalized.userId = body.user_id;
    delete normalized.user_id;
  }
  
  if (body.event_type) {
    normalized.eventType = body.event_type;
    delete normalized.event_type;
  }
  
  return normalized;
});

// Add the middleware to the consumer in sequence
// Order matters - normalizeFields runs first, then timestamp is added
consumer.use(normalizeFieldsMiddleware);
consumer.use(timestampTransformMiddleware);

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