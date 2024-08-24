import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DumpComponent } from './alert.component';

describe('DumpComponent', () => {
  let component: DumpComponent;
  let fixture: ComponentFixture<DumpComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DumpComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DumpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
