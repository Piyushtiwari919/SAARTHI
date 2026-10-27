import { Queue, JobsOptions } from 'bullmq';
import { getRedisConnectionOptions } from '../config/redis.js';
import { DocumentModel } from '../modules/documents/document.model.js';
import { env } from '../config/env.js';

export const DOCUMENT_QUEUE_NAME = 'document-processing';

export interface DocumentJobPayload {
  documentId: string;
  processingVersion: number;
  requestId: string;
}

export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: {
    count: 200,
  },
  removeOnFail: {
    count: 500,
  },
};

let documentQueueInstance: Queue | null = null;

export function getDocumentQueue(): Queue {
  if (!documentQueueInstance) {
    const queue = new Queue(DOCUMENT_QUEUE_NAME, {
      connection: getRedisConnectionOptions(),
      defaultJobOptions,
    });

    queue.on('error', (err) => {
      if (env.NODE_ENV !== 'test') {
        console.warn(`[BullMQ Queue:${DOCUMENT_QUEUE_NAME}] Warning:`, err.message);
      }
    });

    documentQueueInstance = queue;
  }
  return documentQueueInstance;
}

/**
 * Enqueue a document for asynchronous background extraction processing.
 * Never stores file bytes or sensitive user credentials in Redis.
 */
export async function enqueueDocumentJob(
  documentId: string,
  requestId: string = `req_${Date.now()}`
): Promise<boolean> {
  try {
    const queue = getDocumentQueue();
    const jobId = `doc_${documentId}`;

    await queue.add(
      'extract-document',
      {
        documentId,
        processingVersion: 1,
        requestId,
      },
      {
        jobId, // Idempotent job deduplication by documentId
      }
    );

    // Update document status to QUEUED in database
    await DocumentModel.findByIdAndUpdate(documentId, {
      status: 'QUEUED',
      progressPercent: 10,
      statusMessage: 'Job queued for background processing worker',
    });

    return true;
  } catch (err: any) {
    console.warn(`[BullMQ] Could not enqueue job for document ${documentId}:`, err.message);
    // Graceful degradation: document remains in UPLOADED state if queue is unavailable
    await DocumentModel.findByIdAndUpdate(documentId, {
      statusMessage: 'Uploaded to private storage. Awaiting background queue dispatcher.',
    }).catch(() => {});
    return false;
  }
}
