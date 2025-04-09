/**
 * Batch Processing Example
 * 
 * This example demonstrates how to process SQS messages in batches
 * for improved throughput and efficiency.
 */

import { QueueConsumer, ProcessedBatch } from '../src';

// Create a batch-enabled SQS consumer
const consumer = new QueueConsumer({
  // The URL of your SQS queue
  url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
  
  // Define batch handler function instead of individual message handler
  batchHandler: async (messages) => {
    // Log the batch size
    console.log(`Processing a batch of ${messages.length} messages`);
    
    // Process all messages in the batch
    const results = await processBatchOfMessages(messages);
    
    // Return the processing results
    return results;
  },
  
  // Configure batch processing options
  batchOptions: {
    enabled: true,           // Enable batch processing
    maxBatchSize: 10,        // Process up to 10 messages at once
    waitTimeSeconds: 5,      // Wait up to 5 seconds for messages
    batchDeletes: true,      // Delete messages in batches
    atomicBatches: false,    // If true, entire batch fails if any message fails
    visibilityTimeout: 30    // Visibility timeout in seconds
  }
});

/**
 * Example function that processes a batch of messages
 * Replace with your actual batch processing logic
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processBatchOfMessages(messages: any[]): Promise<ProcessedBatch> {
  // Simulate batch processing time
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Create a success result for each message
  // In real scenarios, you would likely process each differently
  const results: ProcessedBatch = {
    successful: messages.map(msg => msg.messageId),
    failed: []
  };
  
  console.log(`Successfully processed ${results.successful.length} messages`);
  return results;
}

/**
 * Handle shutdown signals
 */
function handleShutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down batch consumer...`);
  consumer.stop();
}

// Start consuming messages in batches
consumer.run();

// Set up signal handlers as requested
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export default consumer; 