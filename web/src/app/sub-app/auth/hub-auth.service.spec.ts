import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HubAuthService, HubUser } from './hub-auth.service';

describe('HubAuthService', () => {
  let service: HubAuthService;
  let fakeParent: { postMessage: jasmine.Spy };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HubAuthService);
    fakeParent = { postMessage: jasmine.createSpy('postMessage') };
    // Karma runs at the top level, so override window.parent to simulate being inside an iframe
    Object.defineProperty(window, 'parent', { configurable: true, value: fakeParent });
    // Karma sets document.referrer to the karma server URL; blank it so the discovery
    // path (no ?hub=, inside iframe) is exercised instead of the referrer branch.
    Object.defineProperty(document, 'referrer', { configurable: true, value: '' });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('resolves null when standalone (no hub param, window === window.parent)', async () => {
    Object.defineProperty(window, 'parent', { configurable: true, value: window });
    const result = await service.requestUserInfo(1000);
    expect(result).toBeNull();
  });

  it('adopts reply origin during discovery and resolves the user', async () => {
    const promise = service.requestUserInfo(2000);
    // Capture requestId the service posted to the fake parent
    expect(fakeParent.postMessage).toHaveBeenCalled();
    const posted = fakeParent.postMessage.calls.mostRecent().args[0] as {
      type: string; requestId: string; version: number;
    };
    expect(posted.type).toBe('auth:getUserInfo');
    expect(posted.version).toBe(1);
    const hubUser: HubUser = { id: 'u1', email: 'a@b.c', name: 'Ann', image: null };
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://hub.example.com',
      data: { requestId: posted.requestId, ok: true, data: hubUser },
    }));
    const result = await promise;
    expect(result).toEqual(hubUser);
  });

  it('resolves null on reply with ok:false', async () => {
    const promise = service.requestUserInfo(2000);
    const posted = fakeParent.postMessage.calls.mostRecent().args[0] as { requestId: string };
    window.dispatchEvent(new MessageEvent('message', {
      origin: 'https://hub.example.com',
      data: { requestId: posted.requestId, ok: false, data: null },
    }));
    expect(await promise).toBeNull();
  });

  it('resolves null on timeout', fakeAsync(() => {
    let result: HubUser | null | undefined;
    service.requestUserInfo(500).then((r) => (result = r));
    expect(fakeParent.postMessage).toHaveBeenCalled();
    tick(600);
    expect(result).toBeNull();
  }));
});
