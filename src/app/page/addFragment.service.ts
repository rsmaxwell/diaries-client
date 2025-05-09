import { Injectable } from '@angular/core';
import { Page } from './page';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import { Fragment, AddFragmentRequest } from '../model/fragment/fragment';
import { MqttService } from '../mqtt/mqtt.service';
import { Diary } from '../diary/diary';
import { ReplyHandler } from '../utilities/replyHandler';
import mqtt from 'mqtt';
import { Config, ConfigService } from '../config/config.service';
import { AccessTokenService } from '../user/token/AccessTokenService';
import { RefreshTokenService } from '../user/token/RefreshTokenService';




@Injectable({
  providedIn: 'root'
})
export class AddFragmentService {

  constructor(
    private configService: ConfigService,
    private mqttService: MqttService,
    private accessTokenService: AccessTokenService,
    private refreshTokenService: RefreshTokenService
  ) { }

  addFragment(diary: Diary, page: Page, fragment: Fragment): Promise<number> {
    console.log('FragmentService.addFragment');
    return new Promise((resolve, reject) => {

      // Get the configuration
      this.configService.getConfig()
        .then((config) => {

          // Get the MQTT connection
          this.mqttService.getConnection()
            .then((client) => {
              this.connected(client, config, diary, page, fragment, resolve, reject);
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



  connected(client: mqtt.MqttClient, config: Config, diary: Diary, page: Page, fragment: Fragment, resolve: (value: number) => void, reject: (reason?: any) => void) {
    console.log(`FragmentService.addFragment.connected`);


    let correlationId = uuidv4();
    const replyTopic = `reply/${config.clientId}/addFragment`;

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

      const userProperties = props.userProperties;
      const status = userProperties.status;

      console.log(`status: ${status}`);
      console.log(`payload: ${payload.toString()}`);

      let obj;
      try {
        obj = ReplyHandler.getBufferAsObject(payload)
      } catch (err) {
        reject(`Failed to parse message: ${err}`);
        return;
      }

      if (!(obj !== null && typeof obj === 'number')) {
        reject(`Unexpected reply`);
        return;
      }

      const reply = obj as number;
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

      // Step 2: Publish request
      const payload = {
        function: 'addfragment',
        args: new AddFragmentRequest(
          page.id,
          fragment.x,
          fragment.y,
          fragment.width,
          fragment.height,
          fragment.text
        )
      };

      // The MQTT publish options
      var publishOptions: any = {
        qos: 0,
        retain: false,
        properties: {
          responseTopic: replyTopic,
          correlationData: Buffer.from(correlationId, 'utf-8'),
          userProperties: {
            accessToken: this.accessTokenService.getCurrentToken()
          }
        }
      };

      console.log(`FragmentService.addFragment.connected: diary: ${JSON.stringify(diary)}`);
      console.log(`FragmentService.addFragment.connected: page: ${JSON.stringify(page)}`);
      console.log(`FragmentService.addFragment.connected: payload: ${JSON.stringify(payload)}`);

      client.publish('request', JSON.stringify(payload), publishOptions, (err) => {
        if (err) {
          client.removeListener('message', messageHandler);
          reject(`Publish failed: ${err.message}`);
        }
      })
    })
  }
}
