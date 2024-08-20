import { Injectable } from '@angular/core';
import { Diary } from './diary';
import { DIARIES } from './mock-diaries';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { MessageService } from './message.service';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import { MqttService } from './mqtt.service';
import mqtt from 'mqtt';



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
    private messageService: MessageService) {
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
          this.diaries = obj['result'];
          this.diariesSubject.next(this.diaries);  // Emit the new diaries list
        }
      }
    });

  }

  getDiary(id: number): Observable<Diary> {
    console.log(`DiaryService.getDiary: id=${id}`);
    // For now, assume that a hero with the specified `id` always exists.
    // Error handling will be added in the next step of the tutorial.
    const diary = this.diaries.find(h => h.id === id)!;
    this.messageService.add(`DiaryService: fetched diary id=${id}`);
    return of(diary);
  }

  getDiaries(): Observable<Diary[]> {
    console.log(`DiaryService.getDiaries`);
    return this.diariesObservable;  // Return the observable
  }
}

