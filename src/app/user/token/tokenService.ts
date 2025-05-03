
import { BehaviorSubject, Observable } from "rxjs";

export class TokenService {
  private token$ = new BehaviorSubject<string | null>(null);

  setToken(token: string) {
    this.token$.next(token);
  }

  getToken(): Observable<string | null> {
    return this.token$.asObservable();
  }

  getCurrentToken(): string | null {
    return this.token$.value;
  }
}
