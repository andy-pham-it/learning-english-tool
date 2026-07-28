import type { Transport } from './transport';
import type { AiChatRequest, AiChatResponse, AiProviderInfo } from './types';

export function createAi(transport: Transport) {
  return {
    /** Send a chat completion request. */
    chat(request: AiChatRequest): Promise<AiChatResponse> {
      return transport.send<AiChatResponse>('ai:chat', request);
    },

    /** Get available models, optionally filtered by provider. */
    models(provider?: string): Promise<string[]> {
      return transport.send<string[]>('ai:models', provider ? { provider } : {});
    },

    /** Get available providers with their supported models. */
    providers(): Promise<AiProviderInfo[]> {
      return transport.send<AiProviderInfo[]>('ai:providers', undefined);
    },
  };
}

export type AiNamespace = ReturnType<typeof createAi>;
