import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { Buffer } from 'buffer';
import { Signin } from '../model/signin';
import { MqttService } from '../mqtt.service';
import { Connection } from '../model/connection';
import { AuthorisedConnection } from '../model/authorisedConnection';
import { TokenRequestor } from './tokenRequestor';
import { catchError, interval, Subscription, switchMap } from 'rxjs';


@Injectable({ providedIn: 'root' })
export class MqttSigninService {

  authorisedConnection!: AuthorisedConnection;

  private tokenRequestor!: TokenRequestor;
  private refreshInterval$!: Subscription;

  constructor(
    private mqttService: MqttService
  ) { }

  signin(signin: Signin): Promise<number> {
    console.log('MqttSigninService.signin');

    let promise: Promise<number> = new Promise((resolve, reject) => {

      this.mqttService.getConnection()
        .then((connection) => {
          this.connected(connection, signin, resolve, reject)
        })
        .catch((err) => { `MqttRegisterService.signin: ${err}` })
    })

    return promise
  }

  connected(connection: Connection, signin: Signin, resolve: (value: number) => void, reject: (reason?: any) => void) {
    console.log(`MqttSigninService.signin.connected`);

    const replyTopic = `reply/${connection.clientId}/signin`;
    let myuuid = uuidv4();

    console.log(`MqttSigninService.signin.connected: subscribing to topic: ${replyTopic}`);
    connection.client.subscribeAsync(replyTopic)
      .then(() => {
        console.log(`MqttSigninService.signin.connected: subscribed`);

        let request = { function: 'signin', args: signin };

        var publishOptions: any = {
          qos: 0,
          retain: false,
          properties: {
            responseTopic: replyTopic,
            correlationData: Buffer.from(myuuid, 'utf-8'),
          }
        };

        let requestString = JSON.stringify(request)
        console.log(`MqttSigninService.signin.connected: subscribed: publishing request: ${requestString}`);
        connection.client.publishAsync('request', requestString, publishOptions)
          .then((authorisedConnection) => {
            console.log('MqttSigninService.signin.connected: publish request succeeded');
          })
          .catch((error) => {
            console.error('MqttSigninService.signin.connected: error publishing: ' + error.message);
          });
      })
      .catch((error) => {
        console.error('MqttSigninService.signin.connected: error subscribing: ' + error.message);
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
          // console.log(`MqttSigninService.signin.connected: correlationString: ${correlationString}`);
          // console.log(`MqttSigninService.signin.connected: myuuid:            ${myuuid}`);
        }
      }

      if (correlationString == null) {
        reject(`MqttSigninService.signin.connected: Missing 'correlationData'`)
        return;
      }

      if (correlationString != myuuid) {
        return
      }

      this.processSigninReply(connection, signin, payload, resolve, reject)
    })

  }





  private processSigninReply(connection: Connection, signin: Signin, payload: Buffer, resolve: (value: number) => void, reject: (reason?: any) => void) {
    console.log(`MqttSigninService.processSigninReply: ${payload.toString()}`);
    var message = JSON.parse(payload.toString());

    if (message.hasOwnProperty('code')) {
      let code = message['code'];
      if (typeof code !== "number") {
        console.log(`MqttSigninService.processSigninReply: Unexpected typeof reply: ${typeof code}`);
        reject(`Unexpected reply`);
        return;
      }

      if (code !== 200) {
        if (message.hasOwnProperty('message')) {
          let errorMessage = message['message'];
          reject(errorMessage);
        }

        console.log(`MqttSigninService.processSigninReply: Missing 'message'`);
        reject(`Unexpected reply: ${code}`);
        return;
      }
    }
    else {
      console.log(`MqttSigninService.processSigninReply: Missing 'code'`);
      reject(`Unexpected reply`);
      return;
    }

    if (!message.hasOwnProperty('accessToken')) {
      console.log(`MqttSigninService.processSigninReply: Missing 'accessToken'`);
      reject(`Unexpected reply`);
      return;
    }

    if (!message.hasOwnProperty('refreshToken')) {
      console.log(`MqttSigninService.processSigninReply: Missing 'refreshToken'`);
      reject(`Unexpected reply`);
      return;
    }

    if (!message.hasOwnProperty('refreshPeriod')) {
      console.log(`MqttSigninService.processSigninReply: Missing 'refreshPeriod'`);
      reject(`Unexpected reply`);
      return;
    }

    if (!message.hasOwnProperty('id')) {
      console.log(`MqttSigninService.processSigninReply: Missing 'id'`);
      reject(`Unexpected reply`);
      return;
    }

    // console.log(`MqttSigninService.processSigninReply: onMessage`);
    // console.log(`MqttSigninService.processSigninReply: message: ${JSON.stringify(message)}`)

    let accessToken = message['accessToken'];
    let refreshToken = message['refreshToken'];
    let refreshPeriod = message['refreshPeriod'];
    let id = message['id'];
    this.authorisedConnection = new AuthorisedConnection(connection, accessToken, refreshToken, refreshPeriod, signin, id)
    console.log(`MqttSigninService.processSigninReply: username: userId: ${id}, username: ${signin.username}, refreshPeriod: ${refreshPeriod}`)
    resolve(id)

    console.log(`MqttSigninService.processSigninReply: Starting TokenRequestor`)
    this.tokenRequestor = new TokenRequestor(this.authorisedConnection)

    this.tokenRequestor.getUpdates().subscribe({
      next: token => {
        // console.log(`MqttSigninService.requestNewTokenReply: next: token: ${token}`)
        this.authorisedConnection.accessToken = token
      },
      error: err => { 
        console.log(`MqttSigninService.requestNewTokenReply: error: ${err}`)
        this.stopTokenRefresh(); // Stop the refresh interval on error
      },
      complete: () =>  console.log(`MqttSigninService.requestNewTokenReply: complete`) 
    })

    this.startTokenRefresh();
  }

  startTokenRefresh(): void {
    let milliseconds = this.authorisedConnection.refreshPeriod * 1000
    this.refreshInterval$ = interval(milliseconds).pipe(
      // switchMap is used to switch to a new observable every RefreshPeriod seconds and call requestNewToken
      switchMap(() => this.tokenRequestor.requestNewToken().pipe(
        // Catch errors to stop the interval if the request fails
        catchError(err => {
          console.error(`MqttSigninService.requestNewToken failed: ${err}`);
          this.stopTokenRefresh(); // Stop the interval on error
          throw err;
        })
      ))
    ).subscribe({
      next: () => { 
        // console.log('Token refreshed successfully.')
       },
      error: err => console.error(`Error in token refresh subscription: ${err}`)
    });
  }

  stopTokenRefresh(): void {
    if (this.refreshInterval$) {
      this.refreshInterval$.unsubscribe();
      console.log('Token refresh stopped.');
    }
  }

  ngOnDestroy(): void {
    this.stopTokenRefresh(); // Clean up when the service is destroyed
  }
}
