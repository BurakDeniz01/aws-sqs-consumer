/**
 * Priority Sorting Middleware Example
 * 
 * This example demonstrates how to sort batch messages
 * by priority before processing them.
 */

import QueueConsumer, { BatchMiddleware, MiddlewareContext } from '../../src';

// Create an SQS consumer with batch processing
const consumer = new QueueConsumer({
  url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
  batchHandler: async (messages) => {
    console.log('Processing batch in priority order:');
    
    // Messages will already be sorted by priority due to middleware
    for (let i = 0; i < messages.length; i++) {
      const priority = messages[i].body.priority as number || 0;
      console.log(`Processing message ${i+1}/${messages.length} (priority: ${priority}): ${messages[i].id}`);
      
      // Simulate processing time - process higher priority messages faster
      const processingTime = 100 - (Math.min(priority, 10) * 5);
      await new Promise(resolve => setTimeout(resolve, processingTime));
    }
    
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

// Define priority sorting middleware
const prioritySortingMiddleware: BatchMiddleware = async (context, next) => {
  console.log(`Sorting batch of ${context.messages.length} messages by priority`);
  
  // Log priorities before sorting
  console.log('Priorities before sorting:', context.messages.map(msg => msg.body.priority || 0));
  
  // Sort messages by priority (if present in the body)
  context.messages.sort((a: MiddlewareContext, b: MiddlewareContext) => {
    const priorityA = typeof a.body.priority === 'number' ? a.body.priority : 0;
    const priorityB = typeof b.body.priority === 'number' ? b.body.priority : 0;
    return priorityB - priorityA; // Higher priority first
  });
  
  // Log priorities after sorting
  console.log('Priorities after sorting:', context.messages.map(msg => msg.body.priority || 0));
  
  // Continue to the next middleware
  await next();
  
  console.log('Batch processing completed');
};

// Add the middleware to the consumer
consumer.useBatch(prioritySortingMiddleware);

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