import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map, Observable } from 'rxjs';
import { Buffer } from 'buffer';
import { MqttClient } from 'mqtt';
import { MqttService } from '../mqtt/mqtt.service';
import { Diary } from '../diary/diary';

@Injectable({ providedIn: 'root' })
export class DiariesService implements OnDestroy {

  private diariesSubject = new BehaviorSubject<Diary[]>([]);
  public diaries$ = this.diariesSubject.asObservable();

  private mqttClient?: MqttClient;
  private hasSubscribed = false;
  private topic = "diary/+";

  constructor(
    private mqttService: MqttService
  ) {
    console.log(`DiariesService.constructor`);
    this.connectAndSubscribe();
  }

  private async connectAndSubscribe() {
    try {
      this.mqttClient = await this.mqttService.getConnection();
      this.setupMqttListener(this.mqttClient);
    } catch (err) {
      console.error('DiariesService: MQTT connection failed', err);
    }
  }

  private setupMqttListener(client: MqttClient) {
    if (this.hasSubscribed) return;

    client.subscribe(this.topic, { qos: 1 }, (err) => {
      if (err) {
        console.error(`DiariesService: Failed to subscribe to ${this.topic}`, err);
        return;
      }

      console.log(`DiariesService: Subscribed to ${this.topic}`);
      this.hasSubscribed = true;

      client.on('message', (topic, payload) => this.handleMessage(topic, payload));
    });
  }

  private handleMessage(messageTopic: string, payload: Buffer) {
    const diaryTopicPattern = /^diary\/\d+$/;
    if (!diaryTopicPattern.test(messageTopic)) {
      return;
    }

    console.log(`DiariesService.handleMessage: topic: ${messageTopic}, this.topic: ${this.topic}`);

    if (payload == null) {
      console.log(`DiariesService.handleMessage: topic: ${messageTopic}, payload: null`);      
      return;
    }

    console.log(`DiariesService.handleMessage: topic: ${messageTopic}, payload: ${payload.toString()}`);

    try {
      const diary: Diary = JSON.parse(payload.toString());

      const current = this.diariesSubject.getValue();
      const index = current.findIndex(d => d.id === diary.id);
      if (index !== -1) {
        current[index] = diary;
      } else {
        current.push(diary);
      }

      current.sort((a, b) => a.sequence - b.sequence);
      this.diariesSubject.next([...current]);

    } catch (e) {
      console.warn(`DiariesService: Failed to parse diary for topic ${messageTopic}`, e);
    }
  }

  getDiaryById(id: number): Observable<Diary | undefined> {
    console.log(`DiariesService.getDiaryById: id: ${id}`);
    return this.diaries$.pipe(
      map(diaries => diaries.find(d => d.id === id)),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    );
  }

  ngOnDestroy(): void {
    if (this.mqttClient && this.hasSubscribed) {
      this.mqttClient.unsubscribe(this.topic, (err) => {
        if (err) {
          console.error(`DiariesService: Unsubscribe error from ${this.topic}`, err);
        } else {
          console.log(`DiariesService: Unsubscribed from ${this.topic}`);
        }
      });
    }
  }
}
