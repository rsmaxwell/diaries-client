import { Marquee } from "./marquee";

export class Fragment {
  constructor(
    public id: number,
    public year: number,
    public month: number,
    public day: number,
    public sequence: number,
    public marquee: Marquee | null,
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
    public year: number,
    public month: number,
    public day: number,
    public sequence: number,
    public marqueeId: number | null,
    public text: string
  ) { };

  static fromFragment(fragment: Fragment): UpdateFragmentRequest {

    console.log(`UpdateFragmentRequest.fromFragment: ${JSON.stringify(fragment)}`);

    return new UpdateFragmentRequest(
      fragment.id,
      fragment.year,
      fragment.month,
      fragment.day,
      fragment.sequence,
      fragment.marquee!.id,
      fragment.text,
    );
  }
};
