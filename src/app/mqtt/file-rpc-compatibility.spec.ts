import { firstValueFrom } from 'rxjs';
import { Buffer } from 'buffer';
import { RpcError, RpcService } from './rpc.service';
import { ReplyHandler } from '../utilities/replyHandler';
import { fileRpcBaseline } from '../testing/file-rpc-baseline.fixture';

describe('File RPC captured compatibility', () => {
  let service: RpcService;
  let client: any;
  let received: (topic: string, payload: Buffer, packet: unknown) => void;
  let reply: any;
  let addFields: boolean;
  let outgoing: any;

  function baseline(id: string): any {
    return structuredClone(fileRpcBaseline.find(c => c.caseId === id));
  }

  beforeEach(async () => {
    addFields = false;
    client = {
      on: (_event: string, callback: typeof received) => { received = callback; },
      listenerCount: () => 1,
      subscribe: (_topic: string, _options: unknown, callback: (error?: Error) => void) => callback(),
      publish: (_topic: string, payload: string, options: any, callback: (error?: Error) => void) => {
        outgoing = JSON.parse(payload);
        const body = structuredClone(reply.payload);
        if (addFields && body && typeof body === 'object') {
          body.imageId = 101;
          body.image = { id: 101, relativePath: 'plain.png', caption: '', altText: '' };
          if (body.items) body.items.forEach((item: any) => { item.imageId = item.dir ? null : 101; });
        }
        callback();
        queueMicrotask(() => received(options.properties.responseTopic, Buffer.from(JSON.stringify(body)), {
          properties: {
            correlationData: options.properties.correlationData,
            userProperties: { status: JSON.stringify(reply.status) }
          }
        }));
      }
    };
    service = new RpcService(
      { getConnection: () => Promise.resolve(client), getClientId: () => 'fixture-client' } as any,
      { getConfig: () => Promise.resolve({ baseUrl: 'http://localhost/diaries/' }) } as any,
      { getCurrentToken: () => 'synthetic-client-token' } as any,
      {} as any,
      {} as any
    );
    await Promise.resolve();
  });

  for (const generic of [false, true]) {
    it(`reads the catalogue upload response including explicit nulls (generic=${generic})`, async () => {
      // Use any captured successful upload as the stable five-field compatibility baseline.
      reply = structuredClone(fileRpcBaseline.find(c => c.function === 'uploadFile' && c.status.code === 200));
      const image = generic ? null : {
        id: 101, version: 0, relativePath: reply.payload.name, mimeType: 'image/png',
        originalFilename: reply.payload.name, width: 16, height: 12, checksum: 'ab'.repeat(32), caption: '', altText: ''
      };
      reply.payload.imageId = image?.id ?? null;
      reply.payload.image = image;
      const value: any = await firstValueFrom(service.uploadFile$(new File(['synthetic'], 'plain.png')));
      expect(value).toEqual(reply.payload);
      expect(Object.hasOwn(value, 'imageId')).toBeTrue();
      expect(Object.hasOwn(value, 'image')).toBeTrue();
      expect(value.image).toEqual(image);
    });
  }

  for (const additions of [false, true]) {
    it(`reads the captured upload response through uploadFile$ (additions=${additions})`, async () => {
      reply = baseline('upload-image-root'); addFields = additions;
      const value: any = await firstValueFrom(service.uploadFile$(new File(['synthetic'], 'plain.png', { type: 'image/png' })));
      expect(outgoing.function).toBe('uploadFile');
      expect(value.name).toBe(reply.payload.name);
      expect(value.size).toBe(reply.payload.size);
      expect(value.url).toBe(reply.payload.url);
      expect(Object.hasOwn(value, 'mtime')).toBeFalse();
      if (additions) expect(value.imageId).toBe(101);
    });

    it(`reads captured directory and image entries through listFiles$ (additions=${additions})`, async () => {
      reply = baseline('list-populated-root'); addFields = additions;
      const value = await firstValueFrom(service.listFiles$());
      expect(outgoing).toEqual({ function: 'listFiles', args: {} });
      expect(value.subdir).toBe('');
      expect(value.items.map(i => i.name)).toEqual(['alpha', 'empty', 'zeta', 'dated.jpg', 'plain.png']);
      expect(Object.hasOwn(value.items[0], 'url')).toBeFalse();
      expect(Object.hasOwn(value.items[4], 'dateTaken')).toBeFalse();
      expect(value.items[3].dateTaken).toBe(1577934245000);
    });
  }

  it('preserves the nested listing URL and request path', async () => {
    reply = baseline('list-populated-nested');
    const value = await firstValueFrom(service.listFiles$('/alpha/nested space'));
    expect(outgoing.args).toEqual({ subdir: 'alpha/nested space' });
    expect(value.items[0].url).toBe('/files/alpha/nested%20space/image%20space.png');
  });

  it('deserializes every successful captured body with additive fields', () => {
    for (const capture of fileRpcBaseline.filter(c => c.status.code === 200)) {
      const value: any = ReplyHandler.getBufferAsObject(Buffer.from(JSON.stringify({ ...capture.payload as object, futureField: true })));
      expect(value).withContext(capture.caseId).toEqual(jasmine.objectContaining(capture.payload as object));
    }
  });

  it('routes every captured error via the MQTT status property without deserializing its payload', () => {
    for (const capture of fileRpcBaseline.filter(c => c.status.code !== 200)) {
      const error = jasmine.createSpy('error');
      const deserialize = jasmine.createSpy('deserialize');
      const payload = Buffer.from(JSON.stringify(capture.payload));
      const timer = setTimeout(() => fail('unhandled reply'), 1000);
      (service as any).responseHandlers.set('correlation', {
        replyTopic: 'test/reply', observer: { error }, deserialize, timer
      });
      received('test/reply', payload, { properties: {
        correlationData: Buffer.from('correlation'), userProperties: { status: [JSON.stringify(capture.status)] }
      } });
      const actual = error.calls.mostRecent().args[0] as RpcError;
      expect(actual.status).withContext(capture.caseId).toBe(capture.status.code);
      expect(actual.payload).toBe(payload);
      expect(deserialize).not.toHaveBeenCalled();
    }
  });

  it('ignores replies with the wrong topic or correlation ID', () => {
    const next = jasmine.createSpy('next');
    const timer = setTimeout(() => fail('reply not consumed'), 1000);
    (service as any).responseHandlers.set('expected', {
      replyTopic: 'expected/reply', observer: { next, complete: () => {} },
      deserialize: ReplyHandler.getBufferAsObject, timer
    });
    const packet = { properties: { correlationData: Buffer.from('expected'), userProperties: { status: '{"code":200,"message":"ok"}' } } };
    received('wrong/reply', Buffer.from('{}'), packet);
    received('expected/reply', Buffer.from('{}'), { properties: { ...packet.properties, correlationData: Buffer.from('wrong') } });
    expect(next).not.toHaveBeenCalled();
    received('expected/reply', Buffer.from('{}'), packet);
    expect(next).toHaveBeenCalledOnceWith({});
  });

  for (const caseId of ['delete-generic-existing', 'delete-generic-missing']) {
    it(`preserves DeleteFile transport compatibility (${caseId})`, async () => {
      reply = baseline(caseId);
      // The current client has no public DeleteFile method; exercise its shared MQTT transport.
      const request = { function: 'deleteFile', args: { name: 'generic.bin', subdir: '' } };
      const value = await firstValueFrom((service as any).rpcRequest(
        client, 'diaries/rpc/request', 'test/delete/reply', request,
        'synthetic-client-token', ReplyHandler.getBufferAsObject));
      expect(outgoing).toEqual(request);
      expect(value).toEqual(reply.payload);
    });
  }

  it('delivers a catalogue DeleteFile conflict as RpcError and clears the request', async () => {
    reply = { status: { code: 409, message: 'Catalogued file cannot be deleted' }, payload: { name: 'protected.png' } };
    const deserialize = jasmine.createSpy('deserialize');
    try {
      await firstValueFrom((service as any).rpcRequest(
        client, 'diaries/rpc/request', 'test/delete/reply',
        { function: 'deleteFile', args: { name: 'protected.png' } },
        'synthetic-client-token', deserialize));
      fail('Expected a catalogue conflict');
    } catch (error) {
      expect(error instanceof RpcError).toBeTrue();
      expect((error as RpcError).status).toBe(409);
      expect(deserialize).not.toHaveBeenCalled();
      expect((service as any).responseHandlers.size).toBe(0);
    }
  });
});
