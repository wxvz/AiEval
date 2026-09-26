import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { getLesson } from '../../learn/curriculum';
import { LearnProgressService } from '../../learn/learn-progress.service';
import { SettingsService } from '../../services/settings.service';
import { LearnLockedCallout } from './learn-locked-callout';

describe('LearnLockedCallout', () => {
  let fixture: ComponentFixture<LearnLockedCallout>;
  let progress: LearnProgressService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [LearnLockedCallout],
      providers: [provideRouter([])],
    }).compileComponents();
    progress = TestBed.inject(LearnProgressService);
    progress.clear();
    TestBed.inject(SettingsService).setLearnUnlockAll(false);
    fixture = TestBed.createComponent(LearnLockedCallout);
    fixture.componentRef.setInput('lesson', getLesson('neural-network-lab'));
  });

  it('shows callout and locks body when prerequisites are incomplete', () => {
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.learn-callout--muted')?.textContent).toContain(
      'Complete earlier lessons',
    );
    expect(el.querySelector('.learn-lab-body--locked')).toBeTruthy();
    const link = el.querySelector('.learn-back-link') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/learn/lessons/softmax-and-distributions');
  });

  it('hides callout and unlocks body when prerequisites are met', () => {
    localStorage.setItem('aieval-learn-progress', JSON.stringify(['softmax-and-distributions']));
    fixture = TestBed.createComponent(LearnLockedCallout);
    fixture.componentRef.setInput('lesson', getLesson('neural-network-lab'));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.learn-callout--muted')).toBeFalsy();
    expect(el.querySelector('.learn-lab-body--locked')).toBeFalsy();
  });
});
