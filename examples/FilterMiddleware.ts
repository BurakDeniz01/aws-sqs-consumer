/**
 * Filter Middleware Example
 * 
 * This example demonstrates how to use filter middleware to selectively
 * process messages based on their content.
 */

import QueueConsumer, { MessageMiddleware } from '../src';

// Create an SQS consumer
const consumer = new QueueConsumer({
  url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
  handler: async (message) => {
    console.log('Processing message:', message.body);
    // Regular message handling logic
  },
  middlewareOptions: {
    enabled: true,
    respectFiltering: true,  // Skip handler if message is filtered
    applyToBatches: true
  }
});

// Create a filter middleware factory
const createFilterMiddleware = (predicate: (body: Record<string, unknown>) => boolean): MessageMiddleware => {
  return async (context, next) => {
    // Skip processing if body doesn't pass the predicate
    if (!predicate(context.body)) {
      context.shouldProcess = false;
      console.log(`Message ${context.messageId} filtered out`);
      return;
    }
    
    // Continue to the next middleware
    await next();
  };
};

// Create middleware instances with different filter conditions

// Filter 1: Only process messages with a specific type
const typeFilterMiddleware = createFilterMiddleware(
  (body) => body.type === 'IMPORTANT_EVENT'
);

// Filter 2: Only process messages from a specific source
const sourceFilterMiddleware = createFilterMiddleware(
  (body) => body.source === 'payment-service'
);

// Filter 3: Only process messages with a priority above a threshold
const priorityFilterMiddleware = createFilterMiddleware(
  (body) => (body.priority as number || 0) > 5
);

// Add the middleware to the consumer
consumer.use(typeFilterMiddleware);
consumer.use(sourceFilterMiddleware);
consumer.use(priorityFilterMiddleware);

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