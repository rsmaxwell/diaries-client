import { Injectable } from '@angular/core';
import { Diary } from './diary';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { AlertService } from './alert.service';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import { MqttService } from './mqtt.service';
import mqtt from 'mqtt';
import { AlertType } from './alert.model';
import { AlertBuilder } from './alert.builder';



@Injectable({
  providedIn: 'root'
})
export class DiaryService {

  public requestTopic = "request"

  private mqttClient!: mqtt.MqttClient;

  private diaries: Diary[] = [];
  private diariesSubject = new BehaviorSubject<Diary[]>([]);
  private diariesObservable = this.diariesSubject.asObservable();


  constructor(
    private mqttService: MqttService,
    private alertService: AlertService) {
    console.log("DiaryService.constructor");
  }

  initializeAsync(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('DiaryService.initializeAsync: Initializing DiaryService with Mqtt');
      this.mqttService.initializeAsync()
        .then((client) => {
          console.log('DiaryService.initializeAsync: Promise resolved');
          this.mqttClient = client;

          this.initialiseDiaries();

          resolve();
        })
        .catch((error) => {
          console.error('DiaryService.initializeAsync: Promise rejected with error: ' + error.message);
          reject(error);
        });
    });
  }

  initialiseDiaries() {
    console.log(`DiaryService.initialiseDiaries`);

    let myuuid = uuidv4();
    let replyTopic = `reply/diaries`;

    
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
            console.error('DiaryService.initialiseDiaries: error publishing: ' + error.message);
          });
      })
      .catch((error) => {
        console.error('DiaryService.initialiseDiaries: error subscribing: ' + error.message);
      });

    this.mqttClient.on('message', (topic, message) => {
      if (topic === replyTopic) {
        var obj = JSON.parse(message.toString());

        if (obj.hasOwnProperty('code')) {
          let code = obj['code'];
          if (typeof code !== "number" || code !== 200) {
            console.log('Unexpected reply: code: ' + code);
            console.log('Unexpected reply: ' + message.toString());
            return;
          }
        }

        if (obj.hasOwnProperty('result')) {
          let x = obj['result'];
          this.diaries = JSON.parse(x);
          console.log(`onMessage: result: ${JSON.stringify(this.diaries)}`);
          this.diariesSubject.next(this.diaries);  // Emit the new diaries list
        }
      }
    });

  }

  getDiary(id: number): Observable<Diary> {
    console.log(`DiaryService.getDiary: id=${id}`);
    const diary = this.diaries.find(h => h.id === id)!;
    return of(diary);
  }

  getDiaries(): Observable<Diary[]> {
    return of(this.diaries)
  }
}

