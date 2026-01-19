/**
 * Fuzzy Search Utility
 * Provides fuzzy matching functionality for schema search
 */

export interface FuzzyMatchResult {
  /** Match score from 0 to 1 (higher is better) */
  score: number;
  /** Indices where the query matched in the target [start, end] pairs */
  matchIndices: [number, number][];
}

/**
 * Performs fuzzy matching between a query and a target string.
 * Returns a score (0-1) and the indices where matches occurred.
 *
 * Scoring priorities:
 * 1. Exact match (highest)
 * 2. Starts with query
 * 3. Contains exact query
 * 4. Word boundary matches
 * 5. Character sequence match (fuzzy)
 */
export function fuzzyMatch(query: string, target: string): FuzzyMatchResult {
  if (!query || !target) {
    return { score: 0, matchIndices: [] };
  }

  const lowerQuery = query.toLowerCase();
  const lowerTarget = target.toLowerCase();

  // Exact match
  if (lowerTarget === lowerQuery) {
    return {
      score: 1.0,
      matchIndices: [[0, target.length]],
    };
  }

  // Starts with query
  if (lowerTarget.startsWith(lowerQuery)) {
    return {
      score: 0.9,
      matchIndices: [[0, query.length]],
    };
  }

  // Contains exact query
  const exactIndex = lowerTarget.indexOf(lowerQuery);
  if (exactIndex !== -1) {
    // Bonus if at word boundary
    const isWordBoundary =
      exactIndex === 0 ||
      !isAlphanumeric(target[exactIndex - 1]) ||
      isUpperCase(target[exactIndex]);
    return {
      score: isWordBoundary ? 0.8 : 0.7,
      matchIndices: [[exactIndex, exactIndex + query.length]],
    };
  }

  // Character sequence match (fuzzy)
  const matchResult = fuzzyCharacterMatch(lowerQuery, lowerTarget, target);
  return matchResult;
}

/**
 * Performs character-by-character fuzzy matching.
 * Characters must appear in order but don't need to be consecutive.
 */
function fuzzyCharacterMatch(
  query: string,
  lowerTarget: string,
  originalTarget: string
): FuzzyMatchResult {
  let queryIndex = 0;
  let targetIndex = 0;
  let score = 0;
  const matchIndices: [number, number][] = [];
  let consecutiveMatches = 0;
  let lastMatchIndex = -1;
  let matchedChars = 0;

  while (queryIndex < query.length && targetIndex < lowerTarget.length) {
    if (query[queryIndex] === lowerTarget[targetIndex]) {
      // Found a match
      const isConsecutive = targetIndex === lastMatchIndex + 1;
      const isWordBoundary =
        targetIndex === 0 ||
        !isAlphanumeric(originalTarget[targetIndex - 1]) ||
        isUpperCase(originalTarget[targetIndex]);

      // Score bonuses
      if (isConsecutive) {
        consecutiveMatches++;
        score += 0.15 + consecutiveMatches * 0.05; // Bonus for consecutive matches
      } else {
        consecutiveMatches = 0;
        score += isWordBoundary ? 0.1 : 0.05;
      }

      // Merge with previous match if consecutive, otherwise add new
      if (
        isConsecutive &&
        matchIndices.length > 0 &&
        matchIndices[matchIndices.length - 1][1] === targetIndex
      ) {
        matchIndices[matchIndices.length - 1][1] = targetIndex + 1;
      } else {
        matchIndices.push([targetIndex, targetIndex + 1]);
      }

      lastMatchIndex = targetIndex;
      matchedChars++;
      queryIndex++;
    }
    targetIndex++;
  }

  // Did we match all query characters?
  if (queryIndex < query.length) {
    return { score: 0, matchIndices: [] };
  }

  // Normalize score based on:
  // - Percentage of target matched
  // - Query length vs target length (prefer shorter targets)
  const lengthRatio = Math.min(query.length / lowerTarget.length, 1);
  const coverageBonus = matchedChars / lowerTarget.length;
  const finalScore = Math.min(
    (score / query.length) * 0.5 + lengthRatio * 0.3 + coverageBonus * 0.2,
    0.6 // Cap fuzzy matches below exact/prefix/contains matches
  );

  return {
    score: finalScore,
    matchIndices,
  };
}

/**
 * Search and filter items using fuzzy matching
 */
export function fuzzySearch<T>(
  items: T[],
  query: string,
  getSearchText: (item: T) => string,
  minScore: number = 0.05
): Array<T & { matchScore: number; matchIndices: [number, number][] }> {
  if (!query.trim()) {
    return items.map((item) => ({
      ...item,
      matchScore: 1,
      matchIndices: [],
    }));
  }

  const results: Array<
    T & { matchScore: number; matchIndices: [number, number][] }
  > = [];

  for (const item of items) {
    const text = getSearchText(item);
    const { score, matchIndices } = fuzzyMatch(query, text);

    if (score >= minScore) {
      results.push({
        ...item,
        matchScore: score,
        matchIndices,
      });
    }
  }

  // Sort by score (highest first)
  return results.sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Highlight matched portions of text
 */
export function highlightMatches(
  text: string,
  matchIndices: [number, number][]
): Array<{ text: string; isMatch: boolean }> {
  if (matchIndices.length === 0) {
    return [{ text, isMatch: false }];
  }

  const parts: Array<{ text: string; isMatch: boolean }> = [];
  let lastIndex = 0;

  // Sort and merge overlapping indices
  const sortedIndices = [...matchIndices].sort((a, b) => a[0] - b[0]);
  const mergedIndices: [number, number][] = [];

  for (const [start, end] of sortedIndices) {
    if (
      mergedIndices.length > 0 &&
      start <= mergedIndices[mergedIndices.length - 1][1]
    ) {
      mergedIndices[mergedIndices.length - 1][1] = Math.max(
        mergedIndices[mergedIndices.length - 1][1],
        end
      );
    } else {
      mergedIndices.push([start, end]);
    }
  }

  for (const [start, end] of mergedIndices) {
    if (start > lastIndex) {
      parts.push({ text: text.slice(lastIndex, start), isMatch: false });
    }
    parts.push({ text: text.slice(start, end), isMatch: true });
    lastIndex = end;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isMatch: false });
  }

  return parts;
}

// Helper functions
function isAlphanumeric(char: string | undefined): boolean {
  if (!char) return false;
  return /[a-zA-Z0-9]/.test(char);
}

function isUpperCase(char: string | undefined): boolean {
  if (!char) return false;
  return char === char.toUpperCase() && char !== char.toLowerCase();
}
