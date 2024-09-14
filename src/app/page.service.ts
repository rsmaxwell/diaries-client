import { Injectable } from '@angular/core';
import { Page } from './page';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import mqtt from 'mqtt';
import { Diary } from './diary';




@Injectable({
  providedIn: 'root'
})
export class PageService {

  private mqttClient!: mqtt.MqttClient;
  private clientID!: string;

  private pages: Page[] = [];
  private pagesSubject = new BehaviorSubject<Page[]>([]);
  private pagesObservable = this.pagesSubject.asObservable();


  constructor() {
    console.log("PagesService.constructor");
  }


  initialize(mqttClient: mqtt.MqttClient, clientID: string) {
    console.log(`PageService.initialize`);
    this.mqttClient = mqttClient;
    this.clientID = clientID;
  }


  subscribe(diary: Diary) {
    console.log(`PageService.subscribe`);
    const replyTopic = `reply/pages`;

    let myuuid = uuidv4();

    this.mqttClient.subscribeAsync(replyTopic)
      .then((granted) => {

        let request = { function: 'getPages', args: { "diary": diary.id} };

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
            console.error('PageService.subscribe: error publishing: ' + error.message);
          });
      })
      .catch((error) => {
        console.error('PageService.subscribe: error subscribing: ' + error.message);
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
          this.pages = obj['result'];
          console.log(`onMessage: result: ${JSON.stringify(this.pages)}`);
          this.pagesSubject.next(this.pages);  // Emit the new pages list
        }
      }
    });
  }

  unsubscribe() {
    console.log(`PageService.unsubscribe`);
  }

  getPages(): Observable<Page[]> {
    return this.pagesObservable;
  }

  getPage(id: number): Observable<Page> {
    console.log(`PageService.getPage: id=${id}`);
    const page = this.pages.find(h => h.id === id)!;
    return of(page);
  }
}

