/**
 * Unit tests for the material combobox interaction helpers.
 *
 * Uses Node's built-in test runner (`node:test`) so no test framework is
 * required. Run with: `npm run test`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { nextHighlightIndex, resolveSearchQuery } from './comboboxNavigation.ts';

// ---------------------------------------------------------------------------
// nextHighlightIndex - opening the listbox (nothing highlighted yet)
// ---------------------------------------------------------------------------

test('nextHighlightIndex highlights the first option when opening downward', () => {
  assert.equal(nextHighlightIndex('first', -1, 5), 0);
});

test('nextHighlightIndex highlights the last option when opening upward', () => {
  assert.equal(nextHighlightIndex('last', -1, 5), 4);
});

test('nextHighlightIndex moves to the first option from nothing highlighted', () => {
  assert.equal(nextHighlightIndex('next', -1, 5), 0);
});

test('nextHighlightIndex moves to the last option from nothing highlighted', () => {
  assert.equal(nextHighlightIndex('previous', -1, 5), 4);
});

// ---------------------------------------------------------------------------
// nextHighlightIndex - arrow movement and wrapping
// ---------------------------------------------------------------------------

test('nextHighlightIndex advances on Arrow Down', () => {
  assert.equal(nextHighlightIndex('next', 0, 5), 1);
  assert.equal(nextHighlightIndex('next', 3, 5), 4);
});

test('nextHighlightIndex retreats on Arrow Up', () => {
  assert.equal(nextHighlightIndex('previous', 4, 5), 3);
  assert.equal(nextHighlightIndex('previous', 1, 5), 0);
});

test('nextHighlightIndex wraps from the last option to the first', () => {
  assert.equal(nextHighlightIndex('next', 4, 5), 0);
});

test('nextHighlightIndex wraps from the first option to the last', () => {
  assert.equal(nextHighlightIndex('previous', 0, 5), 4);
});

// ---------------------------------------------------------------------------
// nextHighlightIndex - Home / End and empty lists
// ---------------------------------------------------------------------------

test('nextHighlightIndex jumps to the first option on Home', () => {
  assert.equal(nextHighlightIndex('first', 3, 5), 0);
});

test('nextHighlightIndex jumps to the last option on End', () => {
  assert.equal(nextHighlightIndex('last', 1, 5), 4);
});

test('nextHighlightIndex clears the highlight when there are no options', () => {
  for (const action of ['first', 'last', 'next', 'previous'] as const) {
    assert.equal(nextHighlightIndex(action, 2, 0), -1);
  }
});

test('nextHighlightIndex stays put on a single-option list', () => {
  assert.equal(nextHighlightIndex('next', 0, 1), 0);
  assert.equal(nextHighlightIndex('previous', 0, 1), 0);
});

// ---------------------------------------------------------------------------
// resolveSearchQuery - the first keystroke replaces the committed label
// ---------------------------------------------------------------------------

test('resolveSearchQuery starts a new search on the first keystroke', () => {
  // Committed "CPVC Pipe", user presses "C": the browser reports "CPVC PipeC".
  assert.equal(resolveSearchQuery(false, 'CPVC Pipe', 'CPVC PipeC'), 'C');
});

test('resolveSearchQuery handles a keystroke inserted before the label', () => {
  assert.equal(resolveSearchQuery(false, 'CPVC Pipe', 'CCPVC Pipe'), 'C');
});

test('resolveSearchQuery clears the query when the label is wiped out', () => {
  assert.equal(resolveSearchQuery(false, 'CPVC Pipe', 'CPVC Pipe'), '');
  assert.equal(resolveSearchQuery(false, 'CPVC Pipe', ''), '');
});

test('resolveSearchQuery passes the raw value through once searching has started', () => {
  assert.equal(resolveSearchQuery(true, 'CPVC Pipe', 'CPV'), 'CPV');
  // Typed text that happens to extend the old label is still the literal query.
  assert.equal(resolveSearchQuery(true, 'CPVC Pipe', 'CPVC PipeC'), 'CPVC PipeC');
});

test('resolveSearchQuery passes the raw value through when nothing is committed', () => {
  assert.equal(resolveSearchQuery(false, '', 'C'), 'C');
});

test('resolveSearchQuery keeps a replacement that does not contain the label', () => {
  // Select-all then type: the label is gone entirely.
  assert.equal(resolveSearchQuery(false, 'CPVC Pipe', 'ste'), 'ste');
});

test('resolveSearchQuery preserves a multi-character paste', () => {
  assert.equal(resolveSearchQuery(false, 'CPVC Pipe', 'CPVC Pipeelbow'), 'elbow');
});
