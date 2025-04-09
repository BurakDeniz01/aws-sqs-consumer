/**
 * Enrichment Middleware Example
 * 
 * This example demonstrates how to enrich messages with additional data
 * from external sources before processing them.
 */

import { QueueConsumer, MessageMiddleware } from '../../src';

// Create an SQS consumer
const consumer = new QueueConsumer({
  url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
  handler: async (message) => {
    // The handler can access enriched data
    console.log('Processing message with enriched data:', message.body);
    
    // Access the enriched data
    if (message.body.enriched) {
      console.log('User details:', message.body.enriched.userDetails);
      console.log('Product details:', message.body.enriched.productDetails);
    }
  },
  middlewareOptions: {
    enabled: true,
    respectFiltering: true,
    applyToBatches: true
  }
});

// Create an enrichment middleware factory
const createEnrichmentMiddleware = <T = Record<string, unknown>>(
  enrichFunc: (body: Record<string, unknown>) => Promise<T>
): MessageMiddleware => {
  return async (context, next) => {
    try {
      // Enrich the message with additional data
      const enrichData = await enrichFunc(context.body);
      context.body.enriched = enrichData;
      context.metadata.enriched = true;
    } catch (error) {
      console.error(`Failed to enrich message ${context.messageId}:`, error);
      context.metadata.enrichmentFailed = true;
    }
    
    // Continue to the next middleware regardless of enrichment success
    await next();
  };
};

// Create mock functions to simulate fetching data from external services

/**
 * Mock function to fetch user details from an external service
 */
async function fetchUserDetails(userId: string): Promise<Record<string, unknown>> {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Return mock user data
  return {
    id: userId,
    name: `User ${userId}`,
    email: `user${userId}@example.com`,
    accountType: Math.random() > 0.5 ? 'premium' : 'standard',
    createdAt: new Date().toISOString()
  };
}

/**
 * Mock function to fetch product details from an external service
 */
async function fetchProductDetails(productId: string): Promise<Record<string, unknown>> {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Return mock product data
  return {
    id: productId,
    name: `Product ${productId}`,
    price: Math.floor(Math.random() * 10000) / 100,
    inStock: Math.random() > 0.2,
    categories: ['electronics', 'gadgets']
  };
}

// Create an enrichment function that combines data from multiple sources
async function enrichOrderData(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const enrichedData: Record<string, unknown> = {};
  
  // Fetch user details if user ID is present
  if (body.userId) {
    enrichedData.userDetails = await fetchUserDetails(body.userId as string);
  }
  
  // Fetch product details if product ID is present
  if (body.productId) {
    enrichedData.productDetails = await fetchProductDetails(body.productId as string);
  }
  
  // Add current time
  enrichedData.enrichedAt = new Date().toISOString();
  
  return enrichedData;
}

// Create middleware using the factory
const orderEnrichmentMiddleware = createEnrichmentMiddleware(enrichOrderData);

// Add the middleware to the consumer
consumer.use(orderEnrichmentMiddleware);

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