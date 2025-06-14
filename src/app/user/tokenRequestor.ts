import { Injectable } from "@angular/core";
import { catchError, interval, Observable, Subscription, switchMap } from "rxjs";
import { AccessTokenService } from "./token/AccessTokenService";
import { Router } from "@angular/router";
import { RpcService } from "../mqtt/rpc.service";
import { RefreshTokenReply } from "../model/refresh.token";
import { RefreshTokenService } from "./token/RefreshTokenService";


@Injectable({ providedIn: 'root' })
export class TokenRequestor {

  refreshSub?: Subscription;

  refreshPeriod = 30;

  constructor(
    private accessToken: AccessTokenService,
    private refreshToken: RefreshTokenService,
    private rpcService: RpcService,
    private router: Router,
    private accessTokenService: AccessTokenService
  ) { }

  sendRefreshRequest(): Observable<string> {
    console.log('TokenRequestor: sendRefreshRequest() called');

    return this.rpcService.refreshToken$().pipe(
      switchMap((reply: RefreshTokenReply) => {
        console.log(`TokenRequestor: sendRefreshRequest: reply: ${JSON.stringify(reply)}`);
        console.log(`TokenRequestor: sendRefreshRequest: refreshInterval: ${reply.refreshPeriod}`);
        this.accessTokenService.setToken(reply.accessToken);

        if (this.refreshPeriod != reply.refreshPeriod) {
          this.refreshPeriod = reply.refreshPeriod
          this.stop();
          this.start(this.refreshPeriod)
        }

        this.refreshPeriod = reply.refreshPeriod;
        return "ok";
      }),
      catchError((err) => {
        console.log(`TokenRequestor: sendRefreshRequest: error: ${err}`);
        this.accessToken.clearToken();
        this.refreshToken.clearToken();
        this.stop();
        this.router.navigate(['/signin']);
        return "ok";
      })
    );
  }

  start(refreshInterval: number): void {
    console.log(`TokenRequestor.start: ${new Date().toISOString()}`);
    console.log(`TokenRequestor.start: refreshInterval: ${refreshInterval} seconds`);
    this.stop();  // prevent duplicates

    this.refreshSub = interval(refreshInterval * 1000)
      .pipe(
        switchMap(() => this.sendRefreshRequest())
      )
      .subscribe();
  }

  stop(): void {
    this.refreshSub?.unsubscribe();
  }
}
