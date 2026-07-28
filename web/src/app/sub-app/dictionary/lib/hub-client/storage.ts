import type { Transport } from './transport';
import type { GetResult } from './types';

export function createStorage(transport: Transport) {
  return {
    /** Read a shared setting by key. */
    get(key: string): Promise<GetResult> {
      return transport.send<GetResult>('storage:get', { key });
    },

    /** Write a shared setting. Broadcasts hub:configChanged to all sub-apps. */
    set(key: string, value: unknown): Promise<void> {
      return transport.send<void>('storage:set', { key, value });
    },

    /** Remove a shared setting. */
    delete(key: string): Promise<void> {
      return transport.send<void>('storage:delete', { key });
    },

    /** Clear all shared settings. */
    clear(): Promise<void> {
      return transport.send<void>('storage:clear');
    },

    /** Read a global shared setting (shared across all sub-apps). */
    getGlobal(key: string): Promise<GetResult> {
      return transport.send<GetResult>('storage:getGlobal', { key });
    },

    /** Write a global shared setting. */
    setGlobal(key: string, value: unknown): Promise<void> {
      return transport.send<void>('storage:setGlobal', { key, value });
    },

    /** Delete a global shared setting. */
    deleteGlobal(key: string): Promise<void> {
      return transport.send<void>('storage:deleteGlobal', { key });
    },
  };
}

export type StorageNamespace = ReturnType<typeof createStorage>;
