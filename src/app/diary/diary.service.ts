import { Injectable } from '@angular/core';
import { Diary, DiaryResponse } from './diary';
import { Observable, of, Subject, Subscription } from 'rxjs';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import { MqttSigninService } from '../user/mqtt.signin.service';
import { ReplyHandler } from '../utilities/replyHandler';
import { Connection } from '../model/connection';
import { MqttClient } from 'mqtt';
import { GetDiaryReply, Reply } from '../utilities/reply';
import { AlertService } from '../alerts/alert.service';

@Injectable({
  providedIn: 'root'
})
export class DiaryService {
  private diarySubject = new Subject<DiaryResponse>();
  private diaryObservable = this.diarySubject.asObservable();
  private topic = "";
  private diarySubscription: Subscription | null = null;
  private cachedResponse: DiaryResponse | null = null;

  constructor(private mqttSigninService: MqttSigninService) {}

  getDiary(id: number): Observable<DiaryResponse> {
    console.log(`DiaryService.getDiary: id: ${id}`);

    if (this.cachedResponse && this.cachedResponse.diary.id === id) {
      console.log(`DiaryService.getDiary: returning cachedResponse`);
      return of(this.cachedResponse);
    }

    this.topic = `diary/${id}`;

    const connection = this.mqttSigninService.authorisedConnection.connection;
    if (!connection || !connection.client) {
      console.error("DiaryService.getDiary: MQTT connection is unavailable.");
      return this.diaryObservable;
    }

    // Subscribe to the topic
    connection.client.subscribe(this.topic, (err) => {
      if (err) {
        console.error(`DiaryService.getDiary: Error subscribing to ${this.topic}`, err);
        return;
      }
      console.log(`DiaryService.getDiary: Subscribed to ${this.topic}`);
    });

    // Handle incoming messages
    connection.client.on('message', (topic: string, payload: Buffer) => {
      if (topic !== this.topic) {
        return;
      }

      const maxLength = 150;
      const payloadString = payload.toString();
      const trimmedPayload = payloadString.length > maxLength 
        ? payloadString.substring(0, maxLength) + '...'
        : payloadString;
      
      console.log(`DiaryService.on 'message': payload string: ${trimmedPayload}`);

      let {object, reason} = ReplyHandler.getBufferAsObject(payload);
      if (!object) {
        this.diarySubject.error(reason);
        return;
      }

      // console.log(`DiaryService.on 'message': payload object: ${JSON.stringify(object)}`);

      let diaryResponse = object as DiaryResponse;
      this.cachedResponse = diaryResponse;
      this.diarySubject.next(diaryResponse);
    });

    // Track the subscription
    this.diarySubscription = this.diaryObservable.subscribe({
      next: (response) => console.log("response received:", response),
      error: (err) => console.error("DiaryService error:", err),
    });


    return this.diaryObservable;
  }

  unsubscribe() {
    console.log("DiaryService.unsubscribe");

    if (this.diarySubscription) {
      this.diarySubscription.unsubscribe();
      this.diarySubscription = null;
    }

    const connection = this.mqttSigninService.authorisedConnection.connection;
    if (connection && connection.client) {
      connection.client.unsubscribe(this.topic, (err) => {
        if (err) {
          console.error(`DiaryService.unsubscribe: Error unsubscribing from ${this.topic}`, err);
        } else {
          console.log(`DiaryService.unsubscribe: Unsubscribed from ${this.topic}`);
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.unsubscribe();
  }
}
