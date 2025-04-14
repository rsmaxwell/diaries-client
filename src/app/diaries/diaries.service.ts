import { Injectable } from '@angular/core';
import { Diary } from '../diary/diary';
import { Observable, of, Subject, Subscription } from 'rxjs';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';
import { MqttSigninService } from '../user/mqtt.signin.service';
import { ReplyHandler } from '../utilities/replyHandler';
import { GetDiariesReply } from '../utilities/reply';




@Injectable({
  providedIn: 'root'
})
export class DiariesService {

  private diariesSubject = new Subject<Diary[]>();
  private diariesObservable = this.diariesSubject.asObservable();
  private topic = `diaries`;
  private diariesSubscription: Subscription | null = null;

  constructor(private mqttSigninService: MqttSigninService) {}

  getDiaries(): Observable<Diary[]> {

    let connection = this.mqttSigninService.authorisedConnection.connection
    if (!connection || !connection.client) {
      console.error("DiariesService.getDiaries: MQTT connection is unavailable.");
      return this.diariesObservable;
    }

    // Subscribe to the topic
    connection.client.subscribe(this.topic, (err) => {
      if (err) {
        console.error(`DiariesService.getDiaries: Failed to subscribe to "${this.topic}"`, err);
        return;
      }
      console.log(`DiariesService.getDiaries: Successfully subscribed to "${this.topic}"`);
    });

    // Handle incoming messages
    connection.client.on('message', (topic: string, payload: Buffer) => {
      if (topic != this.topic) {
        return
      }

      console.log(`DiariesService.getDiaries: Raw Payload:`, payload.toString());

      let {object, reason} = ReplyHandler.getBufferAsObject(payload);
      if (!object) {
        this.diariesSubject.error(reason);
        return;
      }

      let diaries = object as Diary[];
      this.diariesSubject.next(diaries);
    });

    // Track the subscription
    this.diariesSubscription = this.diariesObservable.subscribe({
      next: (diaries) => console.log("Diaries received:", diaries),
      error: (err) => console.error("DiariesService error:", err),
    }); 

    return this.diariesObservable;
  }

  unsubscribe() {
    console.log("DiariesService.unsubscribe");

    if (this.diariesSubscription) {
      this.diariesSubscription.unsubscribe();
      this.diariesSubscription = null;
    }

    const connection = this.mqttSigninService.authorisedConnection.connection;
    if (connection && connection.client) {
      connection.client.unsubscribe(this.topic, (err) => {
        if (err) {
          console.error(`DiariesService.unsubscribe: Error unsubscribing from ${this.topic}`, err);
        } else {
          console.log(`DiariesService.unsubscribe: Unsubscribed from ${this.topic}`);
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.unsubscribe();
  }
}

