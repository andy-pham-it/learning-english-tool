import {
  MIN_EASE,
  MAX_EASE,
  addDays,
  initialReview,
  nextState,
  startOfDay,
} from './sm2.util';

describe('sm2.util', () => {
  const NOW = new Date(2026, 7, 7, 15, 30).getTime(); // Fri Aug 7 2026

  it('startOfDay truncates to local midnight', () => {
    expect(startOfDay(NOW)).toBe(new Date(2026, 7, 7).getTime());
  });

  it('addDays preserves start-of-day', () => {
    expect(addDays(NOW, 6)).toBe(new Date(2026, 7, 13).getTime());
    expect(addDays(NOW, 0)).toBe(startOfDay(NOW));
  });

  it('initialReview has default ease 2.5 and is due today', () => {
    const r = initialReview(NOW);
    expect(r.ease).toBe(2.5);
    expect(r.interval).toBe(0);
    expect(r.reps).toBe(0);
    expect(r.lapses).toBe(0);
    expect(r.due).toBe(startOfDay(NOW));
  });

  describe('good path', () => {
    it('grows interval 1 -> 6 -> round(interval*ease)', () => {
      const first = nextState(initialReview(NOW), 'good', NOW);
      expect(first.interval).toBe(1);
      expect(first.due).toBe(addDays(NOW, 1));

      const second = nextState(first, 'good', NOW);
      expect(second.interval).toBe(6);
      expect(second.due).toBe(addDays(NOW, 6));

      const third = nextState(second, 'good', NOW);
      expect(third.interval).toBe(Math.round(6 * second.ease));
    });

    it('keeps ease unchanged and increments reps', () => {
      const next = nextState(initialReview(NOW), 'good', NOW);
      expect(next.ease).toBe(2.5);
      expect(next.reps).toBe(1);
      expect(next.lapses).toBe(0);
    });
  });

  describe('again path', () => {
    it('resets interval/reps, bumps lapses, lowers ease by 0.2, due today', () => {
      const reviewed: Parameters<typeof nextState>[0] = {
        ease: 2.5,
        interval: 21,
        reps: 5,
        lapses: 0,
        due: addDays(NOW, -1),
      };
      const next = nextState(reviewed, 'again', NOW);
      expect(next.interval).toBe(0);
      expect(next.reps).toBe(0);
      expect(next.lapses).toBe(1);
      expect(next.ease).toBe(2.3);
      expect(next.due).toBe(startOfDay(NOW));
    });

    it('never drops ease below MIN_EASE', () => {
      const next = nextState({ ease: 1.4, interval: 3, reps: 2, lapses: 4, due: NOW }, 'again', NOW);
      expect(next.ease).toBe(MIN_EASE);
    });
  });

  describe('hard path', () => {
    it('grows conservatively (interval * 1.2) and lowers ease by 0.15', () => {
      const reviewed = { ease: 2.5, interval: 10, reps: 3, lapses: 0, due: NOW };
      const next = nextState(reviewed, 'hard', NOW);
      expect(next.interval).toBe(Math.round(10 * 1.2));
      expect(next.ease).toBe(2.35);
      expect(next.due).toBe(addDays(NOW, next.interval));
    });

    it('first hard review yields interval 1', () => {
      const next = nextState(initialReview(NOW), 'hard', NOW);
      expect(next.interval).toBe(1);
    });
  });

  describe('easy path', () => {
    it('grows fast (interval * ease * 1.3) and raises ease by 0.15', () => {
      const reviewed = { ease: 2.5, interval: 10, reps: 3, lapses: 0, due: NOW };
      const next = nextState(reviewed, 'easy', NOW);
      expect(next.interval).toBe(Math.round(10 * 2.5 * 1.3));
      expect(next.ease).toBe(2.65);
    });

    it('first easy review yields interval 2', () => {
      const next = nextState(initialReview(NOW), 'easy', NOW);
      expect(next.interval).toBe(2);
    });

    it('never exceeds MAX_EASE', () => {
      const next = nextState({ ease: 2.95, interval: 1, reps: 1, lapses: 0, due: NOW }, 'easy', NOW);
      expect(next.ease).toBe(MAX_EASE);
    });
  });
});
