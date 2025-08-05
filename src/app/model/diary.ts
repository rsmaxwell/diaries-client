


export class Diary {
  constructor(
    public id: number,
    public version: number,
    public sequence: number,
    public name: string
  ) { }

  static default = new Diary(0, 0, 0, '');
}

export class UpdateDiaryRequest extends Diary {
  static fromDiary(diary: Diary): UpdateDiaryRequest {
    return new UpdateDiaryRequest(
      diary.id,
      diary.version,
      diary.sequence,
      diary.name
    );
  }
};



