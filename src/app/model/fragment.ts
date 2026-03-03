
export interface Fragment {
  id: number;
  marqueeId: number | null;
  year: number;
  month: number;
  day: number;
  sequence: number;
  version: number;
  text: string;

  lock?: EditLockInfo | null; 
}

export class NormaliseFragmentsRequest {
  constructor(
    public year: number,
    public month: number,
    public day: number
  ) { };
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

    console.log(`UpdateFragmentRequest.fromFragment: ${JSON.stringify(fragment)}`);

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

export interface EditLockInfo {
  lockUserId: number | null;
  lockUserName: string | null;
  lockKnownAs: string | null;
  lockTimeStamp: number | null;    // epoch millis
  lockSessionId: string | null;
  locked: boolean | null;
}

export class LockFragmentRequest {
  constructor(public id: number) {}
  static fromId(id: number): LockFragmentRequest {
    return new LockFragmentRequest(id);
  }
}

export class UnlockFragmentRequest {
  constructor(public id: number) {}
  static fromId(id: number): UnlockFragmentRequest {
    return new UnlockFragmentRequest(id);
  }
}
