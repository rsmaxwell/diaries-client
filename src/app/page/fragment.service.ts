import { Injectable } from '@angular/core';
import { Page } from './page';
import { Subject } from 'rxjs';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import { Fragment, AddFragmentRequest } from '../model/fragment/fragment';
import { MqttService } from '../mqtt/mqtt.service';
import { Router } from '@angular/router';
import { AlertService } from '../alerts/alert.service';
import { Diary } from '../diary/diary';
import { AddFragmentReply, getUnexpectedReplyMessage, isAddFragmentReply } from '../utilities/reply';
import { ReplyHandler } from '../utilities/replyHandler';
import mqtt from 'mqtt';
import { Config, ConfigService } from '../config/config.service';
import { TokenService } from '../user/tokenService';




@Injectable({
  providedIn: 'root'
})
export class FragmentService {

  private fragments: Fragment[] = [];
  private fragmentsSubject = new Subject<Fragment[]>();
  private fragmentsObservable = this.fragmentsSubject.asObservable();



  constructor(
    private configService: ConfigService,
    private mqttService: MqttService,
    private accessTokenService: TokenService,
    private router: Router,
    private alertService: AlertService
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

      let obj;
      try {
        obj = ReplyHandler.getBufferAsObject(payload)
      } catch (err) {
        reject(`Failed to parse message: ${err}`);
        return;
      }

      if (!isAddFragmentReply(obj)) {
        reject(getUnexpectedReplyMessage(obj));
        return;
      }

      const reply = obj as AddFragmentReply;
      resolve(reply.id)
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
      const payload = {
        function: 'addfragment',
        args: new AddFragmentRequest(
          page.id,
          fragment.x,
          fragment.y,
          fragment.width,
          fragment.height
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

      client.publish('request', JSON.stringify(payload), publishOptions, (err) => {
        if (err) {
          client.removeListener('message', messageHandler);
          reject(`Publish failed: ${err.message}`);
        }
      })
    })
  }
}
