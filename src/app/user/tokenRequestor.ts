import { Injectable } from "@angular/core";
import { catchError, EMPTY, interval, Observable, Subscription, switchMap } from "rxjs";
import { AccessTokenService } from "./token/AccessTokenService";
import { Router } from "@angular/router";
import { RpcService } from "../mqtt/rpc.service";
import { RefreshTokenReply } from "../model/refresh.token";


@Injectable({ providedIn: 'root' })
export class TokenRequestor {

  refreshSub?: Subscription;

  constructor(
    private router: Router,
    private rpcService: RpcService,
    private accessTokenService: AccessTokenService
  ) { }

  sendRefreshRequest(): Observable<string> {
    console.log('TokenRequestor: sendRefreshRequest() called');

    return this.rpcService.refreshToken$().pipe(
      switchMap((reply: RefreshTokenReply) => {
        console.log(`sendRefreshRequest: token: ${reply.token}`);
        this.accessTokenService.setToken(reply.token);
        return EMPTY;
      }),
      catchError((err) => {
        console.error(`sendRefreshRequest: error: ${err}`);
        this.router.navigate(['/signin']);
        return EMPTY;
      })
    );
  }

  start(refreshInterval: number): void {
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
