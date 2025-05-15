import { Injectable } from '@angular/core';
import { Page } from '../page/page';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import { AddFragmentRequest } from '../model/fragment/fragment';
import { MqttService } from '../mqtt/mqtt.service';
import { ReplyHandler } from '../utilities/replyHandler';
import { ConfigService } from '../config/config.service';
import { AccessTokenService } from '../user/token/AccessTokenService';
import { Rectangle } from '../utilities/rectangle';
import mqtt from 'mqtt';
import { checkReplyStatus, isStatus, Status } from '../utilities/reply';
import { HttpStatusCode } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class FragmentServiceAdd {

  constructor(
    private mqttService: MqttService,
    private configService: ConfigService,
    private accessTokenService: AccessTokenService
  ) { }

  addFragment(page: Page, rectangle: Rectangle): Promise<number> {
    console.log('FragmentServiceAdd: addFragment() called');

    return new Promise(async (resolve, reject) => {
      try {
        const [config, client, accessToken] = await Promise.all([
          this.configService.getConfig(),
          this.mqttService.getConnection(),
          this.accessTokenService.getToken()
        ]);

        const correlationId = uuidv4();
        const replyTopic = `reply/${config.clientId}/addFragment`;

        const timeoutHandle = setTimeout(() => {
          reject('FragmentServiceAdd: Timeout waiting for response');
          cleanup();
        }, 5000);

        const cleanup = () => {
          console.log(`FragmentServiceAdd: cleanup() called`);
          client.removeListener('message', messageHandler);
          clearTimeout(timeoutHandle);
        };

        const messageHandler = (topic: string, payload: Buffer, packet: any): void => {
          if (topic !== replyTopic) return;

          const props = packet.properties;
          const incomingCorrelation = props?.correlationData?.toString();
          if (incomingCorrelation !== correlationId) return;

          // We found our reply, so we can stop listening
          console.log(`FragmentServiceAdd: received our reply, so we can stop listening`);
          cleanup();

          try {
            const status = JSON.parse(props.userProperties.status) as Status;
            if (status.code != HttpStatusCode.Ok) {
              reject(`Bad reply status: ${status.code}: ${status.message}`);
              return;
            }
          } catch (err) {
            reject(`Failed to parse status: ${err}`);
            console.log(`FragmentServiceAdd: Failed to parse status: ${props.userProperties.status}`);
            return;
          }

          console.log(`FragmentServiceAdd: Reply payload: ${payload.toString()}`);

          let reply;
          try {
            reply = ReplyHandler.getBufferAsNumber(payload);
          } catch (err) {
            console.error(`FragmentServiceAdd: failed to parse payload: ${err}`);
            console.log(`FragmentServiceAdd: reply: ${payload.toString()}`);
            reject(`FragmentServiceAdd: Failed to parse reply: ${err}`);
            return;
          }

          resolve(reply);
        };

        // Subscribe to reply topic
        try {
          client.subscribe(replyTopic, { qos: 1 }, (err) => {
            if (err) {
              cleanup();
              console.error(`FragmentServiceAdd: Subscription failed: ${err}`);
              reject(`FragmentServiceAdd: Subscription failed: ${err}`);
              return;
            }

            console.log(`FragmentServiceAdd: Subscribed to ${replyTopic}, awaiting reply with correlationId: ${correlationId}`);
            client.on('message', messageHandler);

            // Publish request
            const payload = {
              function: 'addfragment',
              args: new AddFragmentRequest(page.id, rectangle)
            };

            let payloadJson: string;
            try {
              payloadJson = JSON.stringify(payload);
            } catch (err) {
              cleanup();
              console.error('FragmentServiceAdd: Failed to serialize payload:', err);
              reject(`FragmentServiceAdd: Payload serialization failed: ${err}`);
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

            console.log(`FragmentServiceAdd: Publishing to request: ${payloadJson}`);
            client.publish('request', payloadJson, publishOptions, (err) => {
              if (err) {
                cleanup();
                console.error('FragmentServiceAdd: Publish failed:', err);
                reject(`FragmentServiceAdd: Publish failed: ${err.message}`);
              }
            });
          });
        } catch (err) {
          cleanup();
          console.error('FragmentServiceAdd: Subscription threw an error:', err);
          reject(`FragmentServiceAdd: Subscription error: ${err}`);
        }
      } catch (err) {
        console.error('FragmentServiceAdd: Unexpected error:', err);
        reject(`FragmentServiceAdd: Internal error: ${err}`);
      }
    });
  }
}