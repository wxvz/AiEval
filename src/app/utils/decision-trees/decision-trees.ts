/**
 * Tiny ticket-routing tree for the Decision trees lab.
 * Pure TypeScript — no Angular imports.
 */

export type TicketLabel = 'billing' | 'access';
export type TicketFeature = 'mentionsRefund' | 'accountLocked';

export interface TicketRow {
  id: string;
  mentionsRefund: boolean;
  accountLocked: boolean;
  label: TicketLabel;
}

export interface TreeDraft {
  feature: TicketFeature | null;
  yesLabel: TicketLabel | null;
  noLabel: TicketLabel | null;
}

export const TICKET_ROWS: readonly TicketRow[] = [
  { id: 't1', mentionsRefund: true, accountLocked: false, label: 'billing' },
  { id: 't2', mentionsRefund: true, accountLocked: true, label: 'billing' },
  { id: 't3', mentionsRefund: false, accountLocked: true, label: 'access' },
  { id: 't4', mentionsRefund: false, accountLocked: false, label: 'access' },
];

/** Root feature that cleanly separates this toy table. */
export const TARGET_FEATURE: TicketFeature = 'mentionsRefund';

export const FEATURE_OPTIONS: readonly { id: TicketFeature; label: string }[] = [
  { id: 'mentionsRefund', label: 'Mentions refund?' },
  { id: 'accountLocked', label: 'Account locked?' },
];

export const LABEL_OPTIONS: readonly TicketLabel[] = ['billing', 'access'];

export function featureValue(row: TicketRow, feature: TicketFeature): boolean {
  return row[feature];
}

export function partitionRows(
  rows: readonly TicketRow[],
  feature: TicketFeature,
): { yes: TicketRow[]; no: TicketRow[] } {
  const yes: TicketRow[] = [];
  const no: TicketRow[] = [];
  for (const row of rows) {
    if (featureValue(row, feature)) {
      yes.push(row);
    } else {
      no.push(row);
    }
  }
  return { yes, no };
}

/** Predict using a one-split tree. */
export function predict(row: TicketRow, tree: TreeDraft): TicketLabel | null {
  if (!tree.feature || !tree.yesLabel || !tree.noLabel) {
    return null;
  }
  return featureValue(row, tree.feature) ? tree.yesLabel : tree.noLabel;
}

export function evaluateRows(
  rows: readonly TicketRow[],
  tree: TreeDraft,
): { row: TicketRow; prediction: TicketLabel | null; correct: boolean }[] {
  return rows.map((row) => {
    const prediction = predict(row, tree);
    return {
      row,
      prediction,
      correct: prediction === row.label,
    };
  });
}

export function accuracy(rows: readonly TicketRow[], tree: TreeDraft): number {
  if (!tree.feature || !tree.yesLabel || !tree.noLabel) {
    return 0;
  }
  const correct = evaluateRows(rows, tree).filter((entry) => entry.correct).length;
  return correct / rows.length;
}

export function isComplete(tree: TreeDraft): boolean {
  return tree.feature !== null && tree.yesLabel !== null && tree.noLabel !== null;
}

/**
 * Lab success: full accuracy on the toy table using the refund split
 * (the only root feature that separates labels cleanly here).
 */
export function isSolved(tree: TreeDraft, rows: readonly TicketRow[] = TICKET_ROWS): boolean {
  return (
    isComplete(tree) &&
    tree.feature === TARGET_FEATURE &&
    accuracy(rows, tree) === 1
  );
}
