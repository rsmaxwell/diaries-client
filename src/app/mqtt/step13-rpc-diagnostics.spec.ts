import { Step13RpcDiagnostics, summariseStep13RpcRequest } from './step13-rpc-diagnostics';

describe('Step 13 RPC diagnostics redaction', () => {
  it('captures a positive addImageFragment imageId without transcription text or secrets', () => {
    const summary = summariseStep13RpcRequest({
      function: 'addImageFragment',
      args: {
        pageId: 685,
        year: 1828,
        month: 1,
        day: 1,
        sequence: 2.5,
        text: 'private transcription',
        imageId: 90,
        accessToken: 'must-not-leak',
        password: 'must-not-leak'
      }
    }, 'corr-add', '2026-10-05T12:00:00.000Z');

    expect(summary).toEqual({
      capturedAt: '2026-10-05T12:00:00.000Z',
      correlationId: 'corr-add',
      function: 'addImageFragment',
      args: {
        pageId: 685,
        year: 1828,
        month: 1,
        day: 1,
        sequence: 2.5,
        imageId: 90,
        imageIdState: 'positive',
        textLength: 21
      }
    });
    expect(JSON.stringify(summary)).not.toContain('private transcription');
    expect(JSON.stringify(summary)).not.toContain('must-not-leak');
  });

  it('distinguishes positive, null and omitted updateFragment imageId values', () => {
    const baseArgs = {
      id: 2333,
      year: 1828,
      month: 1,
      day: 1,
      sequence: 5,
      version: 9,
      text: 'x'
    };

    const positive = summariseStep13RpcRequest({
      function: 'updateFragment',
      args: { ...baseArgs, imageId: 90 }
    }, 'positive');
    const cleared = summariseStep13RpcRequest({
      function: 'updateFragment',
      args: { ...baseArgs, imageId: null }
    }, 'clear');
    const ordinary = summariseStep13RpcRequest({
      function: 'updateFragment',
      args: baseArgs
    }, 'ordinary');

    expect(positive?.args.imageIdState).toBe('positive');
    expect(positive?.args.imageId).toBe(90);
    expect(cleared?.args.imageIdState).toBe('null');
    expect(cleared?.args.imageId).toBeNull();
    expect(ordinary?.args.imageIdState).toBe('omitted');
    expect(Object.prototype.hasOwnProperty.call(ordinary?.args ?? {}, 'imageId')).toBeFalse();
  });

  it('records marqueeId presence state but never serialises the value', () => {
    const omitted = summariseStep13RpcRequest({
      function: 'updateFragment',
      args: { id: 1, imageId: 90 }
    }, 'omitted');
    const explicitNull = summariseStep13RpcRequest({
      function: 'updateFragment',
      args: { id: 1, imageId: 90, marqueeId: null }
    }, 'null');

    expect(omitted?.args.marqueeIdState).toBe('omitted');
    expect(explicitNull?.args.marqueeIdState).toBe('null');
    expect(JSON.stringify(explicitNull)).not.toContain('marqueeId":');
  });

  it('ignores RPC functions outside the Step 13 ImageFragment evidence set', () => {
    expect(summariseStep13RpcRequest({
      function: 'signin',
      args: { email: 'private@example.invalid', password: 'secret' }
    }, 'corr-signin')).toBeNull();

    expect(summariseStep13RpcRequest({
      function: 'deleteImage',
      args: { id: 90 }
    }, 'corr-delete')).toBeNull();
  });

  it('stores only a redacted committed Fragment summary for a successful add reply', () => {
    const diagnostics = new Step13RpcDiagnostics();
    const api = (window as any).__diariesStep13RpcDiagnostics;
    api.enable();
    api.clear();

    diagnostics.captureRequest('corr-reply', {
      function: 'addImageFragment',
      args: {
        pageId: 685,
        year: 1828,
        month: 1,
        day: 1,
        sequence: 2,
        text: 'request private text',
        imageId: 90
      }
    });
    diagnostics.captureReply(
      'corr-reply',
      { code: 200, message: 'ok' },
      new TextEncoder().encode(JSON.stringify({
        id: 2333,
        pageId: 685,
        type: 'IMAGE',
        imageId: 90,
        marqueeId: null,
        year: 1828,
        month: 1,
        day: 1,
        sequence: 2,
        version: 0,
        text: 'reply private text',
        accessToken: 'must-not-leak'
      }))
    );

    const entries = api.entries();
    expect(entries.length).toBe(1);
    expect(entries[0].reply.fragment.id).toBe(2333);
    expect(entries[0].reply.fragment.imageId).toBe(90);
    expect(entries[0].reply.fragment.textLength).toBe(18);
    expect(JSON.stringify(entries[0])).not.toContain('request private text');
    expect(JSON.stringify(entries[0])).not.toContain('reply private text');
    expect(JSON.stringify(entries[0])).not.toContain('must-not-leak');

    api.disable();
    api.clear();
  });

});
