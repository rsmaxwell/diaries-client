import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { TokenService } from "./tokenService";

@Injectable({ providedIn: "root" })
export class AccessTokenService extends TokenService {

  private readonly userIdKey = "accessToken.userId";
  private readonly usernameKey = "accessToken.username";
  private readonly knownAsKey = "accessToken.knownAs";
  private readonly sessionIdKey = "accessToken.sessionId";

  private userIdSubject = new BehaviorSubject<number | null>(null);
  private usernameSubject = new BehaviorSubject<string | null>(null);
  private knownAsSubject = new BehaviorSubject<string | null>(null);
  private sessionIdSubject = new BehaviorSubject<string | null>(null);

  constructor() {
    super("accessToken");

    // Restore identity from sessionStorage (if available)
    const savedUserId = sessionStorage.getItem(this.userIdKey);
    const savedUsername = sessionStorage.getItem(this.usernameKey);
    const savedKnownAs = sessionStorage.getItem(this.knownAsKey);
    const savedSessionId = sessionStorage.getItem(this.sessionIdKey);

    if (savedUserId != null && savedUserId !== "") {
      const n = Number(savedUserId);
      this.userIdSubject.next(Number.isFinite(n) ? n : null);
    }

    if (savedUsername != null) {
      this.usernameSubject.next(savedUsername);
    }

    if (savedKnownAs != null) {
      this.knownAsSubject.next(savedKnownAs);
    }

    if (savedSessionId != null) {
      this.sessionIdSubject.next(savedSessionId);
    }
  }

  // ----- Observables -----

  get userId$() {
    return this.userIdSubject.asObservable();
  }

  get username$() {
    return this.usernameSubject.asObservable();
  }

  get knownas$() {
    return this.knownAsSubject.asObservable();
  }

  get mySessionId$() {
    return this.sessionIdSubject.asObservable();
  }

  // ----- Synchronous getters -----

  get userId(): number | null {
    return this.userIdSubject.value;
  }

  get username(): string | null {
    return this.usernameSubject.value;
  }

  get knownAs(): string | null {
    return this.knownAsSubject.value;
  }

  get sessionId(): string | null {
    return this.sessionIdSubject.value;
  }

  /**
   * Call this after successful sign-in (or token refresh if it returns identity).
   */
  setUserInfo(userId: number, username: string, knownAs: string, sessionId: string): void {

    console.log(`AccessTokenService.setUserInfo: userId: ${userId}, knownAs: ${knownAs}, sessionId: ${sessionId}`);

    this.userIdSubject.next(userId);
    this.usernameSubject.next(username);
    this.knownAsSubject.next(knownAs);
    this.sessionIdSubject.next(sessionId);

    sessionStorage.setItem(this.userIdKey, String(userId));
    sessionStorage.setItem(this.usernameKey, username ?? "");
    sessionStorage.setItem(this.knownAsKey, knownAs ?? "");
    sessionStorage.setItem(this.sessionIdKey, sessionId ?? "");
  }

  clearUserInfo(): void {
    this.userIdSubject.next(null);
    this.usernameSubject.next(null);
    this.knownAsSubject.next(null);
    this.sessionIdSubject.next(null);

    sessionStorage.removeItem(this.userIdKey);
    sessionStorage.removeItem(this.usernameKey);
    sessionStorage.removeItem(this.knownAsKey);
    sessionStorage.removeItem(this.sessionIdKey);
  }

  override clearToken(): void {
    super.clearToken();
    this.clearUserInfo();
  }
}