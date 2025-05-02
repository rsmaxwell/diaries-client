import { Fragment } from "../model/fragment/fragment";

export class Page {
  id: number;
  name: string;
  extension: string;
  width: number;
  height: number;

  constructor() {
    this.id = 0;
    this.name = ``;
    this.extension = ``;
    this.width = 0;
    this.height = 0;
  }
}

export class PageResponse {
  page: Page;
  fragments: Fragment[];

  constructor(page: Page, fragments: Fragment[]) {
    this.page = page;
    this.fragments = fragments;
  }
}


export class PagesResponse {
  pages: Page[];

  constructor(pages: Page[]) {
    this.pages = pages;
  }
}
