import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FullfooterComponent } from './fullfooter.component';

describe('PlainfooterComponent', () => {
  let component: FullfooterComponent;
  let fixture: ComponentFixture<FullfooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FullfooterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FullfooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
