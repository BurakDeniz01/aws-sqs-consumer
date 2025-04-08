import QueueConsumer from '../src';

/**
 * This example demonstrates how to implement priority-based queue switching
 * between high and low priority queues.
 *
 * Use case: Process high priority messages first, switch to low priority when high priority is empty.
 */

async function run() {
    // Configuration for our queues
    const queueConfig = {
        highPriorityUrl: process.env.HIGH_PRIORITY_QUEUE_URL || 'https://sqs.region.amazonaws.com/123456789012/high-priority-queue',
        lowPriorityUrl: process.env.LOW_PRIORITY_QUEUE_URL || 'https://sqs.region.amazonaws.com/123456789012/low-priority-queue',
    };

    // Create queue consumers for different priority levels
    const highPriorityConsumer = new QueueConsumer({
        url: queueConfig.highPriorityUrl,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handler: async (message: any) => {
            console.log(`Processing HIGH priority message: ${message.messageId}`);
            // Your high priority message processing logic here
            await new Promise(resolve => setTimeout(resolve, 500)); // Simulate processing
        }
    });

    const lowPriorityConsumer = new QueueConsumer({
        url: queueConfig.lowPriorityUrl,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        handler: async (message: any) => {
            console.log(`Processing LOW priority message: ${message.messageId}`);
            // Your low priority message processing logic here
            await new Promise(resolve => setTimeout(resolve, 300)); // Simulate processing
        }
    });

    highPriorityConsumer.setStoppedFunction(async () => {
        await lowPriorityConsumer.run();
    });

    lowPriorityConsumer.setStoppedFunction(async () => {
        await highPriorityConsumer.run();
    });

    // Function to check queue status and switch if needed
    async function checkAndSwitchQueues() {
        try {

            // Check approximate number of messages in each queue
            const highPriorityCount = await highPriorityConsumer.getAvailableQueueNumber();

            const lowPriorityCount = await lowPriorityConsumer.getAvailableQueueNumber();

            console.log(`Queue status - High Priority: ${highPriorityCount}, Low Priority: ${lowPriorityCount}`);

            // Implement switching logic
            if (highPriorityCount > 0 && !highPriorityConsumer.isRunning) {
                console.log('Starting high priority consumer...');
                lowPriorityConsumer.stop();
            } else if (highPriorityCount === 0 && lowPriorityCount > 0 && !lowPriorityConsumer.isRunning) {
                console.log('Starting low priority consumer...');
                highPriorityConsumer.stop();
            }
        } catch (error) {
            console.error('Error checking queue status:', error);
        }
    }

    // Check queues every 15 seconds
    setInterval(checkAndSwitchQueues, 15000);

    // Initial check and start
    console.log('Priority-based queue consumer system started 🚀');
    await checkAndSwitchQueues();
}

run().catch(console.error); 