import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { Buffer } from 'buffer';
import { Signin } from '../model/signin';
import { MqttService } from '../mqtt/mqtt.service';
import { getUnexpectedReplyMessage, isSigninReply, SigninReply } from '../utilities/reply';
import { Config, ConfigService } from '../config/config.service';
import mqtt from 'mqtt';
import { AccessTokenService } from './token/AccessTokenService';
import { RefreshTokenService } from './token/RefreshTokenService';
import { TokenRequestor } from './tokenRequestor';


@Injectable({ providedIn: 'root' })
export class MqttSigninService {

  constructor(
    private configService: ConfigService,
    private mqttService: MqttService,
    private accessTokenService: AccessTokenService,
    private refreshTokenService: RefreshTokenService,
    private tokenRequestor: TokenRequestor,
  ) { }


  async signin(signin: Signin): Promise<string> {
    console.log('MqttSigninService.signin');
    return new Promise((resolve, reject) => {

      // Get the configuration
      this.configService.getConfig()
        .then((config) => {

          // Get the MQTT connection
          this.mqttService.getConnection()
            .then((client) => {
              this.connected(client, config, signin, resolve, reject)
            })
            .catch(err => {
              reject(`Error getting the MQTT connection: ${err}`)
            })
        })
        .catch(err => {
          reject(`Error getting the configuration: ${err}`)
        })
    })
  }

  connected(client: mqtt.MqttClient, config: Config, signin: Signin, resolve: (value: string) => void, reject: (reason?: any) => void) {
    console.log(`MqttSigninService.signin.connected`);

    const correlationId = uuidv4();
    const replyTopic = `reply/${config.clientId}/signin`;

    const timeoutHandle = setTimeout(() => {
      client.removeListener('message', messageHandler);
      reject('Timeout waiting for response');
    }, 5000);

    const messageHandler = (topic: string, payload: Buffer, packet: any) => {
      console.log(`received reply for client: ${config.clientId}, topic: ${topic}, correlationId: ${correlationId}`);

      if (topic !== replyTopic) {
        return;
      }

      const props = packet.properties;
      const incomingCorrelation = props?.correlationData?.toString();
      if (incomingCorrelation !== correlationId) return;

      // We found our reply, so we can stop listening
      client.removeListener('message', messageHandler);
      clearTimeout(timeoutHandle);

      const userProperties = props.userProperties;
      const status = userProperties.status;

      console.log(`status: ${status}`);
      console.log(`payload: ${payload.toString()}`);

      let obj;
      try {
        const jsonString = payload.toString('utf-8');
        obj = JSON.parse(jsonString);
      } catch (err) {
        reject(`Failed to parse JSON payload: ${err}`);
        return;
      }

      if (!isSigninReply(obj)) {
        reject(getUnexpectedReplyMessage(obj));
        return;
      }

      const reply = obj as SigninReply;
      console.log(`MqttSigninService.signin.connected: username: userId: ${reply.id}, username: ${signin.username}, accessToken: ${reply.accessToken}`)

      console.log(`reply.accessToken: ${reply.accessToken}`);
      console.log(`reply.refreshToken: ${reply.refreshToken}`);
      console.log(`reply.refreshInterval: ${reply.refreshPeriod} seconds`);

      this.accessTokenService.setToken(reply.accessToken);
      this.refreshTokenService.setToken(reply.refreshToken);

      this.tokenRequestor.start(reply.refreshPeriod);

      resolve('ok');
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
      const payload = { function: 'signin', args: signin };

      // The MQTT publish options
      const publishOptions: any = {
        qos: 1,
        retain: false,
        properties: {
          responseTopic: replyTopic,
          correlationData: Buffer.from(correlationId, 'utf-8'),
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

