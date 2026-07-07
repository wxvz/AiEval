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
});
