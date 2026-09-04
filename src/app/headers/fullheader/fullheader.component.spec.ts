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
});
