/**
 * Custom AWS Configuration Example
 * 
 * This example demonstrates how to customize the AWS configuration
 * for the SQS consumer, such as using custom credentials, region,
 * profile, or connecting to LocalStack for local development.
 */

import QueueConsumer from '../src';

// Create an SQS consumer with custom AWS configuration
const consumer = new QueueConsumer({
  // The URL of your SQS queue
  url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
  
  // Simple message handler
  handler: async (message) => {
    console.log('Processing message:', message.body);
  },
  
  // Custom AWS configuration
  awsConfig: {
    // Option 1: Explicit credentials
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
    
    // Option 2: Use named profile (uncomment to use)
    // profile: 'my-profile',
    // useDefaultCredentialProviderChain: false,
    
    // Custom region
    region: 'eu-west-1',
    
    // Option 3: Connect to LocalStack (uncomment to use)
    // endpoint: 'http://localhost:4566',
    
    // HTTP options for AWS SDK
    httpOptions: {
      // Connect through a proxy (useful in some corporate environments)
      // proxy: 'http://corporate-proxy:8080',
      
      // Configure timeouts
      timeout: 5000,       // Request timeout in ms
      connectTimeout: 1000 // Connection timeout in ms
    }
  }
});

// Start consuming messages
consumer.run();

/**
 * Handle shutdown signals
 */
function handleShutdown(signal: string): void {
  console.log(`Received ${signal}, shutting down custom-configured consumer...`);
  consumer.stop();
}

// Set up signal handlers as requested
process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

export default consumer; 