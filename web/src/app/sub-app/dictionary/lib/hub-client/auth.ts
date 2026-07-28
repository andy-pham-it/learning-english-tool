import type { Transport } from './transport';
import type { TokenResult, UserInfo } from './types';

export function createAuth(transport: Transport) {
  return {
    /** Get the current session JWT for the sub-app's backend. */
    getToken(): Promise<TokenResult> {
      return transport.send<TokenResult>('auth:getToken');
    },

    /** Get the current user's profile. */
    getUserInfo(): Promise<UserInfo> {
      return transport.send<UserInfo>('auth:getUserInfo');
    },

    /** Force-refresh the session token. */
    refreshToken(): Promise<TokenResult> {
      return transport.send<TokenResult>('auth:refreshToken');
    },

    /** Sign out the current user. */
    async logout(): Promise<void> {
      await transport.send<void>('auth:logout');
    },
  };
}

export type AuthNamespace = ReturnType<typeof createAuth>;
