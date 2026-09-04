import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { ClientBuildInfoService } from '../../build-info/client-build-info.service';
import { RpcService } from '../../mqtt/rpc.service';
import { PagefooterComponent } from './pagefooter.component';

describe('PagefooterComponent', () => {
  let component: PagefooterComponent;
  let fixture: ComponentFixture<PagefooterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PagefooterComponent],
      providers: [
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigate']) },
        { provide: ClientBuildInfoService, useValue: { getBuildInfo: () => of({ version: 'client-test' }) } },
        { provide: RpcService, useValue: { getResponderVersion$: () => of({ version: 'responder-test' }) } }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PagefooterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('preserves up, previous and next output semantics', () => {
    const up = spyOn(component.up, 'emit');
    const back = spyOn(component.back, 'emit');
    const forward = spyOn(component.forward, 'emit');

    component.onUpClick();
    component.onBackClick();
    component.onForwardClick();

    expect(up).toHaveBeenCalledOnceWith();
    expect(back).toHaveBeenCalledOnceWith();
    expect(forward).toHaveBeenCalledOnceWith();
  });

  it('gives every navigation button an accessible name', () => {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const labels = buttons.map(button => button.getAttribute('aria-label'));

    expect(labels).toEqual(['Home', 'Up to diary', 'Previous page', 'Next page']);
  });
});
