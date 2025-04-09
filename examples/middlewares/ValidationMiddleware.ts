/**
 * Validation Middleware Example
 * 
 * This example demonstrates how to validate messages
 * before processing them.
 */

import { QueueConsumer, MessageMiddleware } from '../../src';

// Create an SQS consumer
const consumer = new QueueConsumer({
  url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
  handler: async (message) => {
    // By the time the handler is called, we know the message is valid
    console.log('Processing validated message:', message.body);
    
    // You can access validation metadata if needed
    if (message.metadata.validationPassed) {
      console.log('Message passed validation');
    }
  },
  middlewareOptions: {
    enabled: true,
    respectFiltering: true,  // Skip handler if validation fails
    applyToBatches: true
  }
});

// Create a validation middleware factory
const createValidationMiddleware = (
  validator: (body: Record<string, unknown>) => { valid: boolean, errors?: string[] }
): MessageMiddleware => {
  return async (context, next) => {
    const result = validator(context.body);
    
    if (!result.valid) {
      context.shouldProcess = false;
      context.metadata.validationErrors = result.errors;
      console.error(`Validation failed for message ${context.messageId}`, {
        errors: result.errors,
        body: context.body,
      });
      return;
    }
    
    // Add validation metadata for downstream middleware/handlers
    context.metadata.validationPassed = true;
    
    // Continue to the next middleware
    await next();
  };
};

// Define validation rules for different message types

// Order validation
const orderValidator = (body: Record<string, unknown>) => {
  const errors: string[] = [];
  
  if (!body.orderId) {
    errors.push('Missing orderId');
  }
  
  if (!body.customerId) {
    errors.push('Missing customerId');
  }
  
  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    errors.push('Order must contain at least one item');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
};

// Payment validation
const paymentValidator = (body: Record<string, unknown>) => {
  const errors: string[] = [];
  
  if (!body.paymentId) {
    errors.push('Missing paymentId');
  }
  
  if (!body.amount || typeof body.amount !== 'number' || body.amount <= 0) {
    errors.push('Amount must be a positive number');
  }
  
  if (!body.currency || typeof body.currency !== 'string') {
    errors.push('Currency is required');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
};

// Create middleware instances for each message type
const orderValidationMiddleware = createValidationMiddleware(orderValidator);
const paymentValidationMiddleware = createValidationMiddleware(paymentValidator);

// Type-based validation - apply different validators based on message type
const typeBasedValidationMiddleware: MessageMiddleware = async (context, next) => {
  const messageType = context.body.type as string;
  
  if (messageType === 'order') {
    // Create a sub-context just for this validation
    const orderValidationContext = { ...context };
    
    await orderValidationMiddleware(orderValidationContext, async () => {
      // If we reach here, order validation passed
      // But we don't call next() yet - that happens outside this function
    });
    
    // Copy validation results to the original context
    context.shouldProcess = orderValidationContext.shouldProcess;
    context.metadata = { ...context.metadata, ...orderValidationContext.metadata };
    
    if (!context.shouldProcess) {
      // Order validation failed, skip further processing
      return;
    }
  } else if (messageType === 'payment') {
    // Create a sub-context just for this validation
    const paymentValidationContext = { ...context };
    
    await paymentValidationMiddleware(paymentValidationContext, async () => {
      // If we reach here, payment validation passed
    });
    
    // Copy validation results to the original context
    context.shouldProcess = paymentValidationContext.shouldProcess;
    context.metadata = { ...context.metadata, ...paymentValidationContext.metadata };
    
    if (!context.shouldProcess) {
      // Payment validation failed, skip further processing
      return;
    }
  } else {
    // Unknown message type
    context.shouldProcess = false;
    context.metadata.validationErrors = ['Unknown message type'];
    console.error(`Unknown message type: ${messageType}`);
    return;
  }
  
  // Continue to the next middleware
  await next();
};

// Add the middleware to the consumer
consumer.use(typeBasedValidationMiddleware);

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