import { Injectable } from "@angular/core";
import { catchError, EMPTY, forkJoin, interval, Observable, Subscription, switchMap } from "rxjs";
import { AccessTokenService } from "./token/AccessTokenService";
import { Router } from "@angular/router";
import { RpcService } from "../mqtt/rpc.service";
import { RefreshTokenReply, RefreshTokenRequest } from "../model/refresh.token";
import { ConfigService } from "../config/config.service";
import { MqttService } from "../mqtt/mqtt.service";
import { RefreshTokenService } from "./token/RefreshTokenService";
import { Constants } from "../utilities/constants";
import { ReplyHandler } from "../utilities/replyHandler";


@Injectable({ providedIn: 'root' })
export class TokenRequestor {

  refreshSub?: Subscription;

  constructor(
    private config: ConfigService,
    private mqtt: MqttService,
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
        console.log(`sendRefreshRequest: token: ${reply.token}`);
        this.accessTokenService.setToken(reply.token);
        return EMPTY;
      }),
      catchError((err) => {
        console.error(`sendRefreshRequest: error: ${err}`);
        this.accessToken.clearToken();
        this.refreshToken.clearToken();
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
