/**
 * Unit tests for the material search utility.
 *
 * Uses Node's built-in test runner (`node:test`) so no test framework is
 * required. Run with: `npm run test`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizeText, rankOptions } from './searchUtils.ts';
import type { MaterialOption } from './materialOption.ts';

/** Build options from labels; searchText mirrors label (as the mapper does). */
function options(...labels: string[]): MaterialOption[] {
  return labels.map((label, index) => ({ id: index + 1, label, searchText: label }));
}

/** Convenience: rank and return only the labels, in order. */
function rankedLabels(query: string, opts: MaterialOption[]): string[] {
  return rankOptions(query, opts).map((o) => o.label);
}

// ---------------------------------------------------------------------------
// normalizeText
// ---------------------------------------------------------------------------

test('normalizeText lowercases', () => {
  assert.equal(normalizeText('CPVC Elbow'), 'cpvc elbow');
});

test('normalizeText collapses multiple spaces and trims', () => {
  assert.equal(normalizeText('  CPVC    ELBOW  '), 'cpvc elbow');
});

test('normalizeText treats punctuation and separators as boundaries', () => {
  assert.equal(normalizeText('C.P. SOCKET'), 'c p socket');
  assert.equal(normalizeText('TEE-REDUCER'), 'tee reducer');
  assert.equal(normalizeText('PIPE/JOINT'), 'pipe joint');
  assert.equal(normalizeText('PVC PIPE (NOS)'), 'pvc pipe nos');
});

test('normalizeText handles empty / nullish input', () => {
  assert.equal(normalizeText(''), '');
  assert.equal(normalizeText(undefined as unknown as string), '');
});

// ---------------------------------------------------------------------------
// rankOptions - tier ordering (the Issue #2 scenario)
// ---------------------------------------------------------------------------

test('rankOptions ranks the CPVC scenario deterministically', () => {
  const opts = options(
    'CPVC ELBOW',
    'PVC PIPE',
    'CPVC TEE',
    'C.P. SOCKET',
    'CPVC REDUCER'
  );
  // Query "CPVC": only the "CPVC *" prefix matches qualify (no fuzzy), ordered
  // by the shorter-label tie-break. "PVC PIPE" and "C.P. SOCKET" do not contain
  // "cpvc", so they are excluded entirely.
  assert.deepEqual(rankedLabels('CPVC', opts), [
    'CPVC TEE', // shortest label
    'CPVC ELBOW',
    'CPVC REDUCER', // longest label
  ]);
});

test('rankOptions puts an exact match first', () => {
  const opts = options('CPVC PIPE FITTING', 'CPVC', 'CPVC PIPE');
  assert.equal(rankedLabels('CPVC', opts)[0], 'CPVC');
});

test('rankOptions ranks starts-with above word-starts-with', () => {
  const opts = options('ASTM CPVC PIPE', 'HDPE CPVC', 'CPVC PIPE');
  assert.deepEqual(rankedLabels('CPVC', opts), [
    'CPVC PIPE', // starts-with (tier 1)
    'HDPE CPVC', // word-starts-with; same match index, shorter label wins
    'ASTM CPVC PIPE', // word-starts-with; longer label
  ]);
});

test('rankOptions matches a word start (word-starts-with tier)', () => {
  const opts = options('ASTM CPVC PIPE', 'PVC PIPE');
  assert.deepEqual(rankedLabels('CPVC', opts), ['ASTM CPVC PIPE']);
});

test('rankOptions matches a substring (contains tier)', () => {
  const opts = options('SUPERCPVCX', 'STEEL ROD');
  assert.deepEqual(rankedLabels('cpvc', opts), ['SUPERCPVCX']);
});

// ---------------------------------------------------------------------------
// rankOptions - normalization behaviour in matching
// ---------------------------------------------------------------------------

test('rankOptions is case insensitive', () => {
  const opts = options('Cpvc Elbow');
  assert.deepEqual(rankedLabels('CPVC', opts), ['Cpvc Elbow']);
});

test('rankOptions ignores extra spaces in the query', () => {
  const opts = options('CPVC ELBOW');
  assert.deepEqual(rankedLabels('  cpvc   elbow ', opts), ['CPVC ELBOW']);
});

test('rankOptions normalizes punctuation on both sides', () => {
  const opts = options('C.P. SOCKET', 'STEEL ROD');
  // Query "c.p" normalizes to "c p", which is a prefix of "c p socket".
  assert.deepEqual(rankedLabels('c.p', opts), ['C.P. SOCKET']);
});

// ---------------------------------------------------------------------------
// rankOptions - duplicates, empty query, no results
// ---------------------------------------------------------------------------

test('rankOptions keeps duplicate names as distinct options by id', () => {
  const opts: MaterialOption[] = [
    { id: 10, label: 'CPVC PIPE', searchText: 'CPVC PIPE' },
    { id: 22, label: 'CPVC PIPE', searchText: 'CPVC PIPE' },
  ];
  const result = rankOptions('CPVC', opts);
  assert.equal(result.length, 2);
  assert.deepEqual(
    result.map((o) => o.id),
    [10, 22]
  );
});

test('rankOptions returns all options in original order for an empty query', () => {
  const opts = options('CPVC ELBOW', 'PVC PIPE', 'CPVC TEE');
  assert.deepEqual(rankedLabels('', opts), ['CPVC ELBOW', 'PVC PIPE', 'CPVC TEE']);
  assert.deepEqual(rankedLabels('   ', opts), [
    'CPVC ELBOW',
    'PVC PIPE',
    'CPVC TEE',
  ]);
});

test('rankOptions returns an empty array when nothing matches', () => {
  const opts = options('CPVC ELBOW', 'PVC PIPE');
  assert.deepEqual(rankOptions('zzz', opts), []);
});

test('rankOptions does not mutate the input array', () => {
  const opts = options('B ITEM', 'A ITEM');
  const snapshot = opts.map((o) => o.label);
  rankOptions('item', opts);
  assert.deepEqual(
    opts.map((o) => o.label),
    snapshot
  );
});
