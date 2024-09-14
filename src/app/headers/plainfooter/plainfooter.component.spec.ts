import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlainfooterComponent } from './plainfooter.component';

describe('PlainfooterComponent', () => {
  let component: PlainfooterComponent;
  let fixture: ComponentFixture<PlainfooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlainfooterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlainfooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
