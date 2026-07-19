import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import { ReinforcementLearningLabPage } from './reinforcement-learning-lab';

describe('ReinforcementLearningLabPage', () => {
  let fixture: ComponentFixture<ReinforcementLearningLabPage>;
  let page: ReinforcementLearningLabPage;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ReinforcementLearningLabPage],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(ReinforcementLearningLabPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders title and both café arms', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Reinforcement learning lab');
    expect(el.textContent).toContain('Known café');
    expect(el.textContent).toContain('New café');
  });

  it('links back to the reinforcement-learning read lesson', () => {
    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector(
      'a[href="/learn/lessons/reinforcement-learning"]',
    );
    expect(link).toBeTruthy();
  });

  it('shows success after exploring both arms and locking New café', () => {
    expect(fixture.nativeElement.textContent).not.toContain('Solved:');
    page.pull('known');
    page.pull('known');
    page.pull('new');
    page.pull('new');
    page.lockPolicy('new');
    fixture.detectChanges();
    expect(page.solved()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Solved:');
  });
});
