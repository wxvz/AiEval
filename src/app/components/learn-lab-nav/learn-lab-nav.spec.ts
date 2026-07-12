import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getLesson } from '../../learn/curriculum';
import { LearnLabNav } from './learn-lab-nav';

describe('LearnLabNav', () => {
  let fixture: ComponentFixture<LearnLabNav>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LearnLabNav],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(LearnLabNav);
  });

  it('uses a parent lesson to navigate around an optional lab', () => {
    fixture.componentRef.setInput('lesson', getLesson('semantic-memory-lab'));
    fixture.componentRef.setInput('parent', getLesson('semantic-memory'));
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('a[href="/learn/lessons/semantic-memory"]')).toHaveLength(1);
    expect(el.querySelector('a[href="/learn/labs/semantic-search"]')).toBeTruthy();
  });

  it('emits completion from the sticky nav button', () => {
    fixture.componentRef.setInput('lesson', getLesson('semantic-search-lab'));
    const emitSpy = vi.spyOn(fixture.componentInstance.complete, 'emit');
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    expect(emitSpy).toHaveBeenCalledOnce();
  });
});
