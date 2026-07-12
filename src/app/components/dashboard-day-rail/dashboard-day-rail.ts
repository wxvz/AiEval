import { Component, effect, input, output, signal } from '@angular/core';

import { EvaluationMonthGroup } from '../../utils/group-evaluations-by-month';

@Component({
  selector: 'app-dashboard-day-rail',
  templateUrl: './dashboard-day-rail.html',
  styleUrl: './dashboard-day-rail.css',
})
export class DashboardDayRail {
  readonly months = input<EvaluationMonthGroup[]>([]);
  readonly selectedDayKey = input<string | null>(null);
  readonly daySelected = output<string>();

  protected readonly openMonthKey = signal<string | null>(null);

  constructor() {
    effect(() => {
      const months = this.months();
      const selectedDayKey = this.selectedDayKey();
      const selectedMonth = months.find((month) =>
        month.days.some((day) => day.dayKey === selectedDayKey),
      );

      if (selectedMonth) {
        this.openMonthKey.set(selectedMonth.monthKey);
      } else if (!this.openMonthKey() && months.length > 0) {
        this.openMonthKey.set(months[0].monthKey);
      }
    });
  }

  protected toggleMonth(monthKey: string): void {
    this.openMonthKey.update((openMonthKey) => (openMonthKey === monthKey ? null : monthKey));
  }

  protected selectDay(dayKey: string): void {
    this.daySelected.emit(dayKey);
  }
}
