
import { BehaviorSubject, Observable } from "rxjs";

export class TokenService {

  private token: string | null = null;
  private tokenSubject = new BehaviorSubject<string | null>(null);

  setToken(token: string) {
    this.token = token;
    this.tokenSubject.next(token);
  }

  getToken(): Promise<string> {
    if (this.token) {
      return Promise.resolve(this.token);
    }

    return new Promise((resolve, reject) => {
      const sub = this.tokenSubject.subscribe(token => {
        if (token) {
          sub.unsubscribe();
          resolve(token);
        }
      });

      // Optional timeout in case something goes wrong
      setTimeout(() => {
        sub.unsubscribe();
        reject('Token not available');
      }, 5000);
    });
  }

  getCurrentToken(): string | null {
    return this.token;
  }
}
