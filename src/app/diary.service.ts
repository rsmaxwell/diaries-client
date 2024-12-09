import { Injectable } from '@angular/core';
import { Diary } from './diary';
import { Observable, of, Subject } from 'rxjs';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import { MqttSigninService } from './user/mqtt.signin.service';
import { ReplyHandler } from './utilities/replyHandler';




@Injectable({
  providedIn: 'root'
})
export class DiaryService {

  private diaries: Diary[] = [];
  private diariesSubject = new Subject<Diary[]>();
  private diariesObservable = this.diariesSubject.asObservable();

  constructor(
    private mqttSigninService: MqttSigninService
  ) {
    console.log("DiaryService.constructor");

    let replyTopic = `reply/diaries`;
    let myuuid = uuidv4();

    let connection = this.mqttSigninService.authorisedConnection.connection
    connection.client.on('message', (topic: string, payload: Buffer, packet: any) => {

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
        console.log(`MqttSigninService.signin.connected: Missing 'correlationData'`)
        return;
      }

      if (correlationString != myuuid) {
        return
      }

      ReplyHandler.handle(payload, this.diariesSubject)
    }); 



    connection.client.subscribeAsync(replyTopic)
      .then((granted) => {
        let request = { function: 'getDiaries' };

        var publishOptions: any = {
          qos: 0,
          retain: false,
          properties: {
            responseTopic: replyTopic,
            correlationData: Buffer.from(myuuid, 'utf-8'),
            userProperties: {
              accessToken: this.mqttSigninService.authorisedConnection.accessToken
            }
          }
        };

        let requestString = JSON.stringify(request)
        console.info(`DiaryService.getDiaries: publishing: request: ${requestString}`);
        console.info(`DiaryService.getDiaries: publishing: options: ${JSON.stringify(publishOptions)})`);
        connection.client.publishAsync('request', requestString, publishOptions)
          .then(() => {
            console.info(`DiaryService.getDiaries: published`);
          })
          .catch((error) => {
            console.error(`DiaryService.getDiaries: error publishing: ${error.message}`);
          });
      })
      .catch((error) => {
        console.error(`DiaryService.getDiaries: error subscribing: ${error.message}`);
      });   
  }

  getDiary(id: number): Observable<Diary> {
    console.log(`DiaryService.getDiary: id=${id}`);
    const diary = this.diaries.find(h => h.id === id)!;
    return of(diary);
  }

  getDiaries(): Observable<Diary[]> {
    console.log(`DiaryService.getDiaries`);
    return this.diariesObservable;
  }
  

  ngOnDestroy(): void {
    // let connection = this.mqttSigninService.authorisedConnection.connection
    // connection.client.unsubscribe(this.replyTopic)
  }
}

