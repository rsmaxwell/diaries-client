import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { ClientBuildInfoService } from '../../build-info/client-build-info.service';
import { RpcService } from '../../mqtt/rpc.service';
import { PlainfooterComponent } from './plainfooter.component';

describe('PlainfooterComponent', () => {
  let component: PlainfooterComponent;
  let fixture: ComponentFixture<PlainfooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlainfooterComponent],
      providers: [
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigate']) },
        { provide: ClientBuildInfoService, useValue: { getBuildInfo: () => of({ version: 'client-test' }) } },
        { provide: RpcService, useValue: { getResponderVersion$: () => of({ version: 'responder-test' }) } }
      ]
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
