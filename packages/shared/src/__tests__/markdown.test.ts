import { describe, expect, it } from 'vitest';
import { parseDescription, validateDescription } from '../markdown';

describe('validateDescription', () => {
  it('rejects overly long text', () => {
    expect(validateDescription('a'.repeat(601))).toContain('too_long');
  });
});

describe('parseDescription', () => {
  it('splits paragraphs, breaks and lists', () => {
    expect(parseDescription('Hello **world**\nnext line\n\n- a\n- *b*')).toEqual([
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: 'Hello ' },
          { type: 'bold', value: 'world' },
          { type: 'break' },
          { type: 'text', value: 'next line' },
        ],
      },
      { type: 'list', items: [[{ type: 'text', value: 'a' }], [{ type: 'italic', value: 'b' }]] },
    ]);
  });
});
