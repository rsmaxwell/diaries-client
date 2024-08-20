import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SigninDetailComponent } from './signin.detail.component';

describe('SigninDetailComponent', () => {
  let component: SigninDetailComponent;
  let fixture: ComponentFixture<SigninDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SigninDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SigninDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
