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

    console.log('TokenRequestor.sendRefreshRequest');
    return new Promise((resolve, reject) => {

      // Get the configuration
      this.configService.getConfig()
        .then((config) => {

          // Get the MQTT connection
          this.mqttService.getConnection()
            .then((client) => {
              this.connected(client, config, resolve, reject);
            })
            .catch(err => {
              reject(`Error getting the MQTT connection: ${err}`);
            })
        })
        .catch(err => {
          reject(`Error getting the configuration: ${err}`);
        })
    })
  }

  connected(client: mqtt.MqttClient, config: Config, resolve: (value: string) => void, reject: (reason?: any) => void) {
    console.log(`TokenRequestor.sendRefreshRequest.connected`);

    const correlationId = uuidv4();
    const replyTopic = `reply/${config.clientId}/refreshToken`;

    const timeoutHandle = setTimeout(() => {
      client.removeListener('message', messageHandler);
      reject('Timeout waiting for response');
    }, 5000);

    const messageHandler = (topic: string, payload: Buffer, packet: any) => {
      console.log(`received reply for client: ${config.clientId}, topic: ${topic}, correlationId: ${correlationId}`);
      console.log(`payload: ${payload.toString()}`);

      if (!(topic === replyTopic)) {
        return;
      }

      const props = packet.properties;
      const incomingCorrelation = props?.correlationData?.toString();
      if (!(incomingCorrelation === correlationId)) {
        return;
      }

      // We found our reply, so we can stop listening
      client.removeListener('message', messageHandler);
      clearTimeout(timeoutHandle);

      const userProperties = props.userProperties;
      const status = userProperties.status;

      console.log(`status: ${status}`);
      console.log(`payload: ${payload.toString()}`);

      if (isStatus(userProperties.status)) {
        let status = userProperties.status as Status;
        if (status.code != HttpStatusCode.Ok) {
          reject(`Failed to refresh the accessToken: ${status.code}: ${status.message}`);
          return;
        }
      }

      let obj;
      try {
        obj = ReplyHandler.getBufferAsObject(payload)
      } catch (err) {
        reject(`Failed to parse message: ${err}`);
        return;
      }

      if (!(obj !== null && typeof obj === 'string')) {
        reject(`Unexpected reply`);
        return;
      }

      const reply = obj as string;
      resolve(reply)
    }

    // Step 1: Subscribe to reply topic
    client.subscribe(replyTopic, { qos: 1 }, (err) => {
      if (err) {
        reject(`Subscription failed: ${err.message}`);
      } else {
        console.log(`Client: ${config.clientId} waiting for reply with correlationId: ${correlationId}`);
        client.on('message', messageHandler);
      }

      // Step 2: Publish refresh request
      const refreshToken = this.refreshTokenService.getCurrentToken()!;
      const accessToken = this.accessTokenService.getCurrentToken()!;
      const refresh: Refresh = new Refresh(config.username, refreshToken);
      const payload = { function: 'refreshToken', args: refresh };

      // The MQTT publish options
      const publishOptions: any = {
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

      console.log(`${JSON.stringify(payload)}`);
      client.publish('request', JSON.stringify(payload), publishOptions, (err) => {
        if (err) {
          client.removeListener('message', messageHandler);
          reject(`Publish failed: ${err.message}`);
        }
      })
    })
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

