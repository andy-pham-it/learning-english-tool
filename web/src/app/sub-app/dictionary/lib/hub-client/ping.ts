import type { Transport } from './transport';

export interface PingResult {
  timestamp: number;
}

export function createPing(transport: Transport) {
  return {
    async ping(): Promise<PingResult> {
      return transport.send<PingResult>('hub:ping', {});
    },
  };
}
