import type { CardTextRules, CopyMarkup, TextRegionRules } from './api';

/* Mirrors the text rules in apps/api/cards/templates.py. A region shrinks to fit
   the width or the line budget it is given, down to its minimum scale, and the
   maximum length is the point past which even that would not fit. */
export const CARD_TEXT_RULES: Record<string, CardTextRules> = {
  classic: rules(30, 0.72, 'Caption', 92, 0.78, 2, 1, 'inline'),
  polaroid: rules(50, 0.72, null, 0, 1, 1, 2),
  minimal: rules(27, 0.72, 'Subtitle', 84, 0.78, 2, 1, 'inline'),
  bold: rules(30, 0.7, 'Subtitle', 100, 0.78, 2, 1, 'inline'),
  fieldnote: rules(30, 0.72, 'Printed note', 210, 0.78, 5, 1, 'block'),
};

function region(
  max_length: number,
  min_scale: number,
  lines: number,
  markup: CopyMarkup,
): TextRegionRules {
  return { max_length, min_scale, lines, markup };
}

function rules(
  titleMax: number,
  titleMinScale: number,
  printed_label: string | null = null,
  printedMax = 0,
  printedMinScale = 1,
  printedLines = 1,
  titleLines = 1,
  printedMarkup: CopyMarkup = 'none',
): CardTextRules {
  return {
    printed_label,
    title: region(titleMax, titleMinScale, titleLines, 'none'),
    printed: printed_label
      ? region(printedMax, printedMinScale, printedLines, printedMarkup)
      : null,
  };
}

export function cardTextRules(templateKey: string): CardTextRules {
  return CARD_TEXT_RULES[templateKey] ?? CARD_TEXT_RULES.classic!;
}
