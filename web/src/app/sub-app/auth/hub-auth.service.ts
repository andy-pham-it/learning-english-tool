import { Injectable } from '@angular/core';

export interface HubUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
}

@Injectable({ providedIn: 'root' })
export class HubAuthService {
  discoverHubOrigin(): string | null {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get('hub');
    if (fromParam) {
      try {
        return new URL(fromParam).origin;
      } catch {
        /* fall through to referrer */
      }
    }
    if (window !== window.parent) {
      try {
        const ref = document.referrer;
        if (ref) return new URL(ref).origin;
      } catch {
        /* cross-origin referrer may be stripped (WebKit/Orion) */
      }
    }
    return null;
  }

  requestUserInfo(timeoutMs: number = 10000): Promise<HubUser | null> {
    return new Promise((resolve) => {
      let hubOrigin = this.discoverHubOrigin();
      const isDiscovery = !hubOrigin;
      if (!hubOrigin && window === window.parent) {
        resolve(null);
        return;
      }
      const requestId = crypto.randomUUID();
      const onMessage = (event: MessageEvent) => {
        const data = event.data as { requestId?: string; ok?: unknown; data?: HubUser };
        if (!data || data.requestId !== requestId || typeof data.ok !== 'boolean') return;
        if (isDiscovery && !hubOrigin) {
          hubOrigin = event.origin; // Hub only replies to whitelisted origins
        }
        if (event.origin !== hubOrigin) return;
        window.clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve(data.ok && data.data ? data.data : null);
      };
      const timer = window.setTimeout(() => {
        window.removeEventListener('message', onMessage);
        resolve(null);
      }, timeoutMs);
      window.addEventListener('message', onMessage);
      window.parent.postMessage(
        { type: 'auth:getUserInfo', requestId, version: 1 },
        hubOrigin ?? '*'
      );
    });
  }
}
