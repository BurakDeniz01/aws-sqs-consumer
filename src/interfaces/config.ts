import {SQSClient} from '@aws-sdk/client-sqs';
import {BatchMessageHandler, MessageHandler} from '../types/handlers';
import DeadLetterQueueOptions from './dlq';
import MetricsOptions from './metrics';
import {MiddlewareOptions} from './middleware';
import BatchOptions from './options';
import RetryOptions from './retry';

/**
 * HTTP options for AWS SDK
 */
export interface AwsHttpOptions {
    proxy?: string;
    timeout?: number;
    connectTimeout?: number;
}

/**
 * AWS credentials configuration
 */
export interface AwsCredentials {
    accessKeyId?: string;
    secretAccessKey?: string;
    sessionToken?: string;
    profile?: string;
}

/**
 * AWS configuration including credentials and region
 */
export interface AwsConfig extends AwsCredentials {
    region?: string;
    endpoint?: string;
    httpOptions?: AwsHttpOptions;
    useDefaultCredentialProviderChain?: boolean;
}

/**
 * Main consumer options
 */
export interface ConsumerOptions {
    url: string;
    handler?: MessageHandler;
    batchHandler?: BatchMessageHandler;
    attributeNames?: string[];
    messageAttributeNames?: string[];
    batchSize?: number;
    visibilityTimeout?: number;
    waitTimeSeconds?: number;
    authenticationErrorTimeout?: number;
    pollingWaitTimeMs?: number;
    terminateVisibilityTimeout?: boolean;
    sqs?: SQSClient;
    parsePayload?: boolean;
    batchOptions?: BatchOptions;
    deadLetterQueueOptions?: DeadLetterQueueOptions;
    retryOptions?: RetryOptions;
    middlewareOptions?: MiddlewareOptions;
    metricsOptions?: MetricsOptions;
    awsConfig?: AwsConfig;
} 