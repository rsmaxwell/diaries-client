import { BehaviorSubject, firstValueFrom, filter, timeout } from "rxjs";

export class TokenService {

  private token: string | null = null;
  private tokenSubject = new BehaviorSubject<string | null>(null);

  constructor() {
    const saved = localStorage.getItem('accessToken');
    if (saved) {
      this.token = saved;
      this.tokenSubject.next(saved);
    }
  }

  setToken(token: string) {
    this.token = token;
    this.tokenSubject.next(token);
    localStorage.setItem('accessToken', token);
  }

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
    localStorage.removeItem('accessToken');
  }
}
