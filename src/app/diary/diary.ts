

import { Page } from '../page/page';

export class Diary {
  id: number;
  name: string;
  // pages: Page[];

  constructor() {
    this.id = 0;
    this.name = ``;
    // this.pages = [];
  }
}

export class DiaryResponse {
  diary: Diary;
  pages: Page[];

  constructor(diary: Diary, pages: Page[]) {
    this.diary = diary;
    this.pages = pages;
  }
}


