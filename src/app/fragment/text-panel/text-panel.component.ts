import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FragmentContextService } from '../fragment-context.service';
import { LiveObjectService } from '../../mqtt/live.object.service';
import { Fragment } from '../../model/fragment';
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

  private destroy$ = new Subject<void>();

  constructor(
    private context: FragmentContextService,
    private liveObjectService: LiveObjectService
  ) {}

  ngOnInit(): void {
    console.log(`TextPanelComponent.ngOnInit`);
    this.context.fragmentId$
      .pipe(
        switchMap(id => id ? this.liveObjectService.getFragmentById$(id) : of(null)),
        takeUntil(this.destroy$)
      )
      .subscribe(fragment => {
        this.fragment = fragment;
        // console.log(`TextPanelComponent: fragment:`, fragment);
      });
  }

  get formattedDate(): string {
    if (!this.fragment) return '';
    const y = this.fragment.year || 0;
    const m = this.fragment.month || 0;
    const d = this.fragment.day || 0;
    return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
