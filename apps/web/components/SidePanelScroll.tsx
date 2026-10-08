'use client';

import { useEffect } from 'react';
import { scrollColumns } from '@/lib/scrollColumns';
import wide from './pageWide.module.css';

export default function SidePanelScroll() {
  useEffect(() => {
    const railClass = wide.scrollRail ?? '';
    const layoutClass = wide.layout ?? '';
    if (!railClass || !layoutClass) return;
    const desktop = window.matchMedia('(min-width: 901px)');
    function onWheel(event: WheelEvent) {
      if (
        event.defaultPrevented ||
        !event.cancelable ||
        event.ctrlKey ||
        event.shiftKey ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
        !desktop.matches ||
        document.body.style.overflow === 'hidden' ||
        !(event.target instanceof Element)
      )
        return;

      const target = document.elementFromPoint(event.clientX, event.clientY) ?? event.target;
      const layout = target.closest(`.${layoutClass}`);
      const page = document.scrollingElement;
      if (!layout || !page || target.closest('[role="dialog"]')) return;
      const delta =
        event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      if (!delta) return;

      for (let node: Element | null = target; node && node !== layout; node = node.parentElement) {
        if (node.classList.contains(railClass)) break;
        if (
          node.scrollHeight > node.clientHeight &&
          /auto|scroll/.test(getComputedStyle(node).overflowY)
        )
          return;
      }

      const rails = Array.from(layout.querySelectorAll<HTMLElement>(`.${railClass}`)).filter(
        (rail) => rail.getClientRects().length && rail.scrollHeight > rail.clientHeight,
      );
      if (!rails.length) return;
      const hovered = target.closest<HTMLElement>(`.${railClass}`);

      // Keep each wheel event under the pointer; native scroll latching delays edge handoffs and reversals.
      event.preventDefault();
      scrollColumns(delta, page, rails, hovered);
    }

    document.addEventListener('wheel', onWheel, { passive: false });
    return () => document.removeEventListener('wheel', onWheel);
  }, []);

  return null;
}
