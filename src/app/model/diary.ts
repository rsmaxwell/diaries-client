


export class Diary {
  constructor(
    public id: number,
    public name: string,
    public sequence: number
  ) { }

  static default = new Diary(0, '', 0);
}

export class xxUpdateDiaryRequest {
  id: number;
  name: string;
  sequence: number;

  constructor(diary: Diary) {
    this.id = diary.id;
    this.name = diary.name;
    this.sequence = diary.sequence;
  }
}

export class UpdateDiaryRequest extends Diary {
  static fromDiary(diary: Diary): UpdateDiaryRequest {
    return new UpdateDiaryRequest(
      diary.id,
      diary.name,
      diary.sequence
    );
  }
};



