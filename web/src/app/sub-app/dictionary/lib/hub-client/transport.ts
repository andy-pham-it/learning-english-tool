import type { HubResponse, HubPushEvent } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResolveFn = (data: any) => void;

interface PendingEntry {
  resolve: ResolveFn;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface Transport {
  send<T>(type: string, payload?: unknown): Promise<T>;
  onPush(handler: (event: HubPushEvent) => void): () => void;
  destroy(): void;
}

export function createTransport(options: { hubOrigin: string; timeout: number }): Transport {
  const pending = new Map<string, PendingEntry>();
  const pushHandlers = new Set<(event: HubPushEvent) => void>();

  function handleMessage(event: MessageEvent): void {
    if (event.origin !== options.hubOrigin) return;
    const data = event.data as HubResponse | HubPushEvent;

    // Push event (no requestId)
    if (data.requestId === null) {
      for (const handler of pushHandlers) {
        handler(data as HubPushEvent);
      }
      return;
    }

    // Only process if it looks like a response (has ok boolean)
    if (typeof data.ok !== 'boolean') return;

    // Response to a pending request
    const pendingEntry = pending.get(data.requestId);
    if (!pendingEntry) return;

    clearTimeout(pendingEntry.timer);
    pending.delete(data.requestId);

    if (data.ok) {
      pendingEntry.resolve(data.data);
    } else {
      const err = Object.assign(new Error(data.error.message), { code: data.error.code });
      pendingEntry.reject(err);
    }

  }

  window.addEventListener('message', handleMessage);

  return {
    send<T>(type: string, payload?: unknown): Promise<T> {
      return new Promise((resolve, reject) => {
        const requestId = crypto.randomUUID();
        const timer = setTimeout(() => {
          pending.delete(requestId);
          reject(Object.assign(new Error('Request timed out'), { code: 'TIMEOUT' }));
        }, options.timeout);

        pending.set(requestId, { resolve: resolve as ResolveFn, reject, timer });
        window.parent.postMessage({ type, requestId, payload, version: 1 }, options.hubOrigin);
      });
    },

    onPush(handler: (event: HubPushEvent) => void): () => void {
      pushHandlers.add(handler);
      return () => pushHandlers.delete(handler);
    },

    destroy(): void {
      window.removeEventListener('message', handleMessage);
      pending.clear();
      pushHandlers.clear();
    },
  };
}
