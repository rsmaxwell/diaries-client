
export type FragmentType = 'MARQUEE' | 'IMAGE';

export interface Fragment {
  id: number;
  pageId?: number | null;
  type?: FragmentType | null;
  imageId?: number | null;
  /** Fragment-owned external destination, independent of the catalogue Image. */
  imageLinkUrl?: string | null;
  marqueeId: number | null;
  year: number;
  month: number;
  day: number;
  sequence: number;
  version: number;
  text: string;

  lock?: EditLockInfo | null;
}

export type MarqueeFragment = Fragment & { type?: 'MARQUEE' | null };
export type ImageFragment = Fragment & { type: 'IMAGE' };
export type PageOwnedFragment = Fragment & { pageId: number };

/** Null/absent type is the documented rolling-migration MARQUEE fallback. */
export function effectiveFragmentType(fragment: Fragment): FragmentType {
  return fragment.type ?? 'MARQUEE';
}

export function isMarqueeFragment(fragment: Fragment | null | undefined): fragment is MarqueeFragment {
  return !!fragment && effectiveFragmentType(fragment) === 'MARQUEE';
}

export function isImageFragment(fragment: Fragment | null | undefined): fragment is ImageFragment {
  return !!fragment && fragment.type === 'IMAGE';
}

export function hasAuthoritativePage(fragment: Fragment | null | undefined): fragment is PageOwnedFragment {
  return !!fragment && Number.isInteger(fragment.pageId) && (fragment.pageId as number) > 0;
}

export class NormaliseFragmentsRequest {
  constructor(
    public year: number,
    public month: number,
    public day: number
  ) { };
}

export class AddFragmentRequest {
  constructor(
    public pageId: number,
    public year: number,
    public month: number,
    public day: number,
    public sequence: number,
    public text: string,
    public x: number,
    public y: number,
    public width: number,
    public height: number
  ) { }
}

/**
 * Creates an IMAGE Fragment. Fragment identity fields (`id`, `type` and
 * `marqueeId`) are deliberately server-authoritative and are therefore not
 * part of this request model.
 *
 * `imageId` is optional to match the responder contract. When it is omitted,
 * JSON serialization omits the property entirely; explicit `null` is retained.
 */
export class AddImageFragmentRequest {
  declare public imageId?: number | null;
  declare public imageLinkUrl?: string;

  constructor(
    public pageId: number,
    public year: number,
    public month: number,
    public day: number,
    public sequence: number,
    public text: string,
    imageId?: number | null,
    imageLinkUrl?: string
  ) {
    if (imageId !== undefined) {
      this.imageId = imageId;
    }
    if (imageLinkUrl !== undefined) {
      this.imageLinkUrl = requireSafeImageLinkUrl(imageLinkUrl);
    }
  }
}

/**
 * Ordinary Fragment update request. Fragment relationship/identity fields are
 * deliberately omitted: `pageId`, `type`, `marqueeId` and `imageId` remain
 * responder-authoritative. Null relationship fields are deliberately omitted;
 * serialising them breaks mqtt-rpc Request's Map.copyOf(args).
 *
 * Omitting imageId also means "preserve the existing Image reference".
 */
export class UpdateFragmentRequest {
  constructor(
    public id: number,
    public year: number,
    public month: number,
    public day: number,
    public sequence: number,
    public version: number,
    public text: string
  ) { };

  static fromFragment(fragment: Fragment): UpdateFragmentRequest {

    console.log('UpdateFragmentRequest.fromFragment', {
      id: fragment.id,
      version: fragment.version
    });

    return new UpdateFragmentRequest(
      fragment.id,
      fragment.year,
      fragment.month,
      fragment.day,
      fragment.sequence,
      fragment.version,
      fragment.text,
    );
  }
}

/**
 * Deliberate Image-reference mutation for an existing IMAGE Fragment.
 *
 * This request is intentionally separate from UpdateFragmentRequest so an
 * ordinary text/date/sequence update cannot accidentally become Image
 * authoring. A positive imageId attaches/replaces the reference; null clears
 * it. The preserve state is represented by using UpdateFragmentRequest instead
 * and therefore omitting imageId entirely.
 */
export class UpdateImageFragmentRequest extends UpdateFragmentRequest {
  private constructor(
    id: number,
    year: number,
    month: number,
    day: number,
    sequence: number,
    version: number,
    text: string,
    public imageId: number | null
  ) {
    super(id, year, month, day, sequence, version, text);
  }

  static fromImageFragment(fragment: ImageFragment, imageId: number | null): UpdateImageFragmentRequest {
    if (fragment.type !== 'IMAGE') {
      throw new Error('Only an IMAGE Fragment can change its Image reference');
    }

    if (imageId !== null && (!Number.isInteger(imageId) || imageId <= 0)) {
      throw new Error('Image id must be a positive integer or null');
    }

    return new UpdateImageFragmentRequest(
      fragment.id,
      fragment.year,
      fragment.month,
      fragment.day,
      fragment.sequence,
      fragment.version,
      fragment.text,
      imageId
    );
  }
}

/** Only deliberate link edits add either field; all other updates PRESERVE it. */
export class UpdateImageLinkRequest extends UpdateFragmentRequest {
  readonly imageLinkUrl?: string;
  readonly clearImageLinkUrl?: true;

  constructor(fragment: ImageFragment, intent: { set: string } | { clear: true }) {
    super(fragment.id, fragment.year, fragment.month, fragment.day,
      fragment.sequence, fragment.version, fragment.text);
    if (fragment.type !== 'IMAGE') throw new Error('Only IMAGE fragments may have a link');
    if ('set' in intent) this.imageLinkUrl = requireSafeImageLinkUrl(intent.set);
    else this.clearImageLinkUrl = true;
  }
}

/** Check untrusted retained URLs before presenting them as clickable links. */
export function safeImageLinkUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.length || value.length > 4096 || /[\u0000-\u0020\u007f]/.test(value)) return null;
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol.toLowerCase()) ||
        !url.hostname || url.username || url.password) return null;
    return value; // Preserve query, fragment and existing percent encoding.
  } catch { return null; }
}

export function requireSafeImageLinkUrl(value: string): string {
  if (safeImageLinkUrl(value) === null) throw new Error('Enter an absolute http:// or https:// URL (maximum 4096 characters)');
  return value;
}

export class DeleteFragmentRequest {
  constructor(public id: number) { }
}

export interface EditLockInfo {
  lockUserId: number | null;
  lockUserName: string | null;
  lockKnownAs: string | null;
  lockTimeStamp: number | null;    // epoch millis
  lockSessionId: string | null;
}

export class LockFragmentRequest {
  constructor(public id: number) { }
  static fromId(id: number): LockFragmentRequest {
    return new LockFragmentRequest(id);
  }
}

export class UnlockFragmentRequest {
  constructor(public id: number) { }
  static fromId(id: number): UnlockFragmentRequest {
    return new UnlockFragmentRequest(id);
  }
}
