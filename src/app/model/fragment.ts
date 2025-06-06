import { Rectangle } from "../utilities/rectangle";
import { Marquee } from "./marquee";

export class Fragment {
  constructor(
    public id: number,
    public year: number,
    public month: number,
    public day: number,
    public sequence: number,
    public rectangle: Rectangle,
    public text: string
  ) {};

  public toMarquee() {
    return new Marquee(this.id, this.rectangle, this.sequence);
  }
}
