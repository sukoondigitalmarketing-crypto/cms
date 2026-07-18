/**
 * Pure interaction helpers for the material combobox (Phase 2 UX).
 *
 * These functions own the UI-only state transitions — listbox highlight
 * movement and first-keystroke query resolution. They are deliberately free of
 * React and the DOM so the keyboard contract can be unit tested directly.
 *
 * Ranking, filtering and normalization remain the sole responsibility of
 * `searchUtils`; nothing here inspects or reorders options.
 */

/** Highlight movements the listbox supports. */
export type HighlightAction = 'first' | 'last' | 'next' | 'previous';

/**
 * Compute the next highlighted option index.
 *
 * `currentIndex` of -1 means "nothing highlighted". Movement wraps at both
 * ends, and an empty list always resolves to -1. Highlighting is never
 * selection — committing stays an explicit user action.
 */
export function nextHighlightIndex(
  action: HighlightAction,
  currentIndex: number,
  count: number
): number {
  if (count <= 0) return -1;

  switch (action) {
    case 'first':
      return 0;
    case 'last':
      return count - 1;
    case 'next':
      return currentIndex < 0 || currentIndex >= count - 1 ? 0 : currentIndex + 1;
    case 'previous':
      return currentIndex <= 0 ? count - 1 : currentIndex - 1;
    default:
      return -1;
  }
}

/**
 * Resolve the search query from a raw input value.
 *
 * While a value is committed the input displays that label, so the browser
 * reports the first keystroke as `label + char`. Until the user has started
 * searching, the committed label is stripped so the first keystroke begins a
 * fresh query ("CPVC Pipe" + "C" -> "C", never "CPVC PipeC"). Once searching
 * has started the raw input value is the query, untouched.
 */
export function resolveSearchQuery(
  hasStartedSearch: boolean,
  committedLabel: string,
  inputValue: string
): string {
  if (hasStartedSearch || !committedLabel) return inputValue;

  if (inputValue.startsWith(committedLabel)) {
    return inputValue.slice(committedLabel.length);
  }
  if (inputValue.endsWith(committedLabel)) {
    return inputValue.slice(0, inputValue.length - committedLabel.length);
  }
  return inputValue;
}
