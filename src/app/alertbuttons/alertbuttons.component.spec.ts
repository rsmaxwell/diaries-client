import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AlertbuttonsComponent } from './alertbuttons.component';

describe('AlertbuttonsComponent', () => {
  let component: AlertbuttonsComponent;
  let fixture: ComponentFixture<AlertbuttonsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlertbuttonsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AlertbuttonsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
