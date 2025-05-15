import { Injectable } from '@angular/core';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import { Marquee, UpdateFragmentRequest } from '../model/fragment/fragment';
import { MqttService } from '../mqtt/mqtt.service';
import { ReplyHandler } from '../utilities/replyHandler';
import mqtt from 'mqtt';
import { ConfigService } from '../config/config.service';
import { AccessTokenService } from '../user/token/AccessTokenService';
import { isStatus, Status } from '../utilities/reply';
import { HttpStatusCode } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class FragmentServiceUpdate {

  constructor(
    private mqttService: MqttService,
    private configService: ConfigService,
    private accessTokenService: AccessTokenService
  ) { }

  updateFragment(marquee: Marquee): Promise<string> {
    console.log('FragmentServiceUpdate: updateFragment() called');

    return new Promise(async (resolve, reject) => {
      try {
        const [config, client, accessToken] = await Promise.all([
          this.configService.getConfig(),
          this.mqttService.getConnection(),
          this.accessTokenService.getToken()
        ]);

        const correlationId = uuidv4();
        const replyTopic = `reply/${config.clientId}/updateFragment`;

        const timeoutHandle = setTimeout(() => {
          reject('Timeout waiting for response');
          cleanup();
        }, 5000);

        const cleanup = () => {
          console.log(`FragmentServiceDelete: cleanup() called`);
          client.removeListener('message', messageHandler);
          clearTimeout(timeoutHandle);
        };

        const messageHandler = (topic: string, payload: Buffer, packet: any): void => {
          console.log(`FragmentServiceUpdate: received reply for client: ${config.clientId}, topic: ${topic}, correlationId: ${correlationId}`);
          if (topic !== replyTopic) return;

          const props = packet.properties;
          const incomingCorrelation = props?.correlationData?.toString();
          if (incomingCorrelation !== correlationId) return;

          // We found our reply, so we can stop listening
          console.log(`FragmentServiceAdd: received our reply, so we can stop listening`);
          cleanup();

          const userProperties = props.userProperties;
          console.log(`FragmentServiceUpdate: Reply status: ${status}`);
          console.log(`FragmentServiceUpdate: Reply payload: ${payload.toString()}`);

          try {
            const status = JSON.parse(props.userProperties.status) as Status;
            if (status.code != HttpStatusCode.Ok) {
              reject(`Bad reply status: ${status.code}: ${status.message}`);
              return;
            }
          } catch (err) {
            reject(`Failed to parse status: ${err}`);
            console.log(`MqttSigninService: Failed to parse status: ${props.userProperties.status}`);
            return;
          }

          try {
            const reply = payload.toString();
            resolve(reply);
          } catch (err) {
            console.error(`FragmentServiceUpdate: failed to parse reply: ${err}`);
            console.log(`FragmentServiceUpdate: reply: ${payload.toString()}`);
            reject(`Failed to parse reply: ${err}`);
          }
        };

        // Subscribe to reply topic
        try {
          client.subscribe(replyTopic, { qos: 1 }, (err) => {
            if (err) {
              cleanup();
              console.error(`FragmentServiceUpdate: Subscription failed: ${err}`);
              reject(`Subscription failed: ${err}`);
              return;
            }

            console.log(`FragmentServiceUpdate: Subscribed to ${replyTopic}, awaiting reply with correlationId: ${correlationId}`);
            client.on('message', messageHandler);

            // Publish request
            const payload = {
              function: 'updatefragment',
              args: new UpdateFragmentRequest(marquee)
            };

            let payloadJson: string;
            try {
              payloadJson = JSON.stringify(payload);
            } catch (err) {
              cleanup();
              console.error('FragmentServiceUpdate: Failed to serialize payload:', err);
              reject(`Payload serialization failed: ${err}`);
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

            console.log(`FragmentServiceUpdate: Publishing to request: ${payloadJson}`);
            client.publish('request', payloadJson, publishOptions, (err) => {
              if (err) {
                cleanup();
                console.error('FragmentServiceUpdate: Publish failed:', err);
                reject(`Publish failed: ${err.message}`);
              }
            });
          });
        } catch (err) {
          cleanup();
          console.error('FragmentServiceUpdate: Subscription threw an error:', err);
          reject(`Subscription error: ${err}`);
        }
      } catch (err) {
        console.error('FragmentServiceUpdate: Unexpected error:', err);
        reject(`Internal error: ${err}`);
      }
    });
  }
}
