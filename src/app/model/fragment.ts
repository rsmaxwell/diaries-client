import { EditLockInfo } from "./EditLockInfo";
import { Marquee } from "./marquee";

export class Fragment {
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

export class LockFragmentRequest {
  constructor(
    public fragmentId: number,
    public lockUserId: number,
    public lockUserName: string,
    public lockKnownAs: string,
    public lockTimestamp: number,
    public lockSessionId: string
  ) { };

  static fromFragmentAndlock(fragment: Fragment, lock: EditLockInfo): LockFragmentRequest {

    console.log(`LockFragmentRequest.fromFragmentAndlock: fragment: ${JSON.stringify(fragment)} lock: ${lock}`);

    return new LockFragmentRequest(
      fragment.id,
      lock.userId,
      lock.userName,
      lock.knownAs,
      lock.timestamp,
      lock.sessionId
    );
  }
};
