import { Injectable, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs';
import { Buffer } from 'buffer';
import { MqttClient } from 'mqtt';

import { DiaryResponse } from './diary';
import { MqttService } from '../mqtt/mqtt.service';
import { GetDiaryReply, getUnexpectedReplyMessage, isGetDiaryReply } from '../utilities/reply';
import { ReplyHandler } from '../utilities/replyHandler';

@Injectable({ providedIn: 'root' })
export class DiaryService implements OnDestroy {

  constructor(
    private mqttService: MqttService
  ) { }

  getDiary(id: number): Observable<DiaryResponse> {
    return new Observable<DiaryResponse>(observer => {
      const replyTopic = `diary/${id}`;

      this.mqttService.getConnection()
        .then((client: MqttClient) => {

          const messageHandler = (topic: string, payload: Buffer) => {
            if (topic !== replyTopic) return;

            const payloadStr = payload.toString();
            console.log(`DiaryService: Received message on ${replyTopic}:`, payloadStr.slice(0, 150));

            let obj;
            try {
              obj = ReplyHandler.getBufferAsObject(payload);
            } catch (err) {
              observer.error(`Failed to parse message: ${err}`);
              return;
            }

            if (!isGetDiaryReply(obj)) {
              observer.error(getUnexpectedReplyMessage(obj));
              return;
            }

            observer.next(obj as GetDiaryReply);
            observer.complete();
          };

          client.subscribe(replyTopic, { qos: 1 }, (err) => {
            if (err) {
              observer.error(`Failed to subscribe to ${replyTopic}: ${err.message}`);
            } else {
              console.log(`DiaryService: Subscribed to ${replyTopic}`);
              client.on('message', messageHandler);
            }
          });

          // Teardown logic
          return () => {
            console.log("DiaryService: Unsubscribing and cleaning up");
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
    console.log("DiaryService destroyed");
  }
}
