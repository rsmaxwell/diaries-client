import { Buffer } from 'buffer';
import { firstValueFrom } from 'rxjs';
import { AddFragmentRequest, AddImageFragmentRequest, ImageFragment } from '../model/fragment';
import { RpcError, RpcService } from './rpc.service';

describe('ImageFragment RPC contract', () => {
  let service: RpcService;
  let client: any;
  let received: (topic: string, payload: Buffer, packet: unknown) => void;
  let published: Array<{ topic: string; payload: any; options: any }>;
  let replyStatus: { code: number; message: string };
  let replyPayload: unknown;
  let accessToken: string;
  let router: any;

  const imageReply = (): ImageFragment => ({
    id: 84,
    pageId: 12,
    type: 'IMAGE',
    imageId: 101,
    marqueeId: null,
    year: 1830,
    month: 2,
    day: 3,
    sequence: 4.5,
    version: 0,
    text: 'Image fragment'
  });

  beforeEach(async () => {
    published = [];
    replyStatus = { code: 200, message: 'OK' };
    replyPayload = imageReply();
    accessToken = 'access-1';
    router = { url: '/diary', navigate: jasmine.createSpy('navigate') };

    client = {
      on: (_event: string, callback: typeof received) => { received = callback; },
      listenerCount: () => 1,
      subscribe: (_topic: string, _options: unknown, callback: (error?: Error) => void) => callback(),
      publish: (topic: string, payload: string, options: any, callback: (error?: Error) => void) => {
        const parsed = JSON.parse(payload);
        published.push({ topic, payload: parsed, options });
        callback();

        let status = replyStatus;
        let body = replyPayload;
        if (parsed.function === 'refreshToken') {
          status = { code: 200, message: 'OK' };
          body = { accessToken: 'access-2' };
        }

        queueMicrotask(() => received(
          options.properties.responseTopic,
          Buffer.from(JSON.stringify(body)),
          {
            properties: {
              correlationData: options.properties.correlationData,
              userProperties: { status: JSON.stringify(status) }
            }
          }
        ));
      }
    };

    service = new RpcService(
      { getConnection: () => Promise.resolve(client), getClientId: () => 'image-fragment-client' } as any,
      { getConfig: () => Promise.resolve({ baseUrl: 'http://localhost/diaries/', username: 'editor' }) } as any,
      {
        getCurrentToken: () => accessToken,
        setToken: (token: string) => { accessToken = token; },
        clearToken: () => { accessToken = ''; },
        username: 'editor'
      } as any,
      { getToken: () => Promise.resolve('refresh-token'), clearToken: () => {} } as any,
      router
    );

    // Allow ensureListener() to attach its dispatcher before the first request.
    await Promise.resolve();
    await Promise.resolve();
  });

  it('sends exactly the addImageFragment creation fields and returns the committed IMAGE Fragment', async () => {
    const request = new AddImageFragmentRequest(12, 1830, 2, 3, 4.5, 'Image fragment', 101);
    const value: ImageFragment = await firstValueFrom(service.addImageFragment$(request));

    expect(published.length).toBe(1);
    expect(published[0].topic).toBe('diaries/rpc/request');
    expect(published[0].payload).toEqual({
      function: 'addImageFragment',
      args: {
        pageId: 12,
        year: 1830,
        month: 2,
        day: 3,
        sequence: 4.5,
        text: 'Image fragment',
        imageId: 101
      }
    });
    expect(Object.hasOwn(published[0].payload.args, 'id')).toBeFalse();
    expect(Object.hasOwn(published[0].payload.args, 'type')).toBeFalse();
    expect(Object.hasOwn(published[0].payload.args, 'marqueeId')).toBeFalse();
    expect(value).toEqual(imageReply());
    expect(value.type).toBe('IMAGE');
    expect(value.marqueeId).toBeNull();
  });

  it('omits imageId from JSON when the optional creation reference is omitted', async () => {
    replyPayload = { ...imageReply(), imageId: null };
    const request = new AddImageFragmentRequest(12, 1830, 2, 3, 4.5, 'Incomplete image fragment');

    await firstValueFrom(service.addImageFragment$(request));

    expect(published[0].payload.args).toEqual({
      pageId: 12,
      year: 1830,
      month: 2,
      day: 3,
      sequence: 4.5,
      text: 'Incomplete image fragment'
    });
    expect(Object.hasOwn(published[0].payload.args, 'imageId')).toBeFalse();
  });

  it('preserves an explicit null imageId when requested', async () => {
    replyPayload = { ...imageReply(), imageId: null };
    const request = new AddImageFragmentRequest(12, 1830, 2, 3, 4.5, 'Incomplete image fragment', null);

    await firstValueFrom(service.addImageFragment$(request));

    expect(Object.hasOwn(published[0].payload.args, 'imageId')).toBeTrue();
    expect(published[0].payload.args.imageId).toBeNull();
  });

  for (const code of [400, 403, 500]) {
    it(`propagates responder status ${code} as RpcError`, async () => {
      replyStatus = { code, message: `synthetic ${code}` };
      replyPayload = { error: `synthetic ${code}` };

      try {
        await firstValueFrom(service.addImageFragment$(
          new AddImageFragmentRequest(12, 1830, 2, 3, 4.5, 'Image fragment', 101)
        ));
        fail('Expected RpcError');
      } catch (error) {
        expect(error instanceof RpcError).toBeTrue();
        expect((error as RpcError).status).toBe(code);
        expect((error as RpcError).statusMessage).toBe(`synthetic ${code}`);
      }
      expect(published.length).toBe(1);
    });
  }

  it('uses the existing 401 refresh/retry path and still surfaces a rejected retry as RpcError', async () => {
    replyStatus = { code: 401, message: 'synthetic 401' };
    replyPayload = { error: 'synthetic 401' };

    try {
      await firstValueFrom(service.addImageFragment$(
        new AddImageFragmentRequest(12, 1830, 2, 3, 4.5, 'Image fragment', 101)
      ));
      fail('Expected RpcError');
    } catch (error) {
      expect(error instanceof RpcError).toBeTrue();
      expect((error as RpcError).status).toBe(401);
    }

    expect(published.map(item => item.payload.function)).toEqual([
      'addImageFragment',
      'refreshToken',
      'addImageFragment'
    ]);
    expect(published[0].options.properties.userProperties.accessToken).toBe('access-1');
    expect(published[2].options.properties.userProperties.accessToken).toBe('access-2');
    expect(router.navigate).toHaveBeenCalled();
  });

  it('keeps the existing addFragment wire contract unchanged', async () => {
    replyPayload = {
      id: 85,
      pageId: 12,
      type: 'MARQUEE',
      imageId: null,
      marqueeId: 501,
      year: 1830,
      month: 2,
      day: 3,
      sequence: 5,
      version: 0,
      text: 'Marquee fragment'
    };

    await firstValueFrom(service.addFragment$(
      new AddFragmentRequest(12, 1830, 2, 3, 5, 'Marquee fragment', 0.1, 0.2, 0.3, 0.4)
    ));

    expect(published[0].payload).toEqual({
      function: 'addFragment',
      args: {
        pageId: 12,
        year: 1830,
        month: 2,
        day: 3,
        sequence: 5,
        text: 'Marquee fragment',
        x: 0.1,
        y: 0.2,
        width: 0.3,
        height: 0.4
      }
    });
  });

  it('keeps ordinary IMAGE updateFragment requests in preserve mode with imageId omitted', async () => {
    replyPayload = 84;

    await firstValueFrom(service.updateFragment$({
      ...imageReply(),
      version: 7,
      text: 'Text-only edit'
    }));

    expect(published[0].payload).toEqual({
      function: 'updateFragment',
      args: {
        id: 84,
        year: 1830,
        month: 2,
        day: 3,
        sequence: 4.5,
        version: 7,
        text: 'Text-only edit'
      }
    });
    expect(Object.hasOwn(published[0].payload.args, 'imageId')).toBeFalse();
    expect(Object.hasOwn(published[0].payload.args, 'marqueeId')).toBeFalse();
    expect(Object.hasOwn(published[0].payload.args, 'pageId')).toBeFalse();
    expect(Object.hasOwn(published[0].payload.args, 'type')).toBeFalse();
  });

  it('sends a positive imageId only through deliberate IMAGE replacement', async () => {
    replyPayload = 84;

    await firstValueFrom(service.updateImageFragment$({
      ...imageReply(),
      version: 8
    }, 202));

    expect(published[0].payload).toEqual({
      function: 'updateFragment',
      args: {
        id: 84,
        year: 1830,
        month: 2,
        day: 3,
        sequence: 4.5,
        version: 8,
        text: 'Image fragment',
        imageId: 202
      }
    });
    expect(Object.hasOwn(published[0].payload.args, 'marqueeId')).toBeFalse();
  });

  it('sends explicit imageId null only through deliberate IMAGE clear', async () => {
    replyPayload = 84;

    await firstValueFrom(service.updateImageFragment$({
      ...imageReply(),
      version: 9
    }, null));

    expect(Object.hasOwn(published[0].payload.args, 'imageId')).toBeTrue();
    expect(published[0].payload.args.imageId).toBeNull();
    expect(Object.hasOwn(published[0].payload.args, 'marqueeId')).toBeFalse();
    expect(Object.hasOwn(published[0].payload.args, 'pageId')).toBeFalse();
    expect(Object.hasOwn(published[0].payload.args, 'type')).toBeFalse();
  });

});
