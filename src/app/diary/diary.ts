

import { Page } from '../pages/page';

export class Diary {
  id: number;
  name: string;
  pages: Page[];

  constructor() {
    this.id = 0;
    this.name = ``;
    this.pages = [];
  }
}

export class RawDiaryResponse {
  diary: Diary;
  pages: string[];

  constructor(diary: Diary, pages: string[]) {
    this.diary = diary;
    this.pages = pages;
  }
}


