import { describe, expect, it } from 'vitest';

import { parseLessonText } from './parse-lesson-text';

describe('parseLessonText', () => {
  it('returns plain text when no markers', () => {
    expect(parseLessonText('Hello world')).toEqual([{ kind: 'text', text: 'Hello world' }]);
  });

  it('splits text around glossary terms', () => {
    expect(parseLessonText('An {{input}} and a {{target}}.')).toEqual([
      { kind: 'text', text: 'An ' },
      { kind: 'term', term: 'input' },
      { kind: 'text', text: ' and a ' },
      { kind: 'term', term: 'target' },
      { kind: 'text', text: '.' },
    ]);
  });

  it('leaves unknown markers as literal text', () => {
    expect(parseLessonText('See {{notARealTerm}} here.')).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'text', text: '{{notARealTerm}}' },
      { kind: 'text', text: ' here.' },
    ]);
  });

  it('marks **bold** spans without leaving asterisks', () => {
    expect(parseLessonText('Open the **Decision trees lab** next.')).toEqual([
      { kind: 'text', text: 'Open the ' },
      { kind: 'text', text: 'Decision trees lab', emphasis: 'bold' },
      { kind: 'text', text: ' next.' },
    ]);
  });

  it('marks *italic* spans without leaving asterisks', () => {
    expect(parseLessonText('Explaining *why* matters.')).toEqual([
      { kind: 'text', text: 'Explaining ' },
      { kind: 'text', text: 'why', emphasis: 'italic' },
      { kind: 'text', text: ' matters.' },
    ]);
  });

  it('keeps glossary terms inside bold spans', () => {
    expect(parseLessonText('Score the **{{rubric}}** carefully.')).toEqual([
      { kind: 'text', text: 'Score the ' },
      { kind: 'term', term: 'rubric', emphasis: 'bold' },
      { kind: 'text', text: ' carefully.' },
    ]);
  });

  it('prefers bold when ** and * could both match', () => {
    expect(parseLessonText('See **bold *not italic* still** here.')).toEqual([
      { kind: 'text', text: 'See ' },
      { kind: 'text', text: 'bold *not italic* still', emphasis: 'bold' },
      { kind: 'text', text: ' here.' },
    ]);
  });

  it('leaves unmatched asterisks as literal text', () => {
    expect(parseLessonText('Use rate * 2 for scaling.')).toEqual([
      { kind: 'text', text: 'Use rate * 2 for scaling.' },
    ]);
  });
});
