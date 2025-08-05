
export class Page {
  constructor(
    public id: number,
    public diaryId: number,
    public name: string,
    public extension: string,
    public width: number,
    public height: number,
    public sequence: number,
    public version: number
  ) { }

  static default = new Page(0, 0, '', '', 0, 0, 0, 0);
}

export class UpdatePageRequest extends Page {
  static fromPage(page: Page): UpdatePageRequest {
    return new UpdatePageRequest(
      page.id,
      page.diaryId,
      page.name,
      page.extension,
      page.width,
      page.height,
      page.sequence,
      page.version
    );
  }
};