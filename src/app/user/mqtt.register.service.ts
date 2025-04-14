
import { v4 as uuidv4 } from 'uuid';
import { Register } from '../model/register';
import { Buffer } from 'buffer';
import { MqttService } from '../mqtt/mqtt.service';
import { ReplyHandler } from '../utilities/replyHandler';
import { Injectable } from '@angular/core';
import { Connection } from '../model/connection';
import { RegisterReply, Reply } from '../utilities/reply';


@Injectable({ providedIn: 'root' })
export class MqttRegisterService {

  constructor(
    private mqttService: MqttService
  ) { }

  register(register: Register): Promise<number> {
    console.log(`MqttRegisterService.register`);

    let promise: Promise<number> = new Promise((resolve, reject) => {

      this.mqttService.getConnection()
        .then((connection) => {
          this.connected(connection, register, resolve, reject)
        })
        .catch((err) => { `MqttRegisterService.register: ${err}` })
    })

    return promise
  }


  connected(connection: Connection, register: Register, resolve: (value: number) => void, reject: (reason?: any) => void) {
    console.log(`MqttRegisterService.register.connected`);

    const replyTopic = `reply/${connection.clientId}/register`;
    let myuuid = uuidv4();

    console.log(`MqttRegisterService.register.connected: subscribing to topic: ${replyTopic}`);
    connection.client.subscribeAsync(replyTopic)
      .then(() => {
        console.log(`MqttRegisterService.register.connected: subscribed`);

        let request = { function: 'register', args: register };

        var publishOptions: any = {
          qos: 0,
          retain: false,
          properties: {
            responseTopic: replyTopic,
            correlationData: Buffer.from(myuuid, 'utf-8'),
          }
        };

        console.log(`MqttRegisterService.register.connected: subscribed: publishing request: ${JSON.stringify(request)}`);
        connection.client.publishAsync('request', JSON.stringify(request), publishOptions)
          .then(() => {
            console.log('MqttRegisterService.register.connected: publish request succeeded');
          })
          .catch((error) => {
            console.error('MqttRegisterService.register.connected: error publishing: ' + error.message);
          });
      })
      .catch((error) => {
        console.error('MqttRegisterService.register: error subscribing: ' + error.message);
      });

    connection.client.on('message', (topic, payload, packet) => {

      if (topic != replyTopic) {
        return
      }

      var correlationString: string | null = null

      if (packet.properties != null) {
        var correlationData = packet.properties.correlationData;
        if (correlationData != undefined) {
          correlationString = correlationData.toString();
          console.log(`MqttSigninService.register.connected: correlationString: ${correlationString}`);
          console.log(`MqttSigninService.register.connected: myuuid:            ${myuuid}`);
        }
      }

      let {reply, reason} = ReplyHandler.getReply(payload)
      if (reply == null) {
        reject(reason);
        return
      }

      console.log(`MqttSigninService.register.connected: result: ${JSON.stringify(reply)}`);

      if (!isRegisterReply(reply)) {
        console.log(`MqttRegisterService.processRegisterReply: Invalid RegisterReply structure`);
        reject(`Unexpected reply`);
        return;
      }
      let registerReply: RegisterReply = reply;

      processRegisterReply(connection, register, registerReply, resolve, reject);
    })
  }
}

function processRegisterReply(connection: Connection, register: Register, registerReply: RegisterReply, resolve: (value: number) => void, reject: (reason?: any) => void) {
  console.log(`MqttSigninService.processSigninReply`);

  if (isNaN(registerReply.id)) {
    let reason = `MqttSigninService.register.connected: reply is NaN: ${registerReply.id}`
    console.log(reason);
    reject(reason)
  } else {
    resolve(registerReply.id)
  }
  return
}

function isRegisterReply(obj: any): obj is RegisterReply {
  return obj !== null &&
         typeof obj === 'object' &&
         'id' in obj && typeof obj.id === 'string';
}
