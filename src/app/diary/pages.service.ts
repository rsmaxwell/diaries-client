import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, map, distinctUntilChanged } from 'rxjs';
import { MqttClient } from 'mqtt';
import { Buffer } from 'buffer';
import { MqttService } from '../mqtt/mqtt.service';
import { Page } from '../model/page';

@Injectable({ providedIn: 'root' })
export class PagesService implements OnDestroy {

  private mqttClient?: MqttClient;
  private subscriptions = new Map<number, BehaviorSubject<Page[]>>();
  private activeTopics = new Set<string>();

  constructor(
    private mqttService: MqttService
  ) {
    console.log(`PagesService.constructor`);
    this.init();
  }

  private async init() {
    try {
      console.log(`PagesService.init`);
      this.mqttClient = await this.mqttService.getConnection();
      this.mqttClient.on('message', (topic, payload) => this.handleMessage(topic, payload));
    } catch (err) {
      console.error('PagesService: Failed to connect to MQTT broker', err);
    }
  }

  getPagesForDiary(diaryId: number): Observable<Page[]> {
    console.log(`PagesService.getPagesForDiary: diaryId: ${diaryId}`);
    const topic = `diary/${diaryId}/+`;

    if (!this.subscriptions.has(diaryId)) {
      this.subscriptions.set(diaryId, new BehaviorSubject<Page[]>([]));
      this.subscribeToTopic(topic);
    }

    return this.subscriptions.get(diaryId)!.asObservable();
  }

  private subscribeToTopic(topic: string): void {
    if (!this.mqttClient || this.activeTopics.has(topic)) return;

    this.mqttClient.subscribe(topic, { qos: 1 }, err => {
      if (err) {
        console.error(`PagesService: Failed to subscribe to ${topic}`, err);
      } else {
        console.log(`PagesService: Subscribed to ${topic}`);
        this.activeTopics.add(topic);
      }
    });
  }

  private handleMessage(topic: string, payload: Buffer): void {
    const match = topic.match(/^diary\/(\d+)\/\d+$/);
    if (!match) return;

    const diaryId = parseInt(match[1], 10);
    const subject = this.subscriptions.get(diaryId);
    if (!subject) return;

    try {
      const page: Page = JSON.parse(payload.toString());
      const current = subject.getValue();
      const updated = [...current.filter(p => p.id !== page.id), page]
        .sort((a, b) => a.sequence - b.sequence);

      subject.next(updated);
    } catch (e) {
      console.warn(`PagesService: Failed to parse page for topic ${topic}`, e);
    }
  }

  getPageForDiaryById(diaryId: number, pageId: number): Observable<Page | undefined> {
    console.log(`PagesService.getPageForDiaryById: diaryId: ${diaryId}, pageId: ${pageId}`);

    return this.getPagesForDiary(diaryId).pipe(
      map(pages => pages.find(p => p.id === pageId)),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)) // optional deep equality
    );
  }

  ngOnDestroy(): void {
    console.log(`PagesService.ngOnDestroy`);
    if (this.mqttClient) {
      this.activeTopics.forEach(topic => {
        this.mqttClient!.unsubscribe(topic, err => {
          if (err) {
            console.error(`PagesService: Error unsubscribing from ${topic}`, err);
          } else {
            console.log(`PagesService: Unsubscribed from ${topic}`);
          }
        });
      });
    }
    this.subscriptions.clear();
  }
}
