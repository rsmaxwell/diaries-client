import { Injectable } from '@angular/core';
import { Diary } from './diary';
import { DIARIES } from './mock-diaries';
import { Observable, of } from 'rxjs';
import { MessageService } from './message.service';
import { IMqttMessage, IPublishOptions, MqttService } from 'ngx-mqtt';
import { Buffer } from 'buffer';
import { switchMap } from 'rxjs/operators';
import {v4 as uuidv4} from  'uuid';

@Injectable({
  providedIn: 'root'
})
export class DiaryService {

  public replyTopic = "reply"
  public requestTopic = "request"

  constructor(
    private mqtt: MqttService,
    private messageService: MessageService)
 { 
  let observable: Observable<IMqttMessage> = this.mqtt.observe(this.replyTopic)

 }
  
  getDiary(id: number): Observable<Diary> {
    // For now, assume that a hero with the specified `id` always exists.
    // Error handling will be added in the next step of the tutorial.
    const diary = DIARIES.find(h => h.id === id)!;
    this.messageService.add(`DiaryService: fetched diary id=${id}`);
    return of(diary);
  }

  getDiaries(): Observable<Diary[]> { 
    console.log("DiaryService.getDiaries");
  
    return this.getMqttResponse().pipe(
      switchMap((message: IMqttMessage) => {
        return of(this.convertMqttResponse(message));
      })
    );
  }

  getMqttResponse(): Observable<IMqttMessage> {  

    console.log("DiaryService.getMqttResponse")

    let myuuid = uuidv4();
    console.log('Your UUID is: ' + myuuid);

    var response: IMqttMessage;

    let observable: Observable<IMqttMessage> = this.mqtt.observe(this.replyTopic)

    let request = { function: "getDiaries" }

    var options:IPublishOptions = { 
      qos: 0,
      retain: false,
      properties: {
        responseTopic: this.replyTopic,
        correlationData: Buffer.from(myuuid, 'utf-8'),
        userProperties: {
          region: 'A',
          type: 'JSON',
        },
      }
    }

    this.mqtt.unsafePublish(this.requestTopic, JSON.stringify(request), options);

    observable.subscribe({
      next: (message: IMqttMessage) => {
        console.log("DiariesComponent.getMqttResponse: message: " + message);

        // // Accessing correlationData
        // if (message.properties?.correlationData) {
        //   const correlationData = message.properties.correlationData;
        // 
        //   // correlationData is a Buffer, so you might want to convert it to a string or another format
        //   const correlationDataString = correlationData.toString('utf-8');
        //   console.log("Correlation Data: " + correlationDataString);
        // } else {
        //   console.log("No correlationData present in the message properties.");
        // }

        response = message;
      },
      error: err => {
          console.log("DiariesComponent.getMqttResponse: error: " + err)
          this.messageService.add(err)
      },
      complete: () => {
          console.log("DiariesComponent.getMqttResponse: complete")
      }
    });

    return observable;
  }

  convertMqttResponse(response: IMqttMessage): Diary[] {
    let payload = response.payload.toString()
    console.log("DiariesComponent.getDiaries: response: " + payload)
    let jsonPayload = JSON.parse(payload)
    let diaries:  Diary[]  = JSON.parse(jsonPayload.result);
    console.log("DiariesComponent.getDiaries: number of Diaries = " + diaries.length)
    diaries.forEach((item) => console.log("    id: " + item.id + ", path: " + item.path ))
    return diaries;
  }
}
