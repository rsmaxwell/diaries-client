
import { v4 as uuidv4 } from 'uuid';
import { Buffer } from 'buffer';
import { Refresh } from '../model/refresh';
import { AuthorisedConnection } from '../model/authorisedConnection';
import { Observable, Subject, Subscription } from 'rxjs';
import { IClientPublishOptions } from 'mqtt';

export class TokenRequestor {

  private authorisedConnection: AuthorisedConnection
  private replyTopic: string
  private myuuid: string = uuidv4();
  private subject = new Subject<string>();
  private observable: Observable<string> = this.subject.asObservable();

  constructor(authorisedConnection: AuthorisedConnection) {
    this.authorisedConnection = authorisedConnection
    this.replyTopic = `reply/${authorisedConnection.connection.clientId}/refreshToken`

    this.authorisedConnection.connection.client.on('message', (topic, payload, packet) => {
      // console.log(`TokenRequestor.onMessage: ${payload.toString()}`);

      if (topic !== this.replyTopic) {
        console.log(`TokenRequestor.onMessage: wrong topic: topic: ${topic}, this.myuuid: ${this.replyTopic}`)
        return;
      }

      var correlationString: string | null = null

      if (packet.properties != null) {
        var correlationData = packet.properties.correlationData;
        if (correlationData != undefined) {
          correlationString = correlationData.toString();
          // console.log(`TokenRequestor.onMessage: correlationString: ${correlationString}`);
          // console.log(`TokenRequestor.onMessage: myuuid:            ${this.myuuid}`);
        }
      }

      if (correlationString == null) {
        console.log(`TokenRequestor.onMessage: Missing 'correlationData'`)
        return;
      }

      if (correlationString != this.myuuid) {
        console.log(`TokenRequestor.onMessage: wrong 'correlationData': correlationString: ${correlationString}, this.myuuid: ${this.myuuid}`)
        return
      }

      // console.log(`TokenRequestor.onMessage: recieved reply to our request' `);
      this.processRefreshTokenReply(payload)
    })

    // console.log(`TokenRequestor.constructor: myuuid:            ${this.myuuid}`);
  }

  processRefreshTokenReply(payload: Buffer) {
    // console.log(`TokenRequestor.processRefreshTokenReply: ${payload.toString()}`);
    var message = JSON.parse(payload.toString())

    if (message.hasOwnProperty('code')) {
      let code = message['code']
      if (typeof code !== "number") {
        console.log(`TokenRequestor.processRefreshTokenReply: Unexpected typeof reply: ${typeof code}`)
        this.subject.error(`TokenRequestor.processRefreshTokenReply: Unexpected typeof reply: ${typeof code}`)
        return;
      }

      if (code !== 200) {
        if (message.hasOwnProperty('message')) {
          let errorMessage = message['message']
          console.log(`TokenRequestor.processRefreshTokenReply: Unexpected code: ${code}, message: ${errorMessage}`)
          this.subject.error(`RefreshToken.processRefreshTokenReply: Unexpected code: ${code}, message: ${errorMessage}`)
          return;
        }

        console.log(`TokenRequestor.processRefreshTokenReply: Unexpected code: ${code}`)
        this.subject.error(`TokenRequestor.processRefreshTokenReply: Unexpected code: ${code}`)
        return;
      }
    }
    else {
      console.log(`TokenRequestor.processRefreshTokenReply: Missing 'code'`)
      this.subject.error(`RefreshToken.processRefreshTokenReply: Missing 'code'`)
      return;
    }

    if (!message.hasOwnProperty('accessToken')) {
      console.log(`TokenRequestor.processRefreshTokenReply: Missing 'accessToken'`)
      this.subject.error(`TokenRequestor.processRefreshTokenReply: Missing 'accessToken'`)
      return;
    }

    
    console.log(`TokenRequestor.processRefreshTokenReply: Updating accessToken`)
    let accessToken = message['accessToken']
    this.subject.next(accessToken)
  }



  requestNewToken(): Observable<void> {
    return new Observable((observer) => {
      let username: string = this.authorisedConnection.signin.username;
      let refreshToken: string = this.authorisedConnection.refreshToken;
      let refresh: Refresh = new Refresh(username, refreshToken);
      let request = { function: 'refreshToken', args: refresh };

      const publishOptions: IClientPublishOptions = {
        qos: 0,
        retain: false,
        properties: {
          responseTopic: this.replyTopic,
          correlationData: Buffer.from(this.myuuid, 'utf-8'),
          userProperties: {
            accessToken: this.authorisedConnection.accessToken
          }
        }
      };

      console.log(`TokenRequestor.requestNewToken: ${JSON.stringify(request)}`);
      console.log(`TokenRequestor.requestNewToken: myuuid: ${this.myuuid}`);
      console.log(`TokenRequestor.requestNewToken`);
      this.authorisedConnection.connection.client.publishAsync('request', JSON.stringify(request), publishOptions)
        .then(() => {
          console.log('TokenRequestor.requestNewToken: publish succeeded');
          observer.next();  // Complete the Observable
          observer.complete();
        })
        .catch((error) => {
          console.error('TokenRequestor.requestNewToken: error publishing: ' + error.message);
          observer.error(error);  // Emit the error
        });
    });
  }



  getUpdates(): Observable<string> {
    console.log(`TokenRequestor.requestNewToken: subscribing to topic: ${this.replyTopic}`);

    this.authorisedConnection.connection.client.subscribeAsync(this.replyTopic)
      .then(() => {
        console.log(`TokenRequestor.subscribe: subscribed`)
      })
      .catch((error) => console.error(`TokenRequestor.subscribe: error: ${error}`));

    return this.observable;
  }




  unsubscribe() {
    console.log(`TokenRequestor.unsubscribe: topic: ${this.replyTopic}`);

    this.authorisedConnection.connection.client.unsubscribeAsync(this.replyTopic)
      .then(() => {
        console.log(`TokenRequestor.unsubscribe: success`);
      })
      .catch((error) => {
        console.error(`TokenRequestor.unsubscribe: error: ${error}`);
      });
  }
}
