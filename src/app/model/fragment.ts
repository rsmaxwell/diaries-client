import { Rectangle } from "../utilities/rectangle";
import { Marquee } from "./marquee";

export class Fragment {
  constructor(
    public id: number,
    public year: number,
    public month: number,
    public day: number,
    public sequence: number,
    public marquee: Marquee,
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
