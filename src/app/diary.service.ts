import { Injectable } from '@angular/core';
import { Diary } from './diary';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import mqtt from 'mqtt';




@Injectable({
  providedIn: 'root'
})
export class DiaryService {

  private mqttClient!: mqtt.MqttClient;
  private clientID!: string;

  private diaries: Diary[] = [];
  private diariesSubject = new Subject<Diary[]>();
  private diariesObservable = this.diariesSubject.asObservable();


  constructor() {
    console.log("DiaryService.constructor");
  }

  initialize(mqttClient: mqtt.MqttClient, clientID: string) {
    console.log(`DiaryService.initialize`);
    this.mqttClient = mqttClient;
    this.clientID = clientID;
  }

  getDiary(id: number): Observable<Diary> {
    console.log(`DiaryService.getDiary: id=${id}`);
    const diary = this.diaries.find(h => h.id === id)!;
    return of(diary);
  }

  getDiaries(): Observable<Diary[]> {
    console.log(`DiaryService.getDiaries`);
    const replyTopic = `reply/diaries`;
    let myuuid = uuidv4();
    
    this.mqttClient.subscribeAsync(replyTopic)
      .then((granted) => {
        let request = { function: 'getDiaries' };

        var publishOptions: any = {
          qos: 0,
          retain: false,
          properties: {
            responseTopic: replyTopic,
            correlationData: Buffer.from(myuuid, 'utf-8'),
          }
        };

        this.mqttClient.publishAsync('request', JSON.stringify(request), publishOptions)
          .then(() => {
          })
          .catch((error) => {
            console.error('DiaryService.getDiaries: error publishing: ' + error.message);
          });
      })
      .catch((error) => {
        console.error('DiaryService.getDiaries: error subscribing: ' + error.message);
      });

    this.mqttClient.on('message', (topic, message) => {
      if (topic === replyTopic) {
        var obj = JSON.parse(message.toString());

        if (obj.hasOwnProperty('code')) {
          let code = obj['code'];
          if (typeof code !== "number" || code !== 200) {
            console.log('DiaryService.getDiaries: Unexpected reply: code: ' + code);
            console.log('DiaryService.getDiaries: Unexpected reply: ' + message.toString());
            return;
          }
        }

        if (obj.hasOwnProperty('result')) {
          this.diaries = obj['result'];
          console.log(`DiaryService.getDiaries: onMessage: result: ${JSON.stringify(this.diaries)}`);
          this.diariesSubject.next(this.diaries);
        }
      }
    });


    return this.diariesObservable;
  }
}

