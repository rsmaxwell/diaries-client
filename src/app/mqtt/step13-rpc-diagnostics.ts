/**
 * Temporary Step 13 diagnostic capture for 0027-FEAT live verification.
 *
 * The capture is deliberately narrow: only addImageFragment and updateFragment
 * are recorded, and request args are allow-listed so authentication values and
 * transcription text never enter the evidence stream.
 */

const ENABLED_KEY = 'diaries.step13.rpcDiagnostics.enabled';
const ENTRIES_KEY = 'diaries.step13.rpcDiagnostics.entries';
const MAX_ENTRIES = 200;

export type Step13ImageIdState = 'omitted' | 'null' | 'positive' | 'invalid';

export interface Step13RpcDiagnosticArgs {
  id?: number;
  pageId?: number;
  year?: number;
  month?: number;
  day?: number;
  sequence?: number;
  version?: number;
  imageId?: number | null;
  imageIdState: Step13ImageIdState;
  marqueeIdState?: 'omitted' | 'null' | 'present';
  textLength?: number;
}

export interface Step13RpcDiagnosticRequest {
  capturedAt: string;
  correlationId: string;
  function: 'addImageFragment' | 'updateFragment';
  args: Step13RpcDiagnosticArgs;
}

export interface Step13RpcDiagnosticStatus {
  code?: number;
  message?: string;
}

export interface Step13RpcDiagnosticReply {
  value?: number;
  fragment?: {
    id?: number;
    pageId?: number;
    type?: string;
    imageId?: number | null;
    imageIdState: Step13ImageIdState;
    marqueeIdState: 'omitted' | 'null' | 'present';
    year?: number;
    month?: number;
    day?: number;
    sequence?: number;
    version?: number;
    textLength?: number;
  };
}

export interface Step13RpcDiagnosticEntry extends Step13RpcDiagnosticRequest {
  completedAt?: string;
  status?: Step13RpcDiagnosticStatus;
  reply?: Step13RpcDiagnosticReply;
  outcome: 'pending' | 'reply' | 'timeout' | 'publish-error' | 'status-parse-error';
}

interface Step13RpcDiagnosticWindowApi {
  enable(): void;
  disable(): void;
  clear(): void;
  status(): { enabled: boolean; count: number };
  entries(): Step13RpcDiagnosticEntry[];
  exportJson(): string;
  download(): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function integer(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function imageIdState(args: Record<string, unknown>): Step13ImageIdState {
  if (!hasOwn(args, 'imageId')) {
    return 'omitted';
  }

  if (args['imageId'] === null) {
    return 'null';
  }

  const value = integer(args['imageId']);
  return value !== undefined && value > 0 ? 'positive' : 'invalid';
}

function marqueeIdState(args: Record<string, unknown>): 'omitted' | 'null' | 'present' {
  if (!hasOwn(args, 'marqueeId')) {
    return 'omitted';
  }
  return args['marqueeId'] === null ? 'null' : 'present';
}

/**
 * Return the redacted request shape used by Step 13 evidence, or null for any
 * RPC outside the two ImageFragment authoring functions being verified.
 */
export function summariseStep13RpcRequest(
  payload: unknown,
  correlationId: string,
  capturedAt = new Date().toISOString()
): Step13RpcDiagnosticRequest | null {
  if (!isRecord(payload)) {
    return null;
  }

  const fn = payload['function'];
  if (fn !== 'addImageFragment' && fn !== 'updateFragment') {
    return null;
  }

  const rawArgs = isRecord(payload['args']) ? payload['args'] : {};
  const args: Step13RpcDiagnosticArgs = {
    imageIdState: imageIdState(rawArgs)
  };

  const id = integer(rawArgs['id']);
  const pageId = integer(rawArgs['pageId']);
  const year = integer(rawArgs['year']);
  const month = integer(rawArgs['month']);
  const day = integer(rawArgs['day']);
  const sequence = finiteNumber(rawArgs['sequence']);
  const version = integer(rawArgs['version']);

  if (id !== undefined) args.id = id;
  if (pageId !== undefined) args.pageId = pageId;
  if (year !== undefined) args.year = year;
  if (month !== undefined) args.month = month;
  if (day !== undefined) args.day = day;
  if (sequence !== undefined) args.sequence = sequence;
  if (version !== undefined) args.version = version;

  if (args.imageIdState === 'null') {
    args.imageId = null;
  } else if (args.imageIdState === 'positive') {
    args.imageId = rawArgs['imageId'] as number;
  }

  if (fn === 'updateFragment') {
    args.marqueeIdState = marqueeIdState(rawArgs);
  }

  if (typeof rawArgs['text'] === 'string') {
    args.textLength = rawArgs['text'].length;
  }

  return {
    capturedAt,
    correlationId,
    function: fn,
    args
  };
}

export class Step13RpcDiagnostics {
  private entriesValue: Step13RpcDiagnosticEntry[] = [];

  constructor() {
    this.entriesValue = this.loadEntries();
    this.installWindowApi();
  }

  captureRequest(correlationId: string, payload: unknown): void {
    if (!this.isEnabled()) {
      return;
    }

    const request = summariseStep13RpcRequest(payload, correlationId);
    if (!request) {
      return;
    }

    const entry: Step13RpcDiagnosticEntry = {
      ...request,
      outcome: 'pending'
    };

    this.entriesValue = this.entriesValue
      .filter(existing => existing.correlationId !== correlationId)
      .concat(entry)
      .slice(-MAX_ENTRIES);
    this.persistEntries();

    console.info('[STEP13-RPC] request ' + JSON.stringify(entry));
  }

  captureReply(correlationId: string, status: unknown, payload?: Uint8Array): void {
    const safeStatus = this.safeStatus(status);
    this.complete(correlationId, 'reply', safeStatus, this.safeReply(correlationId, safeStatus, payload));
  }

  captureTimeout(correlationId: string): void {
    this.complete(correlationId, 'timeout', { message: 'Timeout' });
  }

  capturePublishError(correlationId: string, message: string): void {
    this.complete(correlationId, 'publish-error', { message });
  }

  captureStatusParseError(correlationId: string): void {
    this.complete(correlationId, 'status-parse-error', { message: 'Failed to parse status JSON' });
  }

  private complete(
    correlationId: string,
    outcome: Step13RpcDiagnosticEntry['outcome'],
    status: Step13RpcDiagnosticStatus,
    reply?: Step13RpcDiagnosticReply
  ): void {
    if (!this.isEnabled()) {
      return;
    }

    const index = this.entriesValue.findIndex(entry => entry.correlationId === correlationId);
    if (index < 0) {
      return;
    }

    const completed: Step13RpcDiagnosticEntry = {
      ...this.entriesValue[index],
      completedAt: new Date().toISOString(),
      status,
      reply,
      outcome
    };

    this.entriesValue = [
      ...this.entriesValue.slice(0, index),
      completed,
      ...this.entriesValue.slice(index + 1)
    ];
    this.persistEntries();

    console.info('[STEP13-RPC] pair ' + JSON.stringify(completed));
  }


  private safeReply(
    correlationId: string,
    status: Step13RpcDiagnosticStatus,
    payload?: Uint8Array
  ): Step13RpcDiagnosticReply | undefined {
    if (status.code !== 200 || !payload || payload.length === 0) {
      return undefined;
    }

    const request = this.entriesValue.find(entry => entry.correlationId === correlationId);
    if (!request) {
      return undefined;
    }

    const text = new TextDecoder().decode(payload);
    let decoded: unknown;
    try {
      decoded = JSON.parse(text);
    } catch {
      return undefined;
    }

    if (request.function === 'updateFragment') {
      const value = finiteNumber(decoded);
      return value === undefined ? undefined : { value };
    }

    if (!isRecord(decoded)) {
      return undefined;
    }

    const fragment: NonNullable<Step13RpcDiagnosticReply['fragment']> = {
      imageIdState: imageIdState(decoded),
      marqueeIdState: marqueeIdState(decoded)
    };

    const id = integer(decoded['id']);
    const pageId = integer(decoded['pageId']);
    const year = integer(decoded['year']);
    const month = integer(decoded['month']);
    const day = integer(decoded['day']);
    const sequence = finiteNumber(decoded['sequence']);
    const version = integer(decoded['version']);

    if (id !== undefined) fragment.id = id;
    if (pageId !== undefined) fragment.pageId = pageId;
    if (typeof decoded['type'] === 'string') fragment.type = decoded['type'];
    if (year !== undefined) fragment.year = year;
    if (month !== undefined) fragment.month = month;
    if (day !== undefined) fragment.day = day;
    if (sequence !== undefined) fragment.sequence = sequence;
    if (version !== undefined) fragment.version = version;

    if (fragment.imageIdState === 'null') {
      fragment.imageId = null;
    } else if (fragment.imageIdState === 'positive') {
      fragment.imageId = decoded['imageId'] as number;
    }

    if (typeof decoded['text'] === 'string') {
      fragment.textLength = decoded['text'].length;
    }

    return { fragment };
  }

  private safeStatus(status: unknown): Step13RpcDiagnosticStatus {
    if (!isRecord(status)) {
      return {};
    }

    const result: Step13RpcDiagnosticStatus = {};
    const code = integer(status['code']);
    const message = status['message'];

    if (code !== undefined) result.code = code;
    if (typeof message === 'string') result.message = message;
    return result;
  }

  private isEnabled(): boolean {
    try {
      return window.sessionStorage.getItem(ENABLED_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private enable(): void {
    try {
      window.sessionStorage.setItem(ENABLED_KEY, 'true');
      console.info('[STEP13-RPC] diagnostics enabled; only addImageFragment/updateFragment redacted args are captured');
    } catch (error) {
      console.error('[STEP13-RPC] could not enable diagnostics', error);
    }
  }

  private disable(): void {
    try {
      window.sessionStorage.removeItem(ENABLED_KEY);
      console.info('[STEP13-RPC] diagnostics disabled');
    } catch (error) {
      console.error('[STEP13-RPC] could not disable diagnostics', error);
    }
  }

  private clear(): void {
    this.entriesValue = [];
    try {
      window.sessionStorage.removeItem(ENTRIES_KEY);
    } catch {
      // Session storage can be unavailable in hardened/private browser contexts.
    }
    console.info('[STEP13-RPC] diagnostics cleared');
  }

  private snapshot(): Step13RpcDiagnosticEntry[] {
    return this.entriesValue.map(entry => ({
      ...entry,
      args: { ...entry.args },
      status: entry.status ? { ...entry.status } : undefined,
      reply: entry.reply ? {
        ...entry.reply,
        fragment: entry.reply.fragment ? { ...entry.reply.fragment } : undefined
      } : undefined
    }));
  }

  private exportJson(): string {
    return JSON.stringify({
      generatedAt: new Date().toISOString(),
      capture: '0027-FEAT Step 13 redacted MQTT RPC diagnostics',
      redaction: 'Only allow-listed Fragment/Image identifiers, date/sequence/version, imageId state and text length are stored. Authentication values and transcription text are never stored.',
      entries: this.snapshot()
    }, null, 2);
  }

  private download(): void {
    const blob = new Blob([this.exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    link.href = url;
    link.download = `step13-rpc-diagnostics-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  private loadEntries(): Step13RpcDiagnosticEntry[] {
    try {
      const raw = window.sessionStorage.getItem(ENTRIES_KEY);
      if (!raw) {
        return [];
      }

      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(-MAX_ENTRIES) as Step13RpcDiagnosticEntry[] : [];
    } catch {
      return [];
    }
  }

  private persistEntries(): void {
    try {
      window.sessionStorage.setItem(ENTRIES_KEY, JSON.stringify(this.entriesValue));
    } catch {
      // The console line remains available even if session storage is blocked.
    }
  }

  private installWindowApi(): void {
    const api: Step13RpcDiagnosticWindowApi = {
      enable: () => this.enable(),
      disable: () => this.disable(),
      clear: () => this.clear(),
      status: () => ({ enabled: this.isEnabled(), count: this.entriesValue.length }),
      entries: () => this.snapshot(),
      exportJson: () => this.exportJson(),
      download: () => this.download()
    };

    (window as unknown as Record<string, unknown>)['__diariesStep13RpcDiagnostics'] = api;
  }
}
