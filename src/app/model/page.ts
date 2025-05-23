
export class Page {
  constructor(
    public id: number,
    public name: string,
    public extension: string,
    public width: number,
    public height: number,
    public sequence: number
  ) { }

  static default = new Page(0, '', '', 0, 0, 0);
}

export class UpdatePageRequest extends Page {
  static fromPage(page: Page): UpdatePageRequest {
    return new UpdatePageRequest(
      page.id,
      page.name,
      page.extension,
      page.width,
      page.height,
      page.sequence
    );
  }
};