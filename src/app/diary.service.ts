import { Injectable } from '@angular/core';
import { Diary } from './diary';
import { DIARIES } from './mock-diaries';
import { Observable, of } from 'rxjs';
import { MessageService } from './message.service';

@Injectable({
  providedIn: 'root'
})
export class DiaryService {

  constructor(private messageService: MessageService) { }
  
  getDiaries(): Observable<Diary[]> {
    const heroes = of(DIARIES);
    this.messageService.add('DiaryService: fetched diaries');
    return heroes;
  }

  getDiary(id: number): Observable<Diary> {
    // For now, assume that a hero with the specified `id` always exists.
    // Error handling will be added in the next step of the tutorial.
    const diary = DIARIES.find(h => h.id === id)!;
    this.messageService.add(`DiaryService: fetched diary id=${id}`);
    return of(diary);
  }
}
