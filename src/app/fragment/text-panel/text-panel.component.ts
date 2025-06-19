import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Fragment } from '../../model/fragment';
import { FragmentContextService } from '../fragment-context.service';
import { LiveObjectService } from '../../mqtt/live.object.service';
import { of, Subject, switchMap, takeUntil } from 'rxjs';

@Component({
  selector: 'app-text-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './text-panel.component.html',
  styleUrls: ['./text-panel.component.scss']
})
export class TextPanelComponent implements OnInit, OnDestroy {

  fragment: Fragment | null = null;

  constructor(
    private context: FragmentContextService,
    private liveObjectService: LiveObjectService
  ) { }

  private destroy$ = new Subject<void>();

  ngOnInit() {
    console.log(`TextPanelComponent.ngOnInit`);
    this.context.fragmentId$
      .pipe(
        switchMap(id => id ? this.liveObjectService.getFragmentById$(id) : of(null)),
        takeUntil(this.destroy$)
      )
      .subscribe(fragment => {
        this.fragment = fragment;
        console.log(`TextPanelComponent.ngOnInit: fragment: ${JSON.stringify(this.fragment)}`);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
