export class EditLockInfo {
  constructor(
    public userId: number,
    public userName: string,
    public knownAs: string,
    public timestamp: number,
    public sessionId: string
  ) { };
}
