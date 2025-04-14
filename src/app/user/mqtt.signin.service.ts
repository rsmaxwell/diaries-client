import { Injectable } from '@angular/core';
import { v4 as uuidv4 } from 'uuid';
import { Buffer } from 'buffer';
import { Signin } from '../model/signin';
import { MqttService } from '../mqtt/mqtt.service';
import { Connection } from '../model/connection';
import { AuthorisedConnection } from '../model/authorisedConnection';
import { TokenRequestor } from './tokenRequestor';
import { catchError, interval, Subscription, switchMap } from 'rxjs';
import { ReplyHandler } from '../utilities/replyHandler';
import { Reply, SigninReply } from '../utilities/reply';
import { Router } from '@angular/router';
import { AlertService } from '../alerts/alert.service';


@Injectable({ providedIn: 'root' })
export class MqttSigninService {

  authorisedConnection!: AuthorisedConnection;

  private tokenRequestor!: TokenRequestor;
  private refreshInterval$!: Subscription;

  constructor(
    private mqttService: MqttService,
    private router: Router,
    private alertService: AlertService
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

      let {reply, reason} = ReplyHandler.getReply(payload)
      if (reply == null) {
        reject(reason);
        return
      }

      console.log(`MqttSigninService.signin.connected: result: ${JSON.stringify(reply)}`);

      if (!isSigninReply(reply)) {
        console.log(`MqttSigninService.processSigninReply: Invalid SigninReply structure`);
        reject(`Unexpected reply`);
        return;
      }
      let signinReply: SigninReply = reply;

      this.processSigninReply(connection, signin, signinReply, resolve, reject);
    })
  }





  private processSigninReply(connection: Connection, signin: Signin, signinReply: SigninReply, resolve: (value: number) => void, reject: (reason?: any) => void) {
    console.log(`MqttSigninService.processSigninReply`);


    this.authorisedConnection = new AuthorisedConnection(connection, signinReply.accessToken, signinReply.refreshToken, signinReply.refreshPeriod, signin, signinReply.id)
    console.log(`MqttSigninService.processSigninReply: username: userId: ${signinReply.id}, username: ${signin.username}, refreshPeriod: ${signinReply.refreshPeriod}`)
    resolve(signinReply.id)

    console.log(`MqttSigninService.processSigninReply: Starting TokenRequestor`)
    this.tokenRequestor = new TokenRequestor(this.authorisedConnection)

    this.tokenRequestor.getUpdates().subscribe({
      next: token => {
        // console.log(`MqttSigninService.processSigninReply: getUpdates.subscribe --> next: token: ${token}`)
        this.authorisedConnection.accessToken = token
      },
      error: err => {
        console.log(`MqttSigninService.processSigninReply: getUpdates.subscribe --> error: ${err}`)
        this.stopTokenRefresh(); // Stop the refresh interval on error

        this.alertService.error("Token expired. Please signin again")

        // ✅ Navigate back to SigninComponent
        this.router.navigate(['/signin']).then(() => {
        console.log('Navigated back to SigninComponent due to token error.');
    });
      },
      complete: () => console.log(`MqttSigninService.processSigninReply: getUpdates.subscribe --> complete`)
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


function isSigninReply(obj: any): obj is SigninReply {
  return obj !== null &&
         typeof obj === 'object' &&
         'accessToken' in obj && typeof obj.accessToken === 'string' &&
         'refreshToken' in obj && typeof obj.refreshToken === 'string' &&
         'refreshPeriod' in obj && typeof obj.refreshPeriod === 'number' &&
         'id' in obj && typeof obj.id === 'number';
}

