import { Marquee } from "./marquee";
import { Reply } from "./reply";


export class Page {
  id: number;
  name: string;
  extension: string;
  width: number;
  height: number;
  sequence: number;

  constructor() {
    this.id = 0;
    this.name = ``;
    this.extension = ``;
    this.width = 0;
    this.height = 0;
    this.sequence = 0;
  }
}

export class PageResponse {
  page: Page;
  marquees: Marquee[];

  constructor(page: Page, marquees: Marquee[]) {
    this.page = page;
    this.marquees = marquees;
  }
}

