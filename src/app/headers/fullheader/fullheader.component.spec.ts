import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FullHeaderComponent } from './fullheader.component';

describe('FullHeaderComponent', () => {
  let component: FullHeaderComponent;
  let fixture: ComponentFixture<FullHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FullHeaderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FullHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('gives every icon button an accessible name', () => {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const labels = buttons.map(button => button.getAttribute('aria-label'));

    expect(labels).toEqual(['Open application menu', 'Favourite diary', 'Share diary']);
  });
});
