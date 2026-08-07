/**
 * Pure SM-2 (Anki-style) scheduling helpers.
 *
 * Kept as a dependency-free module so it can be unit-tested without
 * Angular DI or Firebase. The state machine below implements a
 * simplified SuperMemo-2 with four ratings:
 *
 * - again:  reset interval/reps, ease -0.2 (min 1.3), lapses +1, due today
 * - hard:   conservative interval growth, ease -0.15 (min 1.3)
 * - good:   standard growth 1 -> 6 -> round(interval * ease)
 * - easy:   faster growth, ease +0.15 (max 3.0)
 */

import type { ReviewRating, ReviewState } from '../models/phrase.model';

export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;
const DAY_MS = 86_400_000;

/** Truncates a timestamp to the start of its day (local time). */
export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Adds whole days to a timestamp, preserving the start-of-day truncation. */
export function addDays(ts: number, days: number): number {
  return startOfDay(ts) + days * DAY_MS;
}

/** Creates the initial state for a chunk that has never been scheduled. */
export function initialReview(now = Date.now()): ReviewState {
  return { ease: 2.5, interval: 0, reps: 0, lapses: 0, due: startOfDay(now) };
}

/**
 * Computes the next review state from the current one given a rating.
 * `now` is injectable for tests.
 */
export function nextState(review: ReviewState, rating: ReviewRating, now = Date.now()): ReviewState {
  const today = startOfDay(now);

  switch (rating) {
    case 'again': {
      return {
        ease: Math.max(MIN_EASE, review.ease - 0.2),
        interval: 0,
        reps: 0,
        lapses: review.lapses + 1,
        due: today,
      };
    }
    case 'hard': {
      const interval = review.interval === 0 ? 1 : Math.max(1, Math.round(review.interval * 1.2));
      return {
        ease: Math.max(MIN_EASE, review.ease - 0.15),
        interval,
        reps: review.reps + 1,
        lapses: review.lapses,
        due: addDays(today, interval),
      };
    }
    case 'good': {
      const interval = nextGoodInterval(review.interval, review.ease);
      return {
        ease: review.ease,
        interval,
        reps: review.reps + 1,
        lapses: review.lapses,
        due: addDays(today, interval),
      };
    }
    case 'easy': {
      const interval = review.interval === 0 ? 2 : Math.round(review.interval * review.ease * 1.3);
      return {
        ease: Math.min(MAX_EASE, review.ease + 0.15),
        interval,
        reps: review.reps + 1,
        lapses: review.lapses,
        due: addDays(today, interval),
      };
    }
  }
}

/** Standard SM-2 good-path growth: 1 -> 6 -> round(interval * ease). */
function nextGoodInterval(interval: number, ease: number): number {
  if (interval === 0) {
    return 1;
  }
  if (interval === 1) {
    return 6;
  }
  return Math.round(interval * ease);
}
