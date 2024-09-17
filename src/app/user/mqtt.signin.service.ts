import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import * as mqtt from 'mqtt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../model/user';
import { Register } from '../model/register';
import { Buffer } from 'buffer';
import { Signin } from '../model/signin';
import { MqttService } from '../mqtt.service';

class SigninResponse {
  accessToken!: string;
  refreshDelta!: number;
}

class RefreshTokenResponse {
  accessToken!: string;
}

export class MqttSigninService {

  private mqttService!: MqttService;

  private id: Number = 0;
  private userSubject = new Subject<any>();
  private userObservable = this.userSubject.asObservable();

  constructor(mqttService: MqttService) {
    console.log("MqttSigninService.constructor");
    this.mqttService = mqttService
  }

  signin(signin: Signin): Observable<User> {
    console.log(`MqttSigninService.signin`);
    const replyTopic = `reply/${this.mqttService.getClientID()}/signin`;
    let myuuid = uuidv4();

    console.log(`MqttSigninService.signin: subscribing to topic: ${replyTopic}`);
    this.mqttService.getClient().subscribeAsync(replyTopic)
      .then((granted) => {
        console.log(`MqttSigninService.signin: subscribed`);
        let request = { function: 'signin', args: signin };

        var publishOptions: any = {
          qos: 0,
          retain: false,
          properties: {
            responseTopic: replyTopic,
            correlationData: Buffer.from(myuuid, 'utf-8'),
          }
        };

        console.log(`MqttSigninService.signin: subscribed: publishing request: ${JSON.stringify(request)}`);
        this.mqttService.getClient().publishAsync('request', JSON.stringify(request), publishOptions)
          .then(() => {
            console.log('MqttSigninService.signin: publish request succeeded');
          })
          .catch((error) => {
            console.error('MqttSigninService.signin: error publishing: ' + error.message);
          });
      })
      .catch((error) => {
        console.error('MqttSigninService.signin: error subscribing: ' + error.message);
      });

    this.mqttService.getClient().on('message', (topic, message) => {
      console.log(`MqttSigninService.signin: on message: topic: ${topic}, message: ${message}`);

      if (topic === replyTopic) {
        var obj = JSON.parse(message.toString());

        if (obj.hasOwnProperty('code')) {
          let code = obj['code'];
          if (typeof code !== "number") {
            console.log(`MqttSigninService.signin: Unexpected reply`);
            this.userSubject.error(`Unexpected reply`);
            return;
          }

          if (code !== 200) {
            if (obj.hasOwnProperty('message')) {
              let errorMessage = obj['message'];
              this.userSubject.error(errorMessage);
            }
            else {
              console.log(`MqttSigninService.signin: Missing 'message'`);
              this.userSubject.error(`Unexpected reply: ${code}`);
            }
            return;
          }
        }
        else {
          console.log(`MqttSigninService.signin: Missing 'code'`);
          this.userSubject.error(`Unexpected reply`);
        }

        if (!obj.hasOwnProperty('accessToken')) {
          console.log(`MqttSigninService.signin: Missing 'accessToken'`);
          this.userSubject.error(`Unexpected reply`);
          return;
        }

        if (!obj.hasOwnProperty('refreshToken')) {
          console.log(`MqttSigninService.signin: Missing 'refreshToken'`);
          this.userSubject.error(`Unexpected reply`);
          return;
        }

        if (!obj.hasOwnProperty('refreshDelta')) {
          console.log(`MqttSigninService.signin: Missing 'refreshDelta'`);
          this.userSubject.error(`Unexpected reply`);
          return;
        }

        if (!obj.hasOwnProperty('id')) {
          console.log(`MqttSigninService.signin: Missing 'id'`);
          this.userSubject.error(`Unexpected reply`);
          return;
        }

        this.mqttService.setAccessToken(obj['accessToken']);
        this.mqttService.setRefreshToken(obj['refreshToken']);
        this.mqttService.setRefreshDelta(obj['refreshDelta']);
        this.id = obj['id'];
        console.log(`MqttSigninService.signin: onMessage: id: ${this.id}`);
        this.userSubject.next(this.id);

        this.mqttService.startRefreshTokenTimer()

        this.mqttService.getClient().unsubscribeAsync(replyTopic)
        .then(() => {
          console.log(`MqttSigninService.signin: unsubscribeAsync from '${replyTopic}' succeeded`);
        })
        .catch((error) => {
          console.error('MqttSigninService.signin: unsubscribeAsync failed: ' + error.message);
        });
      }
    })

    return this.userObservable;
  }
}
