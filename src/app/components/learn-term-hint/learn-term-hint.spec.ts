import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { LearnTermHint } from './learn-term-hint';

describe('LearnTermHint', () => {
  let fixture: ComponentFixture<LearnTermHint>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LearnTermHint],
    }).compileComponents();
    fixture = TestBed.createComponent(LearnTermHint);
  });

  it('opens inline popover in lab mode', () => {
    fixture.componentRef.setInput('term', 'model');
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    trigger.click();
    fixture.componentRef.setInput('activeId', 'model');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.learn-term-hint__popover')).toBeTruthy();
  });

  it('saves term to aside mode and disables saved mentions', () => {
    fixture.componentRef.setInput('term', 'model');
    fixture.componentRef.setInput('savedTerms', ['model']);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.learn-term-hint__saved')?.textContent).toContain('model');
    expect(fixture.nativeElement.querySelector('.learn-term-hint__popover')).toBeFalsy();
  });

  it('renders repeat mentions as plain text in aside mode', () => {
    fixture.componentRef.setInput('term', 'model');
    fixture.componentRef.setInput('savedTerms', []);
    fixture.componentRef.setInput('isPrimaryOccurrence', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button')).toBeFalsy();
    expect(fixture.nativeElement.querySelector('.learn-term-hint__plain')?.textContent).toContain('model');
  });

  it('emits termSelect in aside mode', () => {
    fixture.componentRef.setInput('term', 'loss');
    fixture.componentRef.setInput('savedTerms', []);
    fixture.componentRef.setInput('isPrimaryOccurrence', true);
    fixture.detectChanges();

    const emitted: string[] = [];
    fixture.componentInstance.termSelect.subscribe((term) => emitted.push(term));

    const trigger = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    trigger.click();

    expect(emitted).toEqual(['loss']);
  });
});
