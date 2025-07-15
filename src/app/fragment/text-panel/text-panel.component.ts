import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ModelContext } from '../../model/model-context';
import { Fragment } from '../../model/fragment';
import { distinctUntilChanged, Subject, takeUntil } from 'rxjs';

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
    private modelContext: ModelContext
  ) {}

ngOnInit(): void {
  console.log(`TextPanelComponent.ngOnInit`);

  this.modelContext.fragment$
    .pipe(
      distinctUntilChanged(),   // Optional: ensures it only updates if the fragment object actually changes
      takeUntil(this.destroy$)
    )
    .subscribe(fragment => {
      this.fragment = fragment;
      console.log(`TextPanelComponent: fragment: ${JSON.stringify(fragment)}`);
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
