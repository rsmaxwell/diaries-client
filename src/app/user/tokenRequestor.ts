import { Injectable } from "@angular/core";
import { catchError, EMPTY, from, interval, Observable, of, Subscription, switchMap, take, throwError, timeout } from "rxjs";
import { MqttService } from "../mqtt/mqtt.service";
import { Refresh } from "../model/refresh";
import { Config, ConfigService } from "../config/config.service";
import { v4 as uuidv4 } from 'uuid';
import { isStatus, Status } from "../utilities/reply";
import { ReplyHandler } from "../utilities/replyHandler";
import mqtt from "mqtt";
import { Buffer } from 'buffer';
import { AccessTokenService } from "./token/AccessTokenService";
import { RefreshTokenService } from "./token/RefreshTokenService";
import { HttpStatusCode } from "@angular/common/http";
import { ActivatedRoute, Router } from "@angular/router";


@Injectable({ providedIn: 'root' })
export class TokenRequestor {

  refreshSub?: Subscription;
  connectionPromise: Promise<void> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private configService: ConfigService,
    private mqttService: MqttService,
    private accessTokenService: AccessTokenService,
    private refreshTokenService: RefreshTokenService
  ) { }

  async sendRefreshRequest(): Promise<string> {
    console.log('TokenRequestor: sendRefreshRequest() called');

    return new Promise(async (resolve, reject) => {
      try {
        const [config, client, accessToken, refreshToken] = await Promise.all([
          this.configService.getConfig(),
          this.mqttService.getConnection(),
          this.refreshTokenService.getToken(),
          this.accessTokenService.getToken()
        ]);

        const correlationId = uuidv4();
        const replyTopic = `reply/${config.clientId}/refreshToken`;

        const cleanup = () => {
          client.removeListener('message', messageHandler);
          clearTimeout(timeoutHandle);
        };

        const timeoutHandle = setTimeout(() => {
          cleanup();
          reject('TokenRequestor: Timeout waiting for response');
        }, 5000);

        const messageHandler = (topic: string, payload: Buffer, packet: any) => {
          console.log(`TokenRequestor: received reply for client: ${config.clientId}, topic: ${topic}, correlationId: ${correlationId}`);
          console.log(`TokenRequestor: payload: ${payload.toString()}`);
          if (topic !== replyTopic) return;

          const props = packet.properties;
          const incomingCorrelation = props?.correlationData?.toString();
          if (!(incomingCorrelation === correlationId)) {
            return;
          }

          // We found our reply, so we can stop listening
          console.log(`FragmentServiceAdd: received our reply, so we can stop listening`);
          cleanup();

          const userProperties = props.userProperties;
          console.log(`TokenRequestor: Reply payload: ${payload.toString()}`);

          if (isStatus(userProperties.status)) {
            const status = userProperties.status as Status;
            console.log(`TokenRequestor: Reply status: ${status.code}: ${status.message}`);
            if (status.code != HttpStatusCode.Ok) {
              reject(`TokenRequestor: Bad reply status code: ${status.code}: ${status.message}`);
              return;
            }
          } else {
            reject(`TokenRequestor: Bad or missing reply status: ${userProperties.status}`);
            return;
          }

          try {
            const reply = payload.toString();
            resolve(reply)
          } catch (err) {
            console.error(`TokenRequestor: failed to parse reply: ${err}`);
            console.log(`TokenRequestor: reply: ${payload.toString()}`);
            reject(`TokenRequestor: Failed to parse reply: ${err}`);
          }
        };

        // Subscribe to reply topic
        try {
          client.subscribe(replyTopic, { qos: 1 }, (err) => {
            if (err) {
              cleanup();
              console.log(`TokenRequestor: Subscription failed: ${err.message}`);
              reject(`TokenRequestor: Subscription failed: ${err.message}`);
              return;
            }

            console.log(`TokenRequestor: Client: Subscribed to ${replyTopic}, awaiting reply with correlationId: ${correlationId}`);
            client.on('message', messageHandler);

            // Publish request
            const payload = {
              function: 'refreshToken',
              args: new Refresh(config.username, refreshToken)
            };

            let payloadJson: string;
            try {
              payloadJson = JSON.stringify(payload);
            } catch (err) {
              cleanup();
              console.error('TokenRequestor: Failed to serialize payload:', err);
              reject(`TokenRequestor: Payload serialization failed: ${err}`);
              return;
            }

            const publishOptions: mqtt.IClientPublishOptions = {
              qos: 1,
              retain: false,
              properties: {
                responseTopic: replyTopic,
                correlationData: Buffer.from(correlationId, 'utf-8'),
                userProperties: {
                  accessToken: accessToken
                }
              }
            };

            console.log(`TokenRequestor: Publishing to request: ${payloadJson}`);
            client.publish('request', payloadJson, publishOptions, (err) => {
              if (err) {
                cleanup();
                console.error('TokenRequestor: Publish failed:', err);
                reject(`TokenRequestor: Publish failed: ${err.message}`);
              }
            });
          });
        } catch (err) {
          cleanup();
          console.error('TokenRequestor: Subscription threw an error:', err);
          reject(`TokenRequestor: Subscription error: ${err}`);
        }
      } catch (err) {
        console.error('TokenRequestor: Unexpected error:', err);
        reject(`TokenRequestor: Internal error: ${err}`);
      }
    });
  }

  start(refreshInterval: number): void {

    console.log(`TokenRequestor.start: refreshInterval: ${refreshInterval} seconds`);

    this.stop()  // Prevent duplicates

    this.refreshSub = interval(refreshInterval * 1000)
      .pipe(
        switchMap(() => from(this.sendRefreshRequest())),
        catchError(err => {
          console.log('Token refresh failed:', err);
          this.router.navigate(['/signin']);
          return EMPTY;
        })
      )
      .subscribe(newToken => { });
  }

  stop(): void {
    this.refreshSub?.unsubscribe();
  }
}

