import { BehaviorSubject, filter, firstValueFrom, timeout } from "rxjs";

export class TokenService {

  private token: string | null = null;

  // protected so subclasses (AccessTokenService) can use it if they want
  protected tokenSubject = new BehaviorSubject<string | null>(null);

  private storageKey: string;

  constructor(storageKey: string) {
    this.storageKey = storageKey;

    const saved = sessionStorage.getItem(this.storageKey);
    if (saved) {
      this.token = saved;
      this.tokenSubject.next(saved);
    }
  }

  /** Observable stream of the current token (null when cleared). */
  get token$() {
    return this.tokenSubject.asObservable();
  }

  setToken(token: string) {
    this.token = token;
    this.tokenSubject.next(token);
    sessionStorage.setItem(this.storageKey, token);
  }

  /**
   * Returns token immediately if present; otherwise waits (up to 5s)
   * for it to be set.
   */
  getToken(): Promise<string> {
    if (this.token) return Promise.resolve(this.token);

    return firstValueFrom(
      this.tokenSubject.pipe(
        filter((token): token is string => !!token),
        timeout(5000)
      )
    );
  }

  getCurrentToken(): string | null {
    return this.token;
  }

  clearToken(): void {
    this.token = null;
    this.tokenSubject.next(null);
    sessionStorage.removeItem(this.storageKey);
  }
}