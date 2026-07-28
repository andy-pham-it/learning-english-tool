import type { Transport } from './transport';
import type { PushEventHandler } from './types';

export function createEvents(transport: Transport) {
  return {
    /** Subscribe to push events from the Hub. Returns an unsubscribe function. */
    on(eventType: string, handler: PushEventHandler): () => void {
      return transport.onPush((event) => {
        if (event.type === eventType) {
          handler(event.payload);
        }
      });
    },
  };
}

export type EventsNamespace = ReturnType<typeof createEvents>;
