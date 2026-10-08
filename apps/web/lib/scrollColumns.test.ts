import { describe, expect, it } from 'vitest';
import { scrollColumns } from './scrollColumns';

const area = (scrollTop: number, max: number) => ({
  scrollTop,
  clientHeight: 100,
  scrollHeight: max + 100,
});

describe('column scrolling', () => {
  it('passes the page boundary remainder to both panels, then unwinds them on reversal', () => {
    const page = area(950, 1000);
    const panels = [area(0, 400), area(0, 200)];
    scrollColumns(160, page, panels, null);
    expect([page.scrollTop, ...panels.map((panel) => panel.scrollTop)]).toEqual([1000, 110, 110]);
    scrollColumns(-160, page, panels, null);
    expect([page.scrollTop, ...panels.map((panel) => panel.scrollTop)]).toEqual([950, 0, 0]);
  });

  it('immediately returns to the hovered panel when direction changes after a page handoff', () => {
    const page = area(100, 1000);
    const panels = [area(390, 400), area(0, 200)];
    scrollColumns(70, page, panels, panels[0]!);
    expect([page.scrollTop, ...panels.map((panel) => panel.scrollTop)]).toEqual([160, 400, 0]);
    scrollColumns(-30, page, panels, panels[0]!);
    expect([page.scrollTop, ...panels.map((panel) => panel.scrollTop)]).toEqual([160, 370, 0]);
    scrollColumns(-500, page, panels, panels[0]!);
    expect([page.scrollTop, ...panels.map((panel) => panel.scrollTop)]).toEqual([30, 0, 0]);
  });

  it('hands off between unequal panels at both page edges without multiplying the remainder', () => {
    for (const direction of [-1, 1]) {
      const page = area(direction > 0 ? 1000 : 0, 1000);
      const panels = [area(direction > 0 ? 390 : 10, 400), area(direction > 0 ? 0 : 200, 200)];
      scrollColumns(direction * 70, page, panels, panels[0]!);
      expect(panels.map((panel) => panel.scrollTop)).toEqual(direction > 0 ? [400, 60] : [0, 140]);
      scrollColumns(direction * 10000, page, panels, panels[0]!);
      expect(panels.map((panel) => panel.scrollTop)).toEqual(direction > 0 ? [400, 200] : [0, 0]);
      expect(page.scrollTop).toBe(direction > 0 ? 1000 : 0);
    }
  });
});
