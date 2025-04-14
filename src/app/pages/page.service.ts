import { Injectable } from '@angular/core';
import { Page } from './page';
import { Observable, of, Subject } from 'rxjs';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import { Diary } from '../diary/diary';
import { MqttSigninService } from '../user/mqtt.signin.service';




@Injectable({
  providedIn: 'root'
})
export class PageService {

  private pages: Page[] = [];
  private pagesSubject = new Subject<Page[]>();
  private pagesObservable = this.pagesSubject.asObservable();


  constructor(
    private mqttSigninService: MqttSigninService
  ) {
    console.log("PagesService.constructor");
  }


  subscribe(diary: Diary) {
    console.log(`PageService.subscribe: diary: id: ${diary.id}, name: ${diary.name}`);
    const replyTopic = `reply/pages`;

    let myuuid = uuidv4();

    this.mqttSigninService.authorisedConnection.connection.client.subscribeAsync(replyTopic)
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

        this.mqttSigninService.authorisedConnection.connection.client.publishAsync('request', JSON.stringify(request), publishOptions)
          .then(() => {
          })
          .catch((error) => {
            console.error('PageService.subscribe: error publishing: ' + error.message);
          });
      })
      .catch((error) => {
        console.error('PageService.subscribe: error subscribing: ' + error.message);
      });

      this.mqttSigninService.authorisedConnection.connection.client.on('message', (topic, message) => {
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

