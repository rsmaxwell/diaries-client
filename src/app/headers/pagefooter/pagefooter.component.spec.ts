import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PagefooterComponent } from './pagefooter.component';

describe('PagefooterComponent', () => {
  let component: PagefooterComponent;
  let fixture: ComponentFixture<PagefooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PagefooterComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PagefooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
