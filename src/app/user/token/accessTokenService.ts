import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { TokenService } from "./tokenService";

@Injectable({ providedIn: "root" })
export class AccessTokenService extends TokenService {

  private readonly userIdKey = "accessToken.userId";
  private readonly usernameKey = "accessToken.username";
  private readonly knownasKey = "accessToken.knownas";

  private userIdSubject = new BehaviorSubject<number | null>(null);
  private usernameSubject = new BehaviorSubject<string | null>(null);
  private knownasSubject = new BehaviorSubject<string | null>(null);

  constructor() {
    super("accessToken");

    // Restore identity from sessionStorage (if available)
    const savedUserId = sessionStorage.getItem(this.userIdKey);
    const savedUsername = sessionStorage.getItem(this.usernameKey);
    const savedKnownas = sessionStorage.getItem(this.knownasKey);

    if (savedUserId != null && savedUserId !== "") {
      const n = Number(savedUserId);
      this.userIdSubject.next(Number.isFinite(n) ? n : null);
    }

    if (savedUsername != null) {
      this.usernameSubject.next(savedUsername);
    }

    if (savedKnownas != null) {
      this.knownasSubject.next(savedKnownas);
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
    return this.knownasSubject.asObservable();
  }

  // ----- Synchronous getters -----

  get userId(): number | null {
    return this.userIdSubject.value;
  }

  get username(): string | null {
    return this.usernameSubject.value;
  }

  get knownas(): string | null {
    return this.knownasSubject.value;
  }

  /**
   * Call this after successful sign-in (or token refresh if it returns identity).
   */
  setUserInfo(userId: number, username: string, knownas: string): void {
    this.userIdSubject.next(userId);
    this.usernameSubject.next(username);
    this.knownasSubject.next(knownas);

    sessionStorage.setItem(this.userIdKey, String(userId));
    sessionStorage.setItem(this.usernameKey, username ?? "");
    sessionStorage.setItem(this.knownasKey, knownas ?? "");
  }

  clearUserInfo(): void {
    this.userIdSubject.next(null);
    this.usernameSubject.next(null);
    this.knownasSubject.next(null);

    sessionStorage.removeItem(this.userIdKey);
    sessionStorage.removeItem(this.usernameKey);
    sessionStorage.removeItem(this.knownasKey);
  }

  override clearToken(): void {
    super.clearToken();
    this.clearUserInfo();
  }
}