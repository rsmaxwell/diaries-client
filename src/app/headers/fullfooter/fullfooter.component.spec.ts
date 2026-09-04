import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { ClientBuildInfoService } from '../../build-info/client-build-info.service';
import { RpcService } from '../../mqtt/rpc.service';
import { FullfooterComponent } from './fullfooter.component';

describe('FullfooterComponent', () => {
  let component: FullfooterComponent;
  let fixture: ComponentFixture<FullfooterComponent>;
  const router = jasmine.createSpyObj<Router>('Router', ['navigate']);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FullfooterComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ClientBuildInfoService, useValue: { getBuildInfo: () => of({ version: 'client-test' }) } },
        { provide: RpcService, useValue: { getResponderVersion$: () => of({ version: 'responder-test' }) } }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FullfooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps the application navigation actions available', () => {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const labels = buttons.map(button => button.getAttribute('aria-label'));

    expect(labels).toEqual(['Home', 'Diaries', 'Pages']);
  });
});
