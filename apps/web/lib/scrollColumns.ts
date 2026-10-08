export interface ScrollArea {
  scrollTop: number;
  readonly scrollHeight: number;
  readonly clientHeight: number;
}

function move(area: ScrollArea, delta: number) {
  const before = area.scrollTop;
  const top = Math.max(0, Math.min(area.scrollHeight - area.clientHeight, before + delta));
  if (top !== before) area.scrollTop = top;
  return delta - (top - before);
}

function moveTogether(areas: ScrollArea[], delta: number) {
  let consumed = 0;
  for (const area of areas) {
    const moved = delta - move(area, delta);
    if (Math.abs(moved) > Math.abs(consumed)) consumed = moved;
  }
  return delta - consumed;
}

export function scrollColumns(
  delta: number,
  page: ScrollArea,
  panels: ScrollArea[],
  hovered: ScrollArea | null,
) {
  let remaining = hovered ? move(hovered, delta) : delta;
  if (!hovered && remaining < 0 && page.scrollTop >= page.scrollHeight - page.clientHeight - 1) {
    remaining = moveTogether(panels, remaining);
  }
  remaining = move(page, remaining);
  moveTogether(
    panels.filter((panel) => panel !== hovered),
    remaining,
  );
}
