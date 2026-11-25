import { Injectable } from "@angular/core";
import { BehaviorSubject } from "rxjs";
import { TokenService } from "./tokenService";
import { RefreshTokenService } from "./refreshTokenService";

type TabSessionMessage = {
  kind: 'hello' | 'present';
  userId: number;
  sessionId: string;
  instanceId: string;
  startedAt: number;
  targetId?: string;
};

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

  // sessionStorage is normally tab-scoped, but a browser's "Duplicate tab"
  // copies its contents, including BOTH the JWT and the lock session id.
  // Detect that collision with other live tabs before allowing two editors
  // to claim the same lock. A normal refresh keeps its original session.
  private channel?: BroadcastChannel;
  private instanceId = crypto.randomUUID();
  private startedAt = Date.now();
  private duplicateSessionDetected = false;

  constructor(private refreshTokenService: RefreshTokenService) {
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
    this.startTabSessionCheck();
  }

  private startTabSessionCheck(): void {
    if (typeof BroadcastChannel === 'undefined') return;
    this.channel = new BroadcastChannel('diaries-lock-session-v1');
    this.channel.onmessage = event => this.onTabSessionMessage(event.data as TabSessionMessage);
    window.addEventListener('pagehide', () => this.channel?.close(), { once: true });
    this.announceSession();
  }

  private announceSession(): void {
    if (!this.channel || !this.getCurrentToken() || this.userId == null || !this.sessionId) return;
    this.channel.postMessage({
      kind: 'hello', userId: this.userId, sessionId: this.sessionId,
      instanceId: this.instanceId, startedAt: this.startedAt
    } satisfies TabSessionMessage);
  }

  private onTabSessionMessage(message: TabSessionMessage): void {
    if (!message || this.duplicateSessionDetected || !this.getCurrentToken()
        || this.userId == null || !this.sessionId
        || message.userId !== this.userId || message.sessionId !== this.sessionId
        || message.instanceId === this.instanceId) return;

    if (message.kind === 'hello') {
      // In a simultaneous start, only the older tab answers. The tie-break
      // prevents both tabs logging one another out.
      if (this.startedAt < message.startedAt
          || (this.startedAt === message.startedAt && this.instanceId < message.instanceId)) {
        this.channel?.postMessage({
          kind: 'present', userId: this.userId, sessionId: this.sessionId,
          instanceId: this.instanceId, startedAt: this.startedAt,
          targetId: message.instanceId
        } satisfies TabSessionMessage);
      }
    } else if (message.kind === 'present' && message.targetId === this.instanceId) {
      this.duplicateSessionDetected = true;
      console.warn('Editor tab inherited another active editor session; separate sign-in required');
      this.clearToken();
      this.refreshTokenService.clearToken();
      sessionStorage.removeItem('diaries.sessionId');
      // A new sign-in creates a new session id inside the signed JWT. Changing
      // only the local session id would NOT be sufficient for responder locks.
      const destination = new URL('signin', document.baseURI);
      destination.searchParams.set('returnUrl', window.location.pathname + window.location.search);
      window.location.replace(destination.toString());
    }
  }

  // ----- Observables -----

  get userId$() {
    return this.userIdSubject.asObservable();
  }

  get username$() {
    return this.usernameSubject.asObservable();
  }

  get knownAs$() {
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

    console.log('AccessTokenService.setUserInfo', {
      userId,
      username,
      knownAs,
      hasSessionId: !!sessionId
    });

    this.userIdSubject.next(userId);
    this.usernameSubject.next(username);
    this.knownAsSubject.next(knownAs);
    this.sessionIdSubject.next(sessionId);

    sessionStorage.setItem(this.userIdKey, String(userId));
    sessionStorage.setItem(this.usernameKey, username ?? "");
    sessionStorage.setItem(this.knownAsKey, knownAs ?? "");
    sessionStorage.setItem(this.sessionIdKey, sessionId ?? "");
    this.announceSession();
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