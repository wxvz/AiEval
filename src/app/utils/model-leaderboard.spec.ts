import { DEFAULT_EVALUATION_CONFIG, Evaluation } from '../models';

import { computeModelLeaderboard, winnerLabelForEvaluation } from './model-leaderboard';

function evaluation(overrides: Partial<Evaluation> & Pick<Evaluation, 'id'>): Evaluation {
  return {
    title: 'Test',
    prompt: 'Prompt',
    criteriaMode: 'default',
    criteria: [],
    evaluationConfig: DEFAULT_EVALUATION_CONFIG,
    answers: [],
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
    ...overrides,
  };
}

describe('model-leaderboard', () => {
  it('returns empty leaderboard when there are no winners', () => {
    expect(
      computeModelLeaderboard([
        evaluation({
          id: '1',
          answers: [{ id: 'a1', evaluationId: '1', label: 'GPT-4', content: '', scores: [] }],
        }),
      ]),
    ).toEqual([]);
  });

  it('counts wins by winnerAnswerId label', () => {
    const entries = computeModelLeaderboard([
      evaluation({
        id: '1',
        winnerAnswerId: 'a1',
        answers: [{ id: 'a1', evaluationId: '1', label: 'GPT-4', content: '', scores: [] }],
      }),
      evaluation({
        id: '2',
        winnerAnswerId: 'a2',
        answers: [{ id: 'a2', evaluationId: '2', label: 'GPT-4', content: '', scores: [] }],
      }),
      evaluation({
        id: '3',
        winnerAnswerId: 'a3',
        answers: [{ id: 'a3', evaluationId: '3', label: 'Claude', content: '', scores: [] }],
      }),
    ]);

    expect(entries).toEqual([
      { rank: 1, label: 'GPT-4', winCount: 2 },
      { rank: 2, label: 'Claude', winCount: 1 },
    ]);
  });

  it('limits to top 3 and breaks ties alphabetically', () => {
    const entries = computeModelLeaderboard([
      evaluation({
        id: '1',
        winnerAnswerId: 'a',
        answers: [{ id: 'a', evaluationId: '1', label: 'Zeta', content: '', scores: [] }],
      }),
      evaluation({
        id: '2',
        winnerAnswerId: 'b',
        answers: [{ id: 'b', evaluationId: '2', label: 'Alpha', content: '', scores: [] }],
      }),
      evaluation({
        id: '3',
        winnerAnswerId: 'c',
        answers: [{ id: 'c', evaluationId: '3', label: 'Beta', content: '', scores: [] }],
      }),
      evaluation({
        id: '4',
        winnerAnswerId: 'd',
        answers: [{ id: 'd', evaluationId: '4', label: 'Gamma', content: '', scores: [] }],
      }),
      evaluation({
        id: '5',
        winnerAnswerId: 'e',
        answers: [{ id: 'e', evaluationId: '5', label: 'Delta', content: '', scores: [] }],
      }),
    ]);

    expect(entries.map((entry) => entry.label)).toEqual(['Alpha', 'Beta', 'Delta']);
  });

  it('uses isWinner when winnerAnswerId is missing', () => {
    const label = winnerLabelForEvaluation(
      evaluation({
        id: '1',
        answers: [
          { id: 'a1', evaluationId: '1', label: '  Llama  ', content: '', scores: [], isWinner: true },
        ],
      }),
    );

    expect(label).toBe('Llama');
  });
});
