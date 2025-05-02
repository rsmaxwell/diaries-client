import { Injectable, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs';
import { Buffer } from 'buffer';
import { MqttClient } from 'mqtt';

import { MqttService } from '../mqtt/mqtt.service';
import { GetPagesReply, getUnexpectedReplyMessage, isGetPagesReply } from '../utilities/reply';
import { ReplyHandler } from '../utilities/replyHandler';
import { PagesResponse } from './page';

@Injectable({ providedIn: 'root' })
export class DiaryService implements OnDestroy {

  constructor(
    private mqttService: MqttService
  ) { }

  getPages(diaryId: number): Observable<PagesResponse> {
    return new Observable<PagesResponse>(observer => {
      const replyTopic = `diary/${diaryId}`;

      this.mqttService.getConnection()
        .then((client: MqttClient) => {

          const messageHandler = (topic: string, payload: Buffer) => {
            if (topic !== replyTopic) return;

            const payloadStr = payload.toString();
            console.log(`PagesService: Received message on ${replyTopic}:`, payloadStr.slice(0, 150));

            try {
              const { obj, reason } = ReplyHandler.getBufferAsObject(payload);
              if (isGetPagesReply(obj)) {
                observer.next(obj as GetPagesReply);
                observer.complete();
              } else if (reason) {
                observer.error(reason);
              } else {
                observer.error(getUnexpectedReplyMessage(obj));
              }
            } catch (err) {
              observer.error(`Failed to parse message: ${err}`);
            }
          };

          client.subscribe(replyTopic, { qos: 1 }, (err) => {
            if (err) {
              observer.error(`Failed to subscribe to ${replyTopic}: ${err.message}`);
            } else {
              console.log(`PagesService: Subscribed to ${replyTopic}`);
              client.on('message', messageHandler);
            }
          });

          // Teardown logic
          return () => {
            console.log("PagesService: Unsubscribing and cleaning up");
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
    console.log("PagesService destroyed");
  }
}
