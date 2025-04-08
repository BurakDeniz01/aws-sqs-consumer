# AWS SQS Consumer

A robust, high-performance AWS SQS consumer library for Node.js with advanced features:

- Configurable retry mechanism with exponential backoff
- Dead Letter Queue (DLQ) support
- Comprehensive metrics and monitoring with event emitters
- Batch message processing for improved performance
- Middleware system for message preprocessing/filtering
- Flexible AWS credentials and configuration
- TypeScript support with full type definitions

## Installation

```bash
npm install aws-sqs-consumer
```

## Basic Usage

```typescript
import {QueueConsumer} from 'aws-sqs-consumer';

// Create a consumer
const consumer = new QueueConsumer({
    url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
    handler: async (body) => {
        // Process message
        console.log('Processing message:', body);
    }
});

// Start consuming messages
consumer.run();
```

## Features

### AWS Credentials Configuration

The consumer supports multiple ways to configure AWS credentials:

```typescript
// Using default credential provider chain
const consumer = new QueueConsumer({
    url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
    handler: async (body) => { /* process message */
    },
    // Default: uses environment variables, shared credentials, EC2 instance profile, etc.
});
```

```typescript
// Using explicit credentials
const consumer = new QueueConsumer({
    url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
    handler: async (body) => { /* process message */
    },
    awsConfig: {
        accessKeyId: 'YOUR_ACCESS_KEY',
        secretAccessKey: 'YOUR_SECRET_KEY',
        sessionToken: 'YOUR_SESSION_TOKEN', // optional, for temporary credentials
    }
});
```

```typescript
// Using a named profile
const consumer = new QueueConsumer({
    url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
    handler: async (body) => { /* process message */
    },
    awsConfig: {
        profile: 'my-profile',
    }
});
```

```typescript
// Using a custom endpoint (for LocalStack or testing)
const consumer = new QueueConsumer({
    url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
    handler: async (body) => { /* process message */
    },
    awsConfig: {
        endpoint: 'http://localhost:4566',
    }
});
```

```typescript
// Using custom HTTP options (for proxies or timeouts)
const consumer = new QueueConsumer({
    url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
    handler: async (body) => { /* process message */
    },
    awsConfig: {
        httpOptions: {
            proxy: 'http://proxy.example.com:8080',
            timeout: 5000,
            connectTimeout: 1000,
        }
    }
});
```

### Retry Mechanism with Exponential Backoff

Configure the retry behavior for message processing failures:

```typescript
const consumer = new QueueConsumer({
    url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
    handler: async (body) => { /* process message */
    },
    retryOptions: {
        maxRetries: 5,                // Maximum retry attempts
        initialDelayMs: 1000,         // Starting delay before first retry
        backoffMultiplier: 2,         // Exponential backoff factor
        maxDelayMs: 60000,            // Maximum delay between retries
        extendVisibilityTimeout: true // Extend visibility timeout during retries
    }
});
```

### Dead Letter Queue (DLQ) Support

Configure automatic sending of failed messages to a Dead Letter Queue:

```typescript
const consumer = new QueueConsumer({
    url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
    handler: async (body) => { /* process message */
    },
    deadLetterQueueOptions: {
        enabled: true,
        queueUrl: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-dlq',
        includeFailureMetadata: true // Include error details with the message
    }
});
```

### Batch Processing for Improved Performance

Process multiple messages at once for better throughput:

```typescript
const consumer = new QueueConsumer({
    url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
    batchHandler: async (messages) => {
        // Process multiple messages at once
        console.log(`Processing ${messages.length} messages`);

        // Process messages in bulk (e.g., batch database operations)
        const results = await processMessagesBatch(messages.map(m => m.body));

        // Return processing results
        return {
            successful: messages.filter((_, i) => results[i].success).map(m => m.id),
            failed: messages
                .filter((_, i) => !results[i].success)
                .map((m, i) => ({
                    id: m.id,
                    error: results[i].error
                }))
        };
    },
    batchOptions: {
        enabled: true,
        maxBatchSize: 10,
        batchDeletes: true,
        atomicBatches: false, // Whether all messages must succeed or all fail
    }
});
```

### Middleware System for Message Preprocessing/Filtering

Add middleware to preprocess, transform, filter, or validate messages:

```typescript
import {QueueConsumer, loggingMiddleware, createFilterMiddleware} from 'aws-sqs-consumer';

const consumer = new QueueConsumer({
    url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
    handler: async (body) => { /* process message */
    },
    middlewareOptions: {
        enabled: true,
        respectFiltering: true, // Skip processing for filtered messages
    }
});

// Add logging middleware
consumer.use(loggingMiddleware);

// Add filtering middleware
consumer.use(createFilterMiddleware(body =>
    body.type === 'NOTIFICATION' && body.priority === 'HIGH'
));

// Add validation middleware
consumer.use(async (context, next) => {
    if (!isValidMessage(context.body)) {
        context.shouldProcess = false;
        return;
    }
    await next();
});

// Add transformation middleware
consumer.use(async (context, next) => {
    // Transform the message before processing
    context.body = {
        ...context.body,
        processedAt: new Date().toISOString(),
    };
    await next();
});
```

### Monitoring and Metrics

Monitor the consumer's performance using event emitters:

```typescript
const consumer = new QueueConsumer({
    url: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
    handler: async (body) => { /* process message */
    },
    metricsOptions: {
        enabled: true,
        includeMessageBody: false, // Don't include sensitive message content in metrics
        emitPerformanceMetrics: true,
    }
});

// Listen to events
consumer.on('consumer.started', (data) => {
    console.log('Consumer started', data);
});

consumer.on('message.processed', (data) => {
    console.log(`Message ${data.messageId} processed in ${data.processingTimeMs}ms`);
});

consumer.on('message.processing.failed', (data) => {
    console.error(`Message ${data.messageId} failed:`, data.error);
});

consumer.on('consumer.stopped', (metrics) => {
    console.log('Consumer stopped with metrics:', metrics);
});

// Get metrics at any time
const metrics = consumer.getMetrics();
console.log(`Processed ${metrics.messagesProcessed} messages with ${metrics.messagesFailed} failures`);
```

## License

MIT 