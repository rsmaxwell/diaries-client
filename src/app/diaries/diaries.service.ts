import { Injectable, OnDestroy } from '@angular/core';
import { Observable } from 'rxjs';
import { Buffer } from 'buffer';
import { MqttClient } from 'mqtt';
import { MqttService } from '../mqtt/mqtt.service';
import { GetDiariesReply, getUnexpectedReplyMessage, isGetDiariesReply } from '../utilities/reply';
import { ReplyHandler } from '../utilities/replyHandler';

@Injectable({ providedIn: 'root' })
export class DiariesService implements OnDestroy {

  constructor(
    private mqttService: MqttService
  ) { }

  getDiaries(): Observable<GetDiariesReply> {
    return new Observable<GetDiariesReply>(observer => {
      const topic = `diaries`;
      let client: MqttClient;
      let messageHandler: ((topicReceived: string, payload: Buffer) => void) | undefined;

      this.mqttService.getConnection()
        .then((c: MqttClient) => {
          client = c;

          messageHandler = (messageTopic: string, payload: Buffer) => {
            if (topic !== messageTopic) return;

            const payloadStr = payload.toString();
            console.log(`DiariesService.getDiaries: Received message on ${topic}:`, payloadStr.slice(0, 150));

            let obj;
            try {
              obj = ReplyHandler.getBufferAsObject(payload);
            } catch (err) {
              observer.error(`Failed to parse reply: ${err}`);
              return;
            }

            if (!isGetDiariesReply(obj)) {
              observer.error(getUnexpectedReplyMessage(obj));
              return;
            }

            observer.next(obj as GetDiariesReply);
            observer.complete();
          };

          client.subscribe(topic, { qos: 1 }, (err) => {
            if (err) {
              observer.error(`Failed to subscribe to ${topic}: ${err.message}`);
            } else {
              console.log(`DiariesService.getDiaries: Subscribed to ${topic}`);
              client.on('message', messageHandler!);
            }
          });
        })
        .catch(err => {
          observer.error(`Failed to load diaries: ${err}`);
        });

      // Teardown logic
      return () => {
        console.log("DiariesService.getDiaries: Unsubscribing and cleaning up");

        if (client && messageHandler) {
          client.removeListener('message', messageHandler);
          client.unsubscribe(topic, (err) => {
            if (err) {
              console.error(`DiariesService.getDiaries: Error unsubscribing from ${topic}`, err);
            } else {
              console.log(`DiariesService.getDiaries: Unsubscribed from ${topic}`);
            }
          });
        }
      };
    });
  }

  ngOnDestroy(): void {
    console.log("DiariesService.ngOnDestroy");
  }
}
