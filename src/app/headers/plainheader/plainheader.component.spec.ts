import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlainheaderComponent } from './plainheader.component';

describe('PlainheaderComponent', () => {
  let component: PlainheaderComponent;
  let fixture: ComponentFixture<PlainheaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlainheaderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlainheaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
