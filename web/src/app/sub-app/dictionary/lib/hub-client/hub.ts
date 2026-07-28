import type { Transport } from './transport';

export function createHub(transport: Transport) {
  return {
    /** Open a URL in a new tab, same tab, or the iframe itself. */
    openUrl(url: string, target: '_blank' | '_self' | 'iframe' = '_blank'): Promise<void> {
      return transport.send<void>('hub:openUrl', { url, target });
    },

    /** Ask the Hub to navigate to a different sub-app. */
    navigate(subApp: string): Promise<void> {
      return transport.send<void>('hub:navigate', { subApp });
    },
  };
}

export type HubNamespace = ReturnType<typeof createHub>;
