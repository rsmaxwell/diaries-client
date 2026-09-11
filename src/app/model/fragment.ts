
export type FragmentType = 'MARQUEE' | 'IMAGE';

export interface Fragment {
  id: number;
  pageId?: number | null;
  type?: FragmentType | null;
  imageId?: number | null;
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
export type PageOwnedFragment = Fragment & { pageId: number };

/** Null/absent type is the documented rolling-migration MARQUEE fallback. */
export function effectiveFragmentType(fragment: Fragment): FragmentType {
  return fragment.type ?? 'MARQUEE';
}

export function isMarqueeFragment(fragment: Fragment | null | undefined): fragment is MarqueeFragment {
  return !!fragment && effectiveFragmentType(fragment) === 'MARQUEE';
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

export class UpdateFragmentRequest {
  constructor(
    public id: number,
    public marqueeId: number | null,
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
      version: fragment.version,
      marqueeId: fragment.marqueeId
    });

    return new UpdateFragmentRequest(
      fragment.id,
      fragment.marqueeId,
      fragment.year,
      fragment.month,
      fragment.day,
      fragment.sequence,
      fragment.version,
      fragment.text,
    );
  }
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
