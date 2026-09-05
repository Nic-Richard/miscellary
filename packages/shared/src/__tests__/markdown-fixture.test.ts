import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateDescription } from '../markdown';

// The same cases run against apps/api/cards/markdown.py so the two stay in step.
const cases = JSON.parse(
  readFileSync(new URL('../../fixtures/markdown-cases.json', import.meta.url), 'utf8'),
) as {
  input: string;
  issues: string[];
}[];

describe('markdown fixture cases', () => {
  for (const c of cases) {
    it(JSON.stringify(c.input), () => {
      expect(validateDescription(c.input)).toEqual(c.issues);
    });
  }
});
