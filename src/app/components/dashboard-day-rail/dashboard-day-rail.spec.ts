import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EvaluationMonthGroup } from '../../utils/group-evaluations-by-month';
import { DashboardDayRail } from './dashboard-day-rail';

const months: EvaluationMonthGroup[] = [
  {
    monthKey: '2025-02',
    label: 'February 2025',
    days: [
      {
        dayKey: '2025-02-20',
        label: 'Thursday, Feb 20, 2025',
        compactLabel: 'Thu 20',
        evaluations: [],
      },
    ],
  },
  {
    monthKey: '2025-01',
    label: 'January 2025',
    days: [
      {
        dayKey: '2025-01-15',
        label: 'Wednesday, Jan 15, 2025',
        compactLabel: 'Wed 15',
        evaluations: [],
      },
    ],
  },
];

describe('DashboardDayRail', () => {
  let fixture: ComponentFixture<DashboardDayRail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardDayRail],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardDayRail);
    fixture.componentRef.setInput('months', months);
  });

  it('shows only the selected day month as open', () => {
    fixture.componentRef.setInput('selectedDayKey', '2025-01-15');
    fixture.detectChanges();

    const expandedButtons = fixture.nativeElement.querySelectorAll(
      '.day-rail__month-button[aria-expanded="true"]',
    );

    expect(expandedButtons).toHaveLength(1);
    expect(expandedButtons[0].textContent).toContain('January 2025');
    expect(fixture.nativeElement.textContent).toContain('Wed 15');
    expect(fixture.nativeElement.textContent).not.toContain('Thu 20');
  });

  it('moves the open accordion month when selection changes programmatically', () => {
    fixture.componentRef.setInput('selectedDayKey', '2025-02-20');
    fixture.detectChanges();
    fixture.componentRef.setInput('selectedDayKey', '2025-01-15');
    fixture.detectChanges();

    const expandedButton = fixture.nativeElement.querySelector(
      '.day-rail__month-button[aria-expanded="true"]',
    );

    expect(expandedButton.textContent).toContain('January 2025');
  });

  it('emits a day key when a date button is selected', () => {
    const selected: string[] = [];
    fixture.componentInstance.daySelected.subscribe((dayKey) => selected.push(dayKey));
    fixture.componentRef.setInput('selectedDayKey', '2025-02-20');
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.day-rail__day-button').click();

    expect(selected).toEqual(['2025-02-20']);
  });
});
