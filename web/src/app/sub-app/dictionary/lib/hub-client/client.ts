import { createTransport, type Transport } from './transport';
import { createAuth, type AuthNamespace } from './auth';
import { createStorage, type StorageNamespace } from './storage';
import { createHub, type HubNamespace } from './hub';
import { createEvents, type EventsNamespace } from './events';
import { createAi, type AiNamespace } from './ai';
import { createPing, type PingResult } from './ping';
import type { HubClientOptions } from './types';

export interface HubClient {
  auth: AuthNamespace;
  storage: StorageNamespace;
  hub: HubNamespace;
  events: EventsNamespace;
  ai: AiNamespace;
  ping(): Promise<PingResult>;
  destroy(): void;
}

/**
 * Create a Hub client instance.
 * Call once when the sub-app mounts.
 *
 * @example
 * ```typescript
 * import { createHubClient } from './lib/hub-client';
 *
 * const client = createHubClient({ hubOrigin: 'http://localhost:4200' });
 *
 * // Get auth token
 * const { token } = await client.auth.getToken();
 *
 * // Read/write shared settings
 * await client.storage.set('theme', 'dark');
 * const { value } = await client.storage.get('theme');
 *
 * // Subscribe to push events
 * const unsub = client.events.on('hub:configChanged', (payload) => {
 *   console.log('Config changed:', payload);
 * });
 * ```
 */
export function createHubClient(options: HubClientOptions): HubClient {
  const transport: Transport = createTransport({
    hubOrigin: options.hubOrigin,
    timeout: options.timeout ?? 10_000,
  });

  return {
    auth: createAuth(transport),
    storage: createStorage(transport),
    hub: createHub(transport),
    events: createEvents(transport),
    ai: createAi(transport),
    ping: () => createPing(transport).ping(),
    destroy: () => transport.destroy(),
  };
}
