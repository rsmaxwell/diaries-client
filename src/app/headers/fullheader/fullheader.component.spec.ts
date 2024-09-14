import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FullheaderComponent } from './fullheader.component';

describe('FullheaderComponent', () => {
  let component: FullheaderComponent;
  let fixture: ComponentFixture<FullheaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FullheaderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FullheaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
