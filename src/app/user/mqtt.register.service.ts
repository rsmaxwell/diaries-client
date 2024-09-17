import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import * as mqtt from 'mqtt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../model/user';
import { Register } from '../model/register';
import { Buffer } from 'buffer';
import { Signin } from '../model/signin';
import { MqttService } from '../mqtt.service';

class RegisterResponse {
  message!: string;
}

export class MqttRegisterService {

  private mqttService: MqttService;

  private id: Number = 0;
  private userSubject = new Subject<any>();
  private userObservable = this.userSubject.asObservable();

  constructor(mqttService: MqttService) {
    console.log("MqttRegisterService.constructor");
    this.mqttService = mqttService
  }


  register(register: Register): Observable<User> {
    console.log(`MqttRegisterService.register`);
    const replyTopic = `reply/${this.mqttService.getClientID()}/register`;
    let myuuid = uuidv4();

    console.log(`MqttRegisterService.register: subscribing to topic: ${replyTopic}`);
    this.mqttService.getClient().subscribeAsync(replyTopic)
      .then((granted) => {
        console.log(`MqttRegisterService.register: subscribed: ${ JSON.stringify(granted) }`);
        let request = { function: 'register', args: register };

        var publishOptions: any = {
          qos: 0,
          retain: false,
          properties: {
            responseTopic: replyTopic,
            correlationData: Buffer.from(myuuid, 'utf-8'),
          }
        };

        console.log(`MqttRegisterService.register: subscribed: publishing request: ${JSON.stringify(request)}`);
        this.mqttService.getClient().publishAsync('request', JSON.stringify(request), publishOptions)
          .then(() => {
            console.log('MqttRegisterService.register: publish request succeeded');
          })
          .catch((error) => {
            console.error('MqttRegisterService.register: error publishing: ' + error.message);
          });
      })
      .catch((error) => {
        console.error('MqttRegisterService.register: error subscribing: ' + error.message);
      });

    this.mqttService.getClient().on('message', (topic, message) => {
      console.log(`MqttRegisterService.register: on message: topic: ${topic}, message: ${message}`);

      if (topic === replyTopic) {
        var obj = JSON.parse(message.toString());

        if (obj.hasOwnProperty('code')) {
          let code = obj['code'];
          if (typeof code !== "number") {
            console.log(`MqttRegisterService.register: Unexpected reply`);
            this.userSubject.error(`Unexpected reply`);
            return;
          }

          if (code !== 200) {
            if (obj.hasOwnProperty('message')) {
              let errorMessage = obj['message'];
              this.userSubject.error(errorMessage);
            }
            else {
              console.log(`MqttRegisterService.register: Missing 'message'`);
              this.userSubject.error(`Unexpected reply: ${code}`);
            }
            return;
          }
        }
        else {
          console.log(`MqttRegisterService.register: Missing 'code'`);
          this.userSubject.error(`Unexpected reply`);
        }

        if (obj.hasOwnProperty('result')) {
          this.id = obj['result'];
          console.log(`MqttRegisterService.register: onMessage: result: ${JSON.stringify(this.id)}`);
          this.userSubject.next(this.id);
        }
        else {
          console.log(`MqttRegisterService.register: Missing 'result'`);
          this.userSubject.error(`Unexpected reply`);
        }

        this.mqttService.getClient().unsubscribeAsync(replyTopic)
        .then(() => {
          console.log(`MqttRegisterService.register: unsubscribeAsync from '${replyTopic}' succeeded`);
        })
        .catch((error) => {
          console.error('MqttRegisterService.sigregisternin: unsubscribeAsync failed: ' + error.message);
        });
      }
    })

    return this.userObservable;
  }
}
