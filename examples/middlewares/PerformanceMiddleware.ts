/**
 * Performance Monitoring Middleware Example
 * 
 * This example demonstrates how to use middleware to monitor
 * the performance of message processing.
 */

import QueueConsumer, { MessageMiddleware } from '../../src';

// Create an SQS consumer
const consumer = new QueueConsumer({
  url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
  handler: async (message) => {
    // The handler can access timing information from metadata
    console.log(`Processing message with ID: ${message.messageId}`);
    
    // Simulate different processing times
    const processingTime = Math.random() * 300;
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Optionally record a specific stage
    if (message.metadata.timing) {
      message.metadata.timing.stages.businessLogic = {
        start: Date.now(),
        duration: processingTime
      };
    }
  },
  middlewareOptions: {
    enabled: true,
    respectFiltering: true,
    applyToBatches: true
  }
});

// Define performance monitoring middleware
const performanceMiddleware: MessageMiddleware = async (context, next) => {
  // Initialize timing data
  context.metadata.timing = {
    startTime: Date.now(),
    stages: {},
  };
  
  // Record stage timings
  await recordTiming(context, 'initialization', async () => {
    // Simulate some initialization work
    await new Promise(resolve => setTimeout(resolve, 10));
  });
  
  // Continue to the next middleware and track total processing time
  const startTime = Date.now();
  await next();
  const endTime = Date.now();
  
  // Record final timing data
  context.metadata.timing.endTime = endTime;
  context.metadata.timing.totalDuration = endTime - startTime;
  
  // Log performance metrics
  logPerformanceMetrics(context);
};

/**
 * Helper function to record the timing of a specific stage
 */
async function recordTiming(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any, 
  stageName: string, 
  fn: () => Promise<void>
): Promise<void> {
  const startTime = Date.now();
  await fn();
  const endTime = Date.now();
  
  // Record stage timing
  context.metadata.timing.stages[stageName] = {
    start: startTime,
    end: endTime,
    duration: endTime - startTime
  };
}

/**
 * Helper function to log performance metrics
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function logPerformanceMetrics(context: any): void {
  const timing = context.metadata.timing;
  
  // Only log if duration exceeds threshold (e.g., 1000ms)
  if (timing.totalDuration > 200) {
    console.warn(`Message ${context.messageId} processing took ${timing.totalDuration}ms`);
    
    // Log detailed stage timings
    Object.entries(timing.stages).forEach(([stage, data]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      console.warn(`  - Stage "${stage}": ${(data as any).duration}ms`);
    });
  } else {
    console.log(`Message ${context.messageId} processed in ${timing.totalDuration}ms`);
  }
  
  // In a real application, you might send these metrics to a monitoring system
  // sendMetricsToMonitoringSystem({
  //   messageId: context.messageId,
  //   processingTime: timing.totalDuration,
  //   stages: timing.stages
  // });
}

// Add the middleware to the consumer
consumer.use(performanceMiddleware);

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