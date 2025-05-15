import { Injectable } from '@angular/core';
import { Page } from '../page/page';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import { AddMarqueeRequest } from '../model/marquee/marquee';
import { MqttService } from '../mqtt/mqtt.service';
import { ReplyHandler } from '../utilities/replyHandler';
import { ConfigService } from '../config/config.service';
import { AccessTokenService } from '../user/token/AccessTokenService';
import { Rectangle } from '../utilities/rectangle';
import mqtt from 'mqtt';
import { Status } from '../utilities/reply';
import { HttpStatusCode } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class MarqueeServiceAdd {

  constructor(
    private mqttService: MqttService,
    private configService: ConfigService,
    private accessTokenService: AccessTokenService
  ) { }

  addMarquee(page: Page, rectangle: Rectangle): Promise<number> {
    console.log('MarqueeServiceAdd: addMarquee() called');

    return new Promise(async (resolve, reject) => {
      try {
        const [config, client, accessToken] = await Promise.all([
          this.configService.getConfig(),
          this.mqttService.getConnection(),
          this.accessTokenService.getToken()
        ]);

        const correlationId = uuidv4();
        const replyTopic = `reply/${config.clientId}/addMarquee`;

        const timeoutHandle = setTimeout(() => {
          reject('MarqueeServiceAdd: Timeout waiting for response');
          cleanup();
        }, 5000);

        const cleanup = () => {
          console.log(`MarqueeServiceAdd: cleanup() called`);
          client.removeListener('message', messageHandler);
          clearTimeout(timeoutHandle);
        };

        const messageHandler = (topic: string, payload: Buffer, packet: any): void => {
          if (topic !== replyTopic) return;

          const props = packet.properties;
          const incomingCorrelation = props?.correlationData?.toString();
          if (incomingCorrelation !== correlationId) return;

          // We found our reply, so we can stop listening
          console.log(`MarqueeServiceAdd: received our reply, so we can stop listening`);
          cleanup();

          try {
            const status = JSON.parse(props.userProperties.status) as Status;
            if (status.code != HttpStatusCode.Ok) {
              reject(`Bad reply status: ${status.code}: ${status.message}`);
              return;
            }
          } catch (err) {
            reject(`Failed to parse status: ${err}`);
            console.log(`MarqueeServiceAdd: Failed to parse status: ${props.userProperties.status}`);
            return;
          }

          console.log(`MarqueeServiceAdd: Reply payload: ${payload.toString()}`);

          let reply;
          try {
            reply = ReplyHandler.getBufferAsNumber(payload);
          } catch (err) {
            console.error(`MarqueeServiceAdd: failed to parse payload: ${err}`);
            console.log(`MarqueeServiceAdd: reply: ${payload.toString()}`);
            reject(`MarqueeServiceAdd: Failed to parse reply: ${err}`);
            return;
          }

          resolve(reply);
        };

        // Subscribe to reply topic
        try {
          client.subscribe(replyTopic, { qos: 1 }, (err) => {
            if (err) {
              cleanup();
              console.error(`MarqueeServiceAdd: Subscription failed: ${err}`);
              reject(`MarqueeServiceAdd: Subscription failed: ${err}`);
              return;
            }

            console.log(`MarqueeServiceAdd: Subscribed to ${replyTopic}, awaiting reply with correlationId: ${correlationId}`);
            client.on('message', messageHandler);

            // Publish request
            const payload = {
              function: 'addMarquee',
              args: new AddMarqueeRequest(page.id, rectangle)
            };

            let payloadJson: string;
            try {
              payloadJson = JSON.stringify(payload);
            } catch (err) {
              cleanup();
              console.error('MarqueeServiceAdd: Failed to serialize payload:', err);
              reject(`MarqueeServiceAdd: Payload serialization failed: ${err}`);
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

            console.log(`MarqueeServiceAdd: Publishing to request: ${payloadJson}`);
            client.publish('request', payloadJson, publishOptions, (err) => {
              if (err) {
                cleanup();
                console.error('MarqueeServiceAdd: Publish failed:', err);
                reject(`MarqueeServiceAdd: Publish failed: ${err.message}`);
              }
            });
          });
        } catch (err) {
          cleanup();
          console.error('MarqueeServiceAdd: Subscription threw an error:', err);
          reject(`MarqueeServiceAdd: Subscription error: ${err}`);
        }
      } catch (err) {
        console.error('MarqueeServiceAdd: Unexpected error:', err);
        reject(`MarqueeServiceAdd: Internal error: ${err}`);
      }
    });
  }
}