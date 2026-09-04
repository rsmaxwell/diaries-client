import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import { Alert, AlertType } from '../alerts/alert.model';
import { AlertService } from '../alerts/alert.service';
import { ClientBuildInfoService } from '../build-info/client-build-info.service';
import { RpcService } from '../mqtt/rpc.service';
import { AlertComponent } from './alert.component';

describe('AlertComponent', () => {
  let component: AlertComponent;
  let fixture: ComponentFixture<AlertComponent>;
  const alert = Object.assign(new Alert(), { type: AlertType.Warning, message: 'Check this notice' });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlertComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '1' } } } },
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigate']) },
        { provide: AlertService, useValue: { getAlert: () => of(alert), getAlerts: () => of([]) } },
        { provide: ClientBuildInfoService, useValue: { getBuildInfo: () => of({ version: 'client-test' }) } },
        { provide: RpcService, useValue: { getResponderVersion$: () => of({ version: 'responder-test' }) } }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AlertComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a text label for the alert type', () => {
    expect(fixture.nativeElement.querySelector('.alert-kind').textContent.trim()).toBe('Warning');
  });
});
