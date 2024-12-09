
import { v4 as uuidv4 } from 'uuid';
import { Register } from '../model/register';
import { Buffer } from 'buffer';
import { MqttService } from '../mqtt.service';
import { ReplyHandler } from '../utilities/replyHandler';
import { Injectable } from '@angular/core';
import { Connection } from '../model/connection';
import { Reply } from '../utilities/reply';


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
      console.log(`MqttRegisterService.register.connected: on message: topic: ${topic}`);
      console.log(`MqttRegisterService.register.connected: on message: payload: ${payload}`);

      var correlationString: string | null = null

      if (packet.properties != null) {
        var correlationData = packet.properties.correlationData;
        if (correlationData != undefined) {
          correlationString = correlationData.toString();
          console.log(`MqttSigninService.register.connected: correlationString: ${correlationString}`);
          console.log(`MqttSigninService.register.connected: myuuid:            ${myuuid}`);
        }
      }


      if (topic === replyTopic) {
        let result = ReplyHandler.parsePayload(payload)
        if (result == null) {
          return 
        } 

        let reply = (result as Reply)
        console.log(`MqttSigninService.register.connected: result: ${JSON.stringify(reply)}`);

        if (ReplyHandler.isGoodReply(reply)) {
          var id: number = Number(reply.result)

          if (isNaN(id)) {
            let message = `MqttSigninService.register.connected: reply is NaN: ${reply.result}`
            console.log(message);
            reject(message)
          } else {
            resolve(id)
          }
        }
        else {
          reject(ReplyHandler.getMessage(reply))
        }
      }
    })

  }
}
