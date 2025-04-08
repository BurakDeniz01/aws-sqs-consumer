/**
 * Basic SQS Consumer Example
 *
 * This example demonstrates how to set up a simple SQS consumer
 * that processes messages one at a time.
 */

import QueueConsumer from '../src';

// Create a basic SQS consumer
const consumer = new QueueConsumer({
    // The URL of your SQS queue
    url: 'https://sqs.eu-central-1.amazonaws.com/859749475761/test',

    // Handler function that processes each message
    handler: async (message) => {
        // Log the received message
        console.log('Processing message:', message);

        // Perform business logic with the message
        // For example, save to database, trigger an event, etc.
        await processMessage(message);
    }
});

/**
 * Example function that processes a message
 * Replace with your actual business logic
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processMessage(message: any): Promise<void> {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log('Message processed successfully:', message.messageId);
}

/**
 * Handle shutdown signals
 */
function handleShutdown(signal: string): void {
    console.log(`Received ${signal}, shutting down...`);
    consumer.stop();
}

// Set up signal handlers as requested
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

// Start consuming messages
consumer.run();