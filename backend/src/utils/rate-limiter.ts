import PQueue from 'p-queue';
import dotenv from 'dotenv';

dotenv.config();

const SCB_RATE_LIMIT = parseInt(process.env.SCB_RATE_LIMIT || '10', 10);

// SCB API queue: max 10 requests per second
export const scbQueue = new PQueue({
  concurrency: 5,        // Max 5 simultaneous requests
  interval: 1000,        // Per second
  intervalCap: SCB_RATE_LIMIT,  // Max requests per interval
  timeout: 45000         // 45 second timeout per request
});

// Booli API queue (för framtida användning)
export const booliQueue = new PQueue({
  concurrency: 3,
  interval: 60000,       // Per minute
  intervalCap: 100,      // Conservative limit
  timeout: 30000
});

// Stats tracking
let scbQueueStats = {
  total: 0,
  pending: 0,
  completed: 0,
  failed: 0
};

scbQueue.on('add', () => {
  scbQueueStats.total++;
  scbQueueStats.pending = scbQueue.size + scbQueue.pending;
});

scbQueue.on('completed', () => {
  scbQueueStats.completed++;
  scbQueueStats.pending = scbQueue.size + scbQueue.pending;
});

scbQueue.on('error', () => {
  scbQueueStats.failed++;
  scbQueueStats.pending = scbQueue.size + scbQueue.pending;
});

export function getSCBQueueStats() {
  return {
    ...scbQueueStats,
    size: scbQueue.size,
    pending: scbQueue.pending
  };
}

// Helper function to add task to SCB queue with logging
export async function queueSCBRequest<T>(
  taskName: string,
  task: () => Promise<T>
): Promise<T> {
  console.log(`[SCB Queue] Adding task: ${taskName} (Queue size: ${scbQueue.size})`);

  try {
    const result = await scbQueue.add(task);
    console.log(`[SCB Queue] Completed: ${taskName}`);
    return result as T;
  } catch (error) {
    console.error(`[SCB Queue] Failed: ${taskName}`, error);
    throw error;
  }
}

// Helper function for Booli requests
export async function queueBooliRequest<T>(
  taskName: string,
  task: () => Promise<T>
): Promise<T> {
  console.log(`[Booli Queue] Adding task: ${taskName}`);

  try {
    const result = await booliQueue.add(task);
    console.log(`[Booli Queue] Completed: ${taskName}`);
    return result as T;
  } catch (error) {
    console.error(`[Booli Queue] Failed: ${taskName}`, error);
    throw error;
  }
}

export default {
  scbQueue,
  booliQueue,
  queueSCBRequest,
  queueBooliRequest,
  getSCBQueueStats
};
