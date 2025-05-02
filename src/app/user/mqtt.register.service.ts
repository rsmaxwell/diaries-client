
import { v4 as uuidv4 } from 'uuid';
import { Register } from '../model/register';
import { Buffer } from 'buffer';
import { MqttService } from '../mqtt/mqtt.service';
import { ReplyHandler } from '../utilities/replyHandler';
import { Injectable } from '@angular/core';
import { getUnexpectedReplyMessage, isRegisterReply, RegisterReply, Reply } from '../utilities/reply';
import { Config, ConfigService } from '../config/config.service';
import mqtt from 'mqtt';


@Injectable({ providedIn: 'root' })
export class MqttRegisterService {

  constructor(
    private configService: ConfigService,
    private mqttService: MqttService,
  ) { }

  register(register: Register): Promise<number> {
    console.log(`MqttRegisterService.register`);
    return new Promise((resolve, reject) => {

      // Get the configuration
      this.configService.getConfig()
        .then((config) => {

          // Get the MQTT connection
          this.mqttService.getConnection()
            .then((client) => {
              this.connected(client, config, register, resolve, reject)
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


  connected(client: mqtt.MqttClient, config: Config, register: Register, resolve: (value: number) => void, reject: (reason?: any) => void) {
    console.log(`MqttRegisterService.register.connected`);

    let correlationId = uuidv4();
    const replyTopic = `reply/${config.clientId}/register`;

    const timeoutHandle = setTimeout(() => {
      client.removeListener('message', messageHandler);
      reject('Timeout waiting for response');
    }, 5000);

    const messageHandler = (topic: string, payload: Buffer, packet: any) => {
      console.log(`MqttRegisterService.messageHandler: received reply for client: ${config.clientId}, topic: ${topic}, correlationId: ${correlationId}`);

      if (topic !== replyTopic) {
        return
      }

      const props = packet.properties;
      const incomingCorrelation = props?.correlationData?.toString();
      if (incomingCorrelation !== correlationId) return;

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

      if (!isRegisterReply(obj)) {
        reject(getUnexpectedReplyMessage(obj));
        return;
      }

      processRegisterReply(client, register, obj as RegisterReply, resolve, reject);
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
      const payload = { function: 'register', args: register };

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

function processRegisterReply(client: mqtt.MqttClient, register: Register, reply: RegisterReply, resolve: (value: number) => void, reject: (reason?: any) => void) {
  console.log(`MqttRegisterService.processRegisterReply`);

  if (isNaN(reply.id)) {
    let reason = `reply is NaN: ${reply.id}`
    console.log(reason);
    reject(reason)
  } else {
    resolve(reply.id)
  }
  return
}


