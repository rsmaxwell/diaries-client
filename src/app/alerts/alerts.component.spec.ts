import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AlertsComponent } from './alerts.component';
import { AlertType } from './alert.model';
import { AlertBuilder } from './alert.builder';
import { AlertService } from './alert.service';

describe('AlertsComponent', () => {
  let component: AlertsComponent;
  let fixture: ComponentFixture<AlertsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlertsComponent],
      providers: [
        provideRouter([])
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AlertsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders the latest alert as a named, keyboard-focusable control', () => {
    const alertService = TestBed.inject(AlertService);
    alertService.publish(new AlertBuilder().type(AlertType.Info).message('Ready').build());
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button.alert-message') as HTMLButtonElement;
    expect(button.type).toBe('button');
    expect(button.querySelector('.alert-kind')?.textContent?.trim()).toBe('Information');
  });
});
