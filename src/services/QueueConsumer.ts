import {
    ChangeMessageVisibilityCommand,
    DeleteMessageBatchCommand,
    DeleteMessageBatchRequestEntry,
    DeleteMessageCommand,
    GetQueueAttributesCommand,
    Message,
    ReceiveMessageCommand,
    SQSClient,
    SQSClientConfig
} from '@aws-sdk/client-sqs';
import { fromIni } from '@aws-sdk/credential-providers';
import { NodeHttpHandler } from '@aws-sdk/node-http-handler';
import { EventEmitter } from 'events';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { QueueConsumerEvents } from '../enums/events';
import { AwsConfig, ConsumerOptions } from '../interfaces/config';
import DeadLetterQueueOptions from '../interfaces/dlq';
import { ParsedMessage } from '../interfaces/messages';
import MetricsOptions, { ConsumerMetrics, ErrorMetrics, MessageProcessingMetrics } from '../interfaces/metrics';
import { BatchMiddlewareContext, MiddlewareContext, MiddlewareOptions } from '../interfaces/middleware';
import BatchOptions from '../interfaces/options';
import RetryOptions from '../interfaces/retry';
import { BatchMessageHandler, MessageHandler } from '../types/handlers';
import { BatchMiddleware, MessageMiddleware } from '../types/middleware';

/**
 * QueueConsumer class for processing AWS SQS queue messages
 * Provides both individual message processing and batch processing capabilities
 * Supports middleware, retry logic, dead letter queues, and performance metrics
 */
export default class QueueConsumer extends EventEmitter {

    private readonly _client: SQSClient;

    private readonly _url: string;

    private readonly _handler: MessageHandler | undefined;

    private readonly _batchHandler: BatchMessageHandler | undefined;

    private _isShuttingDown = false;

    private _isRunning = false;

    private _stoppedFunction: (() => Promise<void>) | null = null;

    private readonly _retryOptions: RetryOptions;

    private readonly _dlqOptions: DeadLetterQueueOptions;

    private readonly _metricsOptions: MetricsOptions;

    private readonly _batchOptions: BatchOptions;

    private readonly _middlewareOptions: MiddlewareOptions;

    private readonly _awsConfig: AwsConfig;

    // Middleware stacks
    private _messageMiddleware: MessageMiddleware[] = [];
    private _batchMiddleware: BatchMiddleware[] = [];

    // Metrics tracking
    private _startTime: Date = new Date();
    private _messagesProcessed = 0;
    private _messagesFailed = 0;
    private _messagesSentToDlq = 0;
    private _totalRetries = 0;
    private _totalProcessingTime = 0;
    private _messagesFiltered = 0;

    private static readonly DEFAULT_RETRY_OPTIONS: RetryOptions = {
        maxRetries: 3,
        initialDelayMs: 500,
        backoffMultiplier: 2,
        maxDelayMs: 30000,
        extendVisibilityTimeout: true,
    };

    private static readonly DEFAULT_DLQ_OPTIONS: DeadLetterQueueOptions = {
        queueUrl: '',
        enabled: false,
        includeFailureMetadata: true,
    };

    private static readonly DEFAULT_METRICS_OPTIONS: MetricsOptions = {
        enabled: true,
        includeMessageBody: false,
        emitPerformanceMetrics: true,
    };

    private static readonly DEFAULT_BATCH_OPTIONS: BatchOptions = {
        enabled: false,
        maxBatchSize: 10,
        batchDeletes: true,
        waitTimeSeconds: 5,
        visibilityTimeout: 115,
        atomicBatches: false,
    };

    private static readonly DEFAULT_MIDDLEWARE_OPTIONS: MiddlewareOptions = {
        enabled: false,
        respectFiltering: true,
        applyToBatches: true,
    };

    private static readonly DEFAULT_AWS_CONFIG: AwsConfig = {
        useDefaultCredentialProviderChain: true,
    };

    /**
     * Creates a new QueueConsumer instance
     * @param options Configuration options for the consumer
     */
    constructor(options: ConsumerOptions) {
        super();
        this._url = options.url;
        this._handler = options.handler;
        this._batchHandler = options.batchHandler;
        this._retryOptions = {
            ...QueueConsumer.DEFAULT_RETRY_OPTIONS,
            ...options.retryOptions || {},
        };
        this._dlqOptions = {
            ...QueueConsumer.DEFAULT_DLQ_OPTIONS,
            ...options.deadLetterQueueOptions || {},
        };
        this._metricsOptions = {
            ...QueueConsumer.DEFAULT_METRICS_OPTIONS,
            ...options.metricsOptions || {},
        };
        this._batchOptions = {
            ...QueueConsumer.DEFAULT_BATCH_OPTIONS,
            ...options.batchOptions || {},
        };
        this._middlewareOptions = {
            ...QueueConsumer.DEFAULT_MIDDLEWARE_OPTIONS,
            ...options.middlewareOptions || {},
        };
        this._awsConfig = {
            ...QueueConsumer.DEFAULT_AWS_CONFIG,
            ...options.awsConfig || {},
        };

        // Initialize SQS client with credentials and configuration
        if (options.sqs) {
            this._client = options.sqs;
        } else {
            const region = this.getRegionFromQueueUrl(this._url);

            const clientConfig: SQSClientConfig = {
                region: this._awsConfig.region || region,
            };

            // Apply AWS configuration if provided
            if (this._awsConfig.accessKeyId && this._awsConfig.secretAccessKey) {
                // Use explicit credentials
                clientConfig.credentials = {
                    accessKeyId: this._awsConfig.accessKeyId,
                    secretAccessKey: this._awsConfig.secretAccessKey,
                    sessionToken: this._awsConfig.sessionToken
                };
            } else if (this._awsConfig.profile) {
                // Use profile credentials
                clientConfig.credentials = fromIni({
                    profile: this._awsConfig.profile,
                });
            }

            // Apply custom endpoint if provided (for testing or LocalStack)
            if (this._awsConfig.endpoint) {
                clientConfig.endpoint = this._awsConfig.endpoint;
            }

            // Apply HTTP options if provided
            if (this._awsConfig.httpOptions) {
                if (this._awsConfig.httpOptions.proxy) {
                    // Create a proxy agent if a proxy URL is provided
                    const proxyAgent = new HttpsProxyAgent(this._awsConfig.httpOptions.proxy);
                    clientConfig.requestHandler = new NodeHttpHandler({
                        httpAgent: proxyAgent,
                        httpsAgent: proxyAgent,
                    });
                }

                // Configure timeouts
                if (this._awsConfig.httpOptions.timeout || this._awsConfig.httpOptions.connectTimeout) {
                    clientConfig.requestHandler = new NodeHttpHandler({
                        connectionTimeout: this._awsConfig.httpOptions.connectTimeout,
                        requestTimeout: this._awsConfig.httpOptions.timeout,
                    });
                }
            }

            this._client = new SQSClient(clientConfig);
        }
    }


    /**
     * Starts the queue consumer
     * @returns This instance for chaining
     */
    public async run(): Promise<void> {
        if (this._isRunning) {
            return;
        }

        this._isRunning = true;
        this._startTime = new Date();

        // Reset metrics on start
        this._messagesProcessed = 0;
        this._messagesFailed = 0;
        this._messagesSentToDlq = 0;
        this._totalRetries = 0;
        this._totalProcessingTime = 0;
        this._messagesFiltered = 0;

        if (this._metricsOptions.enabled) {
            this.emit(QueueConsumerEvents.STARTED, this.getMetrics());
        }

        // Start polling for messages
        await this.pollMessages();
    }

    /**
     * Stops the queue consumer gracefully
     * @returns Promise that resolves when consumer has fully stopped
     */
    public stop(): void {
        if (!this._isRunning) {
            return;
        }

        this._isShuttingDown = true;

    }

    /**
     * Returns the number of available messages in the queue
     * @returns Promise resolving to the number of available messages
     */
    public async getAvailableQueueNumber(): Promise<number> {
        const data = await this._client.send(
            new GetQueueAttributesCommand({
                QueueUrl: this._url,
                AttributeNames: ['ApproximateNumberOfMessages'],
            })
        );
        const availableMessages = data?.Attributes?.ApproximateNumberOfMessages;

        if (availableMessages == null) return 0;

        return parseInt(availableMessages);
    }


    /**
     * Sets a function to be called when the consumer stops
     * @param stopFunction Function to execute when consumer stops
     */
    public setStoppedFunction(stopFunction: () => Promise<void>): void {
        this._stoppedFunction = stopFunction;
    }


    /**
     * Registers a message middleware function
     * @param middleware The middleware function to register
     * @returns This instance for chaining
     */
    public use(middleware: MessageMiddleware): QueueConsumer {
        this._messageMiddleware.push(middleware);
        return this;
    }

    /**
     * Registers a batch middleware function
     * @param middleware The middleware function to register
     * @returns This instance for chaining
     */
    public useBatch(middleware: BatchMiddleware): QueueConsumer {
        this._batchMiddleware.push(middleware);
        return this;
    }

    public get isRunning(): boolean {
        return this._isRunning;
    }

    /**
     * Extract region from queue URL
     * @param queueUrl The SQS queue URL
     * @returns The AWS region extracted from the URL
     */
    private getRegionFromQueueUrl(queueUrl: string): string {
        try {
            // Parse queue URL to extract region
            // Format: https://sqs.{region}.amazonaws.com/{account}/{queue}
            const matches = queueUrl.match(/sqs\.([^.]+)\.amazonaws\.com/);
            return matches && matches[1] ? matches[1] : 'us-east-1'; // Default to us-east-1
        } catch (err) {
            console.warn('Could not extract region from queue URL, using default');
            return 'us-east-1';
        }
    }

    /**
     * Process received messages
     * @param messages Array of SQS messages to process
     */
    private async processMessages(messages: Message[]): Promise<void> {
        try {
            // For standard queues, process all messages with the same group ID
            const groupId = 'standard-queue-group';

            if (this._batchOptions.enabled && this._batchHandler) {
                // Process the entire batch with the batch handler
                await this.processBatchWithBatchHandler(groupId, messages);
            } else {
                // Process each message individually
                await this.processMessageGroup(groupId, messages);
            }
        } catch (err) {
            console.error('Error processing messages', err);
            if (this._metricsOptions.enabled) {
                this.emit(QueueConsumerEvents.ERROR, {
                    error: err,
                    context: 'message_processing',
                });
            }
        }
    }

    /**
     * Get consumer metrics
     * @returns Object containing current consumer metrics
     */
    private getMetrics(): ConsumerMetrics {
        const now = new Date();
        const activeTimeMs = now.getTime() - this._startTime.getTime();

        return {
            queueUrl: this._url,
            activeTimeMs,
            messagesProcessed: this._messagesProcessed,
            messagesFailed: this._messagesFailed,
            messagesSentToDlq: this._messagesSentToDlq,
            retryCount: this._totalRetries,
            startTime: this._startTime.toISOString(),
            averageProcessingTimeMs: this._messagesProcessed > 0
                ? this._totalProcessingTime / this._messagesProcessed
                : 0,
        };
    }

    /**
     * Process a group of messages
     * @param groupId Group ID for the messages
     * @param messages Array of SQS messages to process
     */
    private async processMessageGroup(groupId: string, messages: Message[]): Promise<void> {
        for (const message of messages) {
            try {
                await this.processIndividualMessage(message, groupId);
            } catch (err) {
                console.error('Error processing individual message', {
                    messageId: message.MessageId,
                    error: err
                });
            }
        }
    }

    /**
     * Process an individual message
     * @param message SQS message to process
     * @param groupId Group ID for the message
     */
    private async processIndividualMessage(message: Message, groupId: string): Promise<void> {
        // Implementation for processing individual messages
        // This would include middleware, retry logic, etc.
        // For now, just a placeholder
        if (!this._handler) return;
        const parsed = this.parseMessage(message, groupId);
        if (!parsed) return;

        try {
            // Apply middleware if enabled
            if (this._middlewareOptions.enabled) {
                const middlewareContext: MiddlewareContext = {
                    message,
                    body: parsed.body,
                    messageId: parsed.id,
                    groupId,
                    metadata: {},
                    shouldProcess: true
                };

                await this.executeMessageMiddlewarePipeline(middlewareContext);

                // Skip processing if middleware indicated to filter this message
                if (this._middlewareOptions.respectFiltering && !middlewareContext.shouldProcess) {
                    this._messagesFiltered++;
                    return;
                }

                // Use potentially modified body from middleware
                parsed.body = middlewareContext.body;
            }
            await this._handler(parsed.body);
            // Handle success, delete message, etc.
        } catch (err) {
            // Handle error, retry logic, etc.
            await this.sendToDeadLetterQueue(message, err, 0);
        }
    }

    /**
     * Execute batch middleware pipeline
     * @param context Batch middleware context
     */
    private async executeBatchMiddlewarePipeline(context: BatchMiddlewareContext): Promise<void> {
        if (!this._middlewareOptions.enabled || this._batchMiddleware.length === 0) {
            return;
        }

        let index = 0;
        const next = async (): Promise<void> => {
            if (index < this._batchMiddleware.length) {
                const middleware = this._batchMiddleware[index++];
                await middleware(context, next);
            }
        };

        await next();
    }

    /**
     * Execute message middleware pipeline
     * @param context Message middleware context
     */
    private async executeMessageMiddlewarePipeline(context: MiddlewareContext): Promise<void> {
        if (!this._middlewareOptions.enabled || this._messageMiddleware.length === 0) {
            return;
        }

        let index = 0;
        const next = async (): Promise<void> => {
            if (index < this._messageMiddleware.length) {
                const middleware = this._messageMiddleware[index++];
                await middleware(context, next);
            }
        };

        await next();
    }

    /**
     * Send a failed message to the Dead Letter Queue
     * @param message Failed SQS message
     * @param error Error that caused the failure
     * @param retryCount Number of retries attempted
     */
    private async sendToDeadLetterQueue(message: Message, error: any, retryCount: number): Promise<void> {
        // Implementation for sending to DLQ
        // This is a placeholder
        if (!this._dlqOptions.enabled || !this._dlqOptions.queueUrl) {
            console.warn('DLQ not configured, failed message will be lost', {
                messageId: message.MessageId,
                error
            });
            return;
        }

        try {
            // Send to DLQ implementation would go here
            this._messagesSentToDlq++;

            if (this._metricsOptions.enabled) {
                this.emit(QueueConsumerEvents.MESSAGE_SENT_TO_DLQ, {
                    messageId: message.MessageId,
                    error,
                    retryCount
                });
            }
        } catch (err) {
            console.error('Failed to send message to DLQ', {
                messageId: message.MessageId,
                error: err
            });

            if (this._metricsOptions.enabled) {
                this.emit(QueueConsumerEvents.MESSAGE_DLQ_FAILED, {
                    messageId: message.MessageId,
                    error: err
                });
            }
        }
    }

    /**
     * Calculate retry backoff delay using exponential backoff
     * @param retryCount Current retry attempt number
     * @returns Delay in milliseconds before next retry
     */
    private calculateBackoffDelay(retryCount: number): number {
        const {initialDelayMs, backoffMultiplier, maxDelayMs} = this._retryOptions;
        const delay = initialDelayMs * Math.pow(backoffMultiplier, retryCount);
        return Math.min(delay, maxDelayMs);
    }

    /**
     * Extend visibility timeout for a message
     * @param message SQS message
     * @param visibilityTimeout New visibility timeout in seconds
     */
    private async extendMessageVisibility(message: Message, visibilityTimeout: number): Promise<void> {
        if (!message.ReceiptHandle) return;

        try {
            await this._client.send(new ChangeMessageVisibilityCommand({
                QueueUrl: this._url,
                VisibilityTimeout: visibilityTimeout,
                ReceiptHandle: message.ReceiptHandle
            }));
        } catch (err) {
            console.error('Failed to extend message visibility timeout', {
                messageId: message.MessageId,
                error: err
            });
        }
    }

    /**
     * Sleep for a specified duration
     * @param ms Time to sleep in milliseconds
     */
    private async sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Main polling loop for retrieving messages from the queue
     */
    private async pollMessages(): Promise<void> {
        this._isShuttingDown = false;
        while (!this._isShuttingDown) {
            try {
                const command = new ReceiveMessageCommand({
                    QueueUrl: this._url,
                    MaxNumberOfMessages: this._batchOptions.enabled ? this._batchOptions.maxBatchSize : 4,
                    WaitTimeSeconds: this._batchOptions.waitTimeSeconds,
                    VisibilityTimeout: this._batchOptions.visibilityTimeout,
                    MessageSystemAttributeNames: ['MessageGroupId'],
                });

                const response = await this._client.send(command);

                if (response.Messages && response.Messages.length > 0) {
                    await this.processMessages(response.Messages);
                }
            } catch (err) {
                console.error('Error when get new queue', err);

                if (this._metricsOptions.enabled) {
                    this.emit(QueueConsumerEvents.ERROR, {
                        error: err,
                        context: 'polling',
                    });
                }
            }

            // Emit performance metrics periodically
            if (this._metricsOptions.enabled && this._metricsOptions.emitPerformanceMetrics) {
                this.emit(QueueConsumerEvents.PERFORMANCE_METRICS, this.getMetrics());
            }
        }


        if (this._stoppedFunction !== null) {
            await this._stoppedFunction();
        }


        // Final metrics emission
        if (this._metricsOptions.enabled) {
            this.emit(QueueConsumerEvents.STOPPED, this.getMetrics());
        }

        this._isRunning = false;
    }

    /**
     * Parses an SQS message into a more usable format
     * @param message Raw SQS message
     * @param groupId Group ID for the message
     * @returns Parsed message or null if parsing failed
     */
    private parseMessage(message: Message, groupId: string): ParsedMessage | null {
        try {
            const body = JSON.parse(message.Body || 'null');

            if (body == null) {
                return null; // Invalid message
            }

            return {
                original: message,
                body,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                id: message.MessageId!,
                groupId,
            };
        } catch (err) {
            console.error('Failed to parse message body', {
                messageId: message.MessageId,
                error: err,
            });
            return null;
        }
    }

    /**
     * Deletes a batch of messages in a single SQS request
     * @param messages Array of SQS messages to delete
     * @returns Object containing arrays of successful and failed message IDs
     */
    private async deleteMessageBatch(messages: Message[]): Promise<{ successful: string[], failed: string[] }> {
        if (!messages.length) {
            return {successful: [], failed: []};
        }

        try {
            const entries: DeleteMessageBatchRequestEntry[] = messages.map(message => ({
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                Id: message.MessageId!,
                ReceiptHandle: message.ReceiptHandle,
            }));

            const response = await this._client.send(
                new DeleteMessageBatchCommand({
                    QueueUrl: this._url,
                    Entries: entries,
                })
            );

            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const successful = (response.Successful || []).map(s => s.Id!);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const failed = (response.Failed || []).map(f => f.Id!);

            if (failed.length && this._metricsOptions.enabled) {
                this.emit(QueueConsumerEvents.ERROR, {
                    error: new Error(`Failed to delete ${failed.length} messages`),
                    context: 'batch_delete',
                    messageIds: failed,
                });
            }

            return {successful, failed};
        } catch (err) {
            console.error('Failed to delete message batch', {error: err});

            if (this._metricsOptions.enabled) {
                this.emit(QueueConsumerEvents.ERROR, {
                    error: err,
                    context: 'batch_delete',
                });
            }

            return {
                successful: [],
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                failed: messages.map(m => m.MessageId!),
            };
        }
    }

    /**
     * Process a batch of messages using the batch handler
     * @param groupId Group ID for the batch
     * @param messages Array of SQS messages to process as a batch
     */
    private async processBatchWithBatchHandler(
        groupId: string,
        messages: Message[]
    ): Promise<void> {
        // Safeguard: fall back to individual processing if no batch handler
        if (!this._batchHandler) {
            await this.processMessageGroup(groupId, messages);
            return;
        }

        const batchStartTime = new Date();
        let retryCount = 0;
        let succeeded = false;

        // If batch middleware is enabled, apply it to the entire group first
        if (this._middlewareOptions.enabled && this._middlewareOptions.applyToBatches) {
            // Parse messages first for middleware
            const messageContexts: MiddlewareContext[] = messages.map(message => {
                try {
                    const body = JSON.parse(message.Body || 'null');
                    return {
                        message,
                        body,
                        messageId: message.MessageId || 'unknown',
                        groupId,
                        metadata: {},
                        shouldProcess: body != null
                    };
                } catch (err) {
                    return {
                        message,
                        body: null,
                        messageId: message.MessageId || 'unknown',
                        groupId,
                        metadata: {},
                        shouldProcess: false
                    };
                }
            });

            const batchContext: BatchMiddlewareContext = {
                messages: messageContexts,
                groupId,
                metadata: {}
            };

            // Apply batch middleware
            await this.executeBatchMiddlewarePipeline(batchContext);

            // Filter out messages that should be skipped based on middleware
            if (this._middlewareOptions.respectFiltering) {
                const filteredMessages = messages.filter((_msg, index) => {
                    const shouldProcess = messageContexts[index].shouldProcess;
                    if (!shouldProcess) {
                        this._messagesFiltered++;
                    }
                    return shouldProcess;
                });

                // If all messages were filtered out, we're done
                if (filteredMessages.length === 0) {
                    return;
                }

                // Process only the filtered messages
                messages = filteredMessages;
            }
        }

        // Parse messages first
        const parsedMessages: ParsedMessage[] = [];

        for (const message of messages) {
            const parsed = this.parseMessage(message, groupId);

            if (parsed) {
                parsedMessages.push(parsed);
            } else {
                this._messagesFailed++;

                // Send invalid messages to DLQ
                await this.sendToDeadLetterQueue(
                    message,
                    new Error('Invalid message body'),
                    0
                );
            }
        }

        if (this._metricsOptions.enabled) {
            this.emit(QueueConsumerEvents.BATCH_PROCESSING_STARTED, {
                groupId,
                messageCount: parsedMessages.length,
                startTime: batchStartTime.toISOString(),
            });

            // Emit received events for each message
            for (const parsed of parsedMessages) {
                this.emit(QueueConsumerEvents.MESSAGE_RECEIVED, {
                    messageId: parsed.id,
                    groupId,
                    receivedAt: new Date().toISOString(),
                });
            }
        }

        if (parsedMessages.length === 0) {
            // All messages were invalid, nothing to process
            const batchEndTime = new Date();

            if (this._metricsOptions.enabled) {
                this.emit(QueueConsumerEvents.BATCH_PROCESSING_COMPLETED, {
                    groupId,
                    messageCount: 0,
                    processingTimeMs: batchEndTime.getTime() - batchStartTime.getTime(),
                    startTime: batchStartTime.toISOString(),
                    endTime: batchEndTime.toISOString(),
                });
            }
            return;
        }

        // Process the batch with retry logic
        while (retryCount <= this._retryOptions.maxRetries && !succeeded) {
            const processingStartTime = new Date();

            if (this._metricsOptions.enabled) {
                this.emit(QueueConsumerEvents.MESSAGE_PROCESSING_STARTED, {
                    batchSize: parsedMessages.length,
                    groupId,
                    retryAttempt: retryCount,
                    startTime: processingStartTime.toISOString(),
                });
            }

            try {
                // Process the entire batch with the non-null batchHandler (already checked above)
                const batchHandler = this._batchHandler;
                const result = await batchHandler(parsedMessages);
                const processingEndTime = new Date();
                const processingTimeMs = processingEndTime.getTime() - processingStartTime.getTime();

                // If atomic batches are required and any message failed, throw to retry the whole batch
                if (this._batchOptions.atomicBatches && result.failed.length > 0) {
                    const failedIds = result.failed.map((f: { id: string }) => f.id).join(', ');
                    // noinspection ExceptionCaughtLocallyJS
                    throw new Error(`Atomic batch processing failed for messages: ${failedIds}`);
                }

                // Count successful messages
                this._messagesProcessed += result.successful.length;
                this._totalProcessingTime += processingTimeMs;

                if (result.failed.length > 0) {
                    this._messagesFailed += result.failed.length;
                }

                // Delete successful messages
                const successfulMessages = result.successful
                    .map((id: string) => parsedMessages.find(m => m.id === id)?.original)
                    .filter((m: Message | undefined) => m) as Message[];

                // Delete successful messages (either in batch or individually)
                if (successfulMessages.length > 0) {
                    if (this._batchOptions.batchDeletes) {
                        await this.deleteMessageBatch(successfulMessages);
                    } else {
                        for (const message of successfulMessages) {
                            await this._client.send(
                                new DeleteMessageCommand({
                                    QueueUrl: this._url,
                                    ReceiptHandle: message.ReceiptHandle,
                                })
                            );
                        }
                    }
                }

                // Send failed messages to DLQ
                for (const item of result.failed) {
                    const message = parsedMessages.find(m => m.id === item.id)?.original;
                    if (message) {
                        await this.sendToDeadLetterQueue(message, item.error, retryCount);
                    }
                }

                // Emit metrics
                if (this._metricsOptions.enabled) {
                    // Emit success events for successful messages
                    for (const id of result.successful) {
                        const parsed = parsedMessages.find((m: ParsedMessage) => m.id === id);
                        if (parsed) {
                            const processingMetrics: MessageProcessingMetrics = {
                                messageId: parsed.id,
                                groupId,
                                processingTimeMs,
                                retryCount,
                                startTime: processingStartTime.toISOString(),
                                endTime: processingEndTime.toISOString(),
                                body: this._metricsOptions.includeMessageBody ? parsed.body : undefined,
                            };

                            this.emit(QueueConsumerEvents.MESSAGE_PROCESSED, processingMetrics);
                        }
                    }

                    // Emit failure events for failed messages
                    for (const failed of result.failed) {
                        const parsed = parsedMessages.find((m: ParsedMessage) => m.id === failed.id);
                        if (parsed) {
                            const errorMetrics: ErrorMetrics = {
                                messageId: parsed.id,
                                error: failed.error,
                                retryAttempt: retryCount,
                                willRetry: false,
                                body: this._metricsOptions.includeMessageBody ? parsed.body : undefined,
                            };

                            this.emit(QueueConsumerEvents.MESSAGE_PROCESSING_FAILED, errorMetrics);
                        }
                    }

                    // Emit overall batch metrics
                    this.emit(QueueConsumerEvents.BATCH_PROCESSING_COMPLETED, {
                        groupId,
                        messageCount: parsedMessages.length,
                        processingTimeMs,
                        startTime: processingStartTime.toISOString(),
                        endTime: processingEndTime.toISOString(),
                        successful: result.successful.length,
                        failed: result.failed.length,
                    });
                }

                // If we had partial success (some messages failed but not all), we're done
                succeeded = true;

            } catch (err) {
                const processingEndTime = new Date();
                const processingTimeMs = processingEndTime.getTime() - processingStartTime.getTime();
                const isLastRetry = retryCount >= this._retryOptions.maxRetries;

                console.error('Batch processing error', {
                    error: err,
                    groupId,
                    retryAttempt: retryCount,
                    willRetry: !isLastRetry,
                    duration: processingTimeMs
                });

                if (this._metricsOptions.enabled) {
                    const errorMetrics = {
                        groupId,
                        error: err,
                        retryAttempt: retryCount,
                        willRetry: !isLastRetry,
                        batchSize: parsedMessages.length,
                    };

                    this.emit(
                        isLastRetry
                            ? QueueConsumerEvents.BATCH_PROCESSING_FAILED
                            : QueueConsumerEvents.BATCH_PROCESSING_RETRY,
                        errorMetrics
                    );
                }

                if (isLastRetry) {
                    // After all retries are exhausted, send each message to DLQ
                    this._messagesFailed += parsedMessages.length;

                    for (const parsed of parsedMessages) {
                        await this.sendToDeadLetterQueue(parsed.original, err, retryCount);
                    }

                    break; // No more retries
                } else {
                    this._totalRetries++;
                }

                // Calculate and wait for backoff delay
                const delayMs = this.calculateBackoffDelay(retryCount);

                // If configured, extend visibility timeout during retry delay for all messages
                if (this._retryOptions.extendVisibilityTimeout) {
                    const visibilityExtensionSeconds = Math.ceil(delayMs / 1000) + 5;

                    for (const parsed of parsedMessages) {
                        await this.extendMessageVisibility(parsed.original, visibilityExtensionSeconds);
                    }
                }

                await this.sleep(delayMs);
                retryCount++;
            }
        }
    }
} 