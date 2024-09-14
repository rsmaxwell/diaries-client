import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import * as mqtt from 'mqtt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../model/user';
import { Register } from '../model/register';
import { Buffer } from 'buffer';
import { Signin } from '../model/signin';

class SigninResponse {
  accessToken!: string;
  refreshDelta!: number;
}

class RefreshTokenResponse {
  accessToken!: string;
}

class RegisterResponse {
  message!: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private mqttClient!: mqtt.MqttClient;
  private clientID!: string;

  private id: Number = 0;
  private userSubject = new Subject<any>();
  private userObservable = this.userSubject.asObservable();

  private username: any;
  private accessToken: any;
  private refreshToken: any;
  private refreshDelta: any;

  constructor() {
    console.log("UserService.constructor");
  }

  initialize(mqttClient: mqtt.MqttClient, clientID: string) {
    console.log(`UserService.initialize`);
    this.mqttClient = mqttClient;
    this.clientID = clientID;
  }



  signin(signin: Signin): Observable<User> {
    console.log(`UserService.signin`);
    const replyTopic = `reply/${this.clientID}/signin`;
    let myuuid = uuidv4();

    console.log(`UserService.signin: subscribing to topic: ${replyTopic}`);
    this.mqttClient.subscribeAsync(replyTopic)
      .then((granted) => {
        console.log(`UserService.signin: subscribed`);
        let request = { function: 'signin', args: signin };

        var publishOptions: any = {
          qos: 0,
          retain: false,
          properties: {
            responseTopic: replyTopic,
            correlationData: Buffer.from(myuuid, 'utf-8'),
          }
        };

        console.log(`UserService.signin: subscribed: publishing request: ${JSON.stringify(request)}`);
        this.mqttClient.publishAsync('request', JSON.stringify(request), publishOptions)
          .then(() => {
            console.log('UserService.signin: publish request succeeded');
          })
          .catch((error) => {
            console.error('UserService.signin: error publishing: ' + error.message);
          });
      })
      .catch((error) => {
        console.error('UserService.signin: error subscribing: ' + error.message);
      });

      this.mqttClient.on('message', (topic, message) => {
        console.log(`UserService.signin: on message: topic: ${topic}, message: ${message}`);
  
        if (topic === replyTopic) {
          var obj = JSON.parse(message.toString());
  
          if (obj.hasOwnProperty('code')) {
            let code = obj['code'];
            if (typeof code !== "number") {
              console.log(`UserService.signin: Unexpected reply`);
              this.userSubject.error(`Unexpected reply`);
              return;
            }
  
            if (code !== 200) {
              if (obj.hasOwnProperty('message')) {
                let errorMessage = obj['message'];
                this.userSubject.error(errorMessage);
              }
              else {
                console.log(`UserService.signin: Missing 'message'`);
                this.userSubject.error(`Unexpected reply: ${code}`);
              }
              return;
            }
          }
          else {
            console.log(`UserService.signin: Missing 'code'`);
            this.userSubject.error(`Unexpected reply`);
          }
  
          if (!obj.hasOwnProperty('accessToken')) {
            console.log(`UserService.signin: Missing 'accessToken'`);
            this.userSubject.error(`Unexpected reply`);
            return;
          }
  
          if (!obj.hasOwnProperty('refreshToken')) {
            console.log(`UserService.signin: Missing 'refreshToken'`);
            this.userSubject.error(`Unexpected reply`);
            return;
          }
  
          if (!obj.hasOwnProperty('refreshDelta')) {
            console.log(`UserService.signin: Missing 'refreshDelta'`);
            this.userSubject.error(`Unexpected reply`);
            return;
          }
  
          if (!obj.hasOwnProperty('id')) {
            console.log(`UserService.signin: Missing 'id'`);
            this.userSubject.error(`Unexpected reply`);
            return;
          }

          this.accessToken = obj['accessToken'];
          this.refreshToken = obj['refreshToken'];
          this.refreshDelta = obj['refreshDelta'];
          this.id = obj['id'];
          console.log(`UserService.signin: onMessage: accessToken: ${this.accessToken}`);
          console.log(`UserService.signin: onMessage: refreshToken: ${this.refreshToken}`);
          console.log(`UserService.signin: onMessage: refreshDelta: ${this.refreshDelta}`);
          console.log(`UserService.signin: onMessage: id: ${this.id}`);
          this.userSubject.next(this.id);

          this.startRefreshTokenTimer()          
        }
      })
  
      return this.userObservable;
    }



  register(register: Register): Observable<User> {
    console.log(`UserService.register`);
    const replyTopic = `reply/${this.clientID}/register`;
    let myuuid = uuidv4();

    console.log(`UserService.register: subscribing to topic: ${replyTopic}`);
    this.mqttClient.subscribeAsync(replyTopic)
      .then((granted) => {
        console.log(`UserService.register: subscribed`);
        let request = { function: 'register', args: register };

        var publishOptions: any = {
          qos: 0,
          retain: false,
          properties: {
            responseTopic: replyTopic,
            correlationData: Buffer.from(myuuid, 'utf-8'),
          }
        };

        console.log(`UserService.register: subscribed: publishing request: ${JSON.stringify(request)}`);
        this.mqttClient.publishAsync('request', JSON.stringify(request), publishOptions)
          .then(() => {
            console.log('UserService.register: publish request succeeded');
          })
          .catch((error) => {
            console.error('UserService.register: error publishing: ' + error.message);
          });
      })
      .catch((error) => {
        console.error('UserService.register: error subscribing: ' + error.message);
      });

    this.mqttClient.on('message', (topic, message) => {
      console.log(`UserService.register: on message: topic: ${topic}, message: ${message}`);

      if (topic === replyTopic) {
        var obj = JSON.parse(message.toString());

        if (obj.hasOwnProperty('code')) {
          let code = obj['code'];
          if (typeof code !== "number") {
            console.log(`UserService.register: Unexpected reply`);
            this.userSubject.error(`Unexpected reply`);
            return;
          }

          if (code !== 200) {
            if (obj.hasOwnProperty('message')) {
              let errorMessage = obj['message'];
              this.userSubject.error(errorMessage);
            }
            else {
              console.log(`UserService.register: Missing 'message'`);
              this.userSubject.error(`Unexpected reply: ${code}`);
            }
            return;
          }
        }
        else {
          console.log(`UserService.register: Missing 'code'`);
          this.userSubject.error(`Unexpected reply`);
        }

        if (obj.hasOwnProperty('result')) {
          this.id = obj['result'];
          console.log(`UserService.register: onMessage: result: ${JSON.stringify(this.id)}`);
          this.userSubject.next(this.id);
        }
        else {
          console.log(`UserService.register: Missing 'result'`);
          this.userSubject.error(`Unexpected reply`);
        }
      }
    })

    return this.userObservable;
  }

  private timerID!: number;

  public startRefreshTokenTimer() {

    console.log("UserService.startRefreshTokenTimer(): accessToken: " + this.accessToken)

    const jwtToken = JSON.parse(atob(this.accessToken.split('.')[1]));
    const expires = new Date(jwtToken.exp * 1000);
    const timeout = expires.getTime() - Date.now() - (this.refreshDelta * 1000);

    if (timeout < 0) {
      console.log("UserService.startRefreshTokenTimer(): timeout: *** EXPIRED ***")
    }
    else {
      console.log("UserService.startRefreshTokenTimer(): timeout: " + timeout / 1000 + " seconds")

      window.clearTimeout(this.timerID)

      this.timerID = window.setTimeout(
        () => {
          this.refreshToken
        }, timeout);
    }
  }
}
