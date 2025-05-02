import { TestBed } from '@angular/core/testing';
import { DiaryService } from './diary.service.original';



describe('DiaryService', () => {
  let service: DiaryService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DiaryService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
