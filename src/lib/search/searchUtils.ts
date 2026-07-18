/**
 * Deterministic search utility for material selection.
 *
 * A small collection of pure, stateless, framework-independent functions.
 * `rankOptions` is the single ranking implementation; `normalizeText` is the
 * single normalization implementation. No fuzzy matching.
 */

import type { MaterialOption } from './materialOption';

/**
 * Normalize text for matching only (never for display).
 *
 * - lowercases
 * - treats punctuation/separators ( . , - / ( ) ) as word boundaries
 * - collapses runs of whitespace and trims
 *
 * Locale-aware casing for multilingual names is intentionally out of Phase 1
 * scope (see spec §12); `toLowerCase` keeps output deterministic here.
 */
export function normalizeText(value: string): string {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(/[.,\-/()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Relevance tiers (lower = higher priority). NO_MATCH excludes the option. */
const Tier = {
  EXACT: 0,
  STARTS_WITH: 1,
  WORD_STARTS_WITH: 2,
  CONTAINS: 3,
  NO_MATCH: -1,
} as const;

/** Classify a candidate against the query. Private implementation detail. */
function computeTier(
  normalizedQuery: string,
  normalizedText: string,
  tokens: string[]
): number {
  if (normalizedText === normalizedQuery) return Tier.EXACT;
  if (normalizedText.startsWith(normalizedQuery)) return Tier.STARTS_WITH;
  if (tokens.some((token) => token.startsWith(normalizedQuery))) {
    return Tier.WORD_STARTS_WITH;
  }
  if (normalizedText.includes(normalizedQuery)) return Tier.CONTAINS;
  return Tier.NO_MATCH;
}

/**
 * Filter and deterministically order options by relevance to `query`.
 *
 * Order: Exact -> Starts-With -> Word-Starts-With -> Contains. Ties are broken
 * by earliest match index, then shorter label, then alphabetical, then id, so
 * the same inputs always yield the same order. An empty query returns all
 * options in their original order.
 *
 * The returned array references the existing MaterialOption objects; no new
 * options are created here.
 */
export function rankOptions(
  query: string,
  options: MaterialOption[]
): MaterialOption[] {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return options.slice();

  const ranked = [];
  for (const option of options) {
    const normalizedText = normalizeText(option.searchText);
    const tokens = normalizedText ? normalizedText.split(' ') : [];
    const tier = computeTier(normalizedQuery, normalizedText, tokens);
    if (tier === Tier.NO_MATCH) continue;
    ranked.push({
      option,
      tier,
      matchIndex: normalizedText.indexOf(normalizedQuery),
      label: option.label ?? '',
    });
  }

  ranked.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.matchIndex !== b.matchIndex) return a.matchIndex - b.matchIndex;
    if (a.label.length !== b.label.length) return a.label.length - b.label.length;
    const alpha = a.label.localeCompare(b.label);
    if (alpha !== 0) return alpha;
    return String(a.option.id).localeCompare(String(b.option.id));
  });

  return ranked.map((entry) => entry.option);
}
