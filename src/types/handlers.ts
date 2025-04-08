import {ParsedMessage, ProcessedBatch} from '../interfaces/messages';

/**
 * Message handler type
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MessageHandler = (body: any) => Promise<void>;

/**
 * Batch message handler type
 */
export type BatchMessageHandler = (messages: ParsedMessage[]) => Promise<ProcessedBatch>; 