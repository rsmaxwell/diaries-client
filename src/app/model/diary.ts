

import { Page } from './page';
import { Reply } from './reply';

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

export interface GetDiaryReply extends Reply {
  diary: Diary
  pages: Page[];
};

export class UpdateDiaryRequest {
  id: number;
  name: string;
  sequence: number;

  constructor(diary: Diary) {
      this.id = diary.id;
      this.name = diary.name;
      this.sequence = diary.sequence;
  }
}


