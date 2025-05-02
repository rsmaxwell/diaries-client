import { Injectable } from "@angular/core";
import { catchError, EMPTY, from, interval, Observable, of, Subscription, switchMap, take, throwError, timeout } from "rxjs";
import { MqttService } from "../mqtt/mqtt.service";
import { TokenService } from "./tokenService";
import { Refresh } from "../model/refresh";
import { Config, ConfigService } from "../config/config.service";
import { v4 as uuidv4 } from 'uuid';
import { getUnexpectedReplyMessage, isRequestTokenReply, RequestTokenReply } from "../utilities/reply";
import { ReplyHandler } from "../utilities/replyHandler";
import mqtt from "mqtt";
import { Buffer } from 'buffer';


@Injectable({ providedIn: 'root' })
export class TokenRequestor {

  refreshSub?: Subscription;
  connectionPromise: Promise<void> | null = null;
  refreshIntervalMs = 5 * 60 * 1000; // i.e.  5 minutes

  constructor(
    private configService: ConfigService,
    private mqttService: MqttService,
    private accessTokenService: TokenService,
    private refreshTokenService: TokenService
  ) { }

  async sendRefreshRequest(): Promise<string> {

    console.log('TokenRequestor.sendRefreshRequest');
    return new Promise((resolve, reject) => {

      // Get the configuration
      this.configService.getConfig()
        .then((config) => {

          if (config.reconnectPeriod != undefined) {
            this.refreshIntervalMs = config.reconnectPeriod;
          }

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

      let obj;
      try {
        obj = ReplyHandler.getBufferAsObject(payload)
      } catch (err) {
        reject(`Failed to parse message: ${err}`);
        return;
      }

      if (!isRequestTokenReply(obj)) {
        reject(getUnexpectedReplyMessage(obj));
        return;
      }

      const reply = obj as RequestTokenReply;
      console.log("Re-setting access token");
      this.accessTokenService.setToken(reply.token);
      resolve(reply.token);
    }

    // The MQTT subscribe options
    const subscribeOptions: any = {
      qos: 1
    };

    // Step 1: Subscribe to reply topic
    client.subscribe(replyTopic, subscribeOptions, (err) => {
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

      client.publish('request', JSON.stringify(payload), publishOptions, (err) => {
        if (err) {
          client.removeListener('message', messageHandler);
          reject(`Publish failed: ${err.message}`);
        }
      })
    })
  }


  start(): void {
    this.stop()  // Prevent other duplicate

    this.refreshSub = interval(this.refreshIntervalMs)
      .pipe(
        switchMap(() => from(this.sendRefreshRequest())),
        catchError(err => {
          console.error('Token refresh failed:', err);
          return EMPTY;
        })
      )
      .subscribe(newToken => { });
  }

  stop(): void {
    this.refreshSub?.unsubscribe();
  }
}

