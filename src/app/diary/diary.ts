

import { Page } from '../model/page';

export class Diary {
  id: number;
  name: string;
  sequence: number;

  constructor() {
    this.id = 0;
    this.name = ``;
    this.sequence = 0;
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




