import { Injectable, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs';
import { Buffer } from 'buffer';
import { MqttClient } from 'mqtt';

import { MqttService } from '../mqtt/mqtt.service';
import { GetPageReply, getUnexpectedReplyMessage, isGetPageReply } from '../utilities/reply';
import { ReplyHandler } from '../utilities/replyHandler';
import { PageResponse } from './page';


@Injectable({ providedIn: 'root' })
export class PageService implements OnDestroy {

  constructor(
    private mqttService: MqttService
  ) { }

  getPage(diaryId: number, pageId: number): Observable<PageResponse> {
    console.log(`PageService.getPage: diaryId: ${diaryId}, diaryId: ${diaryId}`);
    
    return new Observable<PageResponse>(observer => {
      const replyTopic = `diary/${diaryId}/${pageId}`;

      this.mqttService.getConnection()
        .then((client: MqttClient) => {

          const messageHandler = (topic: string, payload: Buffer) => {
            if (topic !== replyTopic) return;

            const payloadStr = payload.toString();
            console.log(`PageService: Received message on ${replyTopic}:`, payloadStr.slice(0, 150));

            let obj;
            try {
              obj = ReplyHandler.getBufferAsObject(payload);
            } catch (err) {
              observer.error(`Failed to parse message: ${err}`);
              return;
            }

            if (!isGetPageReply(obj)) {
              observer.error(getUnexpectedReplyMessage(obj));
              return;
            }

            observer.next(obj as GetPageReply);
            observer.complete();
          };

          client.subscribe(replyTopic, { qos: 1 }, (err) => {
            if (err) {
              observer.error(`Failed to subscribe to ${replyTopic}: ${err.message}`);
            } else {
              console.log(`PageService: Subscribed to ${replyTopic}`);
              client.on('message', messageHandler);
            }
          });

          // Teardown logic
          return () => {
            console.log("PageService: Unsubscribing and cleaning up");
            client.removeListener('message', messageHandler);
            client.unsubscribe(replyTopic, (err) => {
              if (err) {
                console.error(`Error unsubscribing from ${replyTopic}`, err);
              } else {
                console.log(`Unsubscribed from ${replyTopic}`);
              }
            });
          };
        })
        .catch(err => {
          observer.error(`Failed to load diary: ${err}`);
        });
    });
  }

  ngOnDestroy(): void {
    console.log("PageService destroyed");
  }
}
