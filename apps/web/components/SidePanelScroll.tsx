'use client';

import { useEffect } from 'react';
import wide from './pageWide.module.css';

export default function SidePanelScroll() {
  useEffect(() => {
    const railClass = wide.scrollRail ?? '';
    if (!railClass) return;
    function onWheel(event: WheelEvent) {
      if (
        event.defaultPrevented ||
        !event.cancelable ||
        event.ctrlKey ||
        event.shiftKey ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
        !window.matchMedia('(min-width: 901px)').matches ||
        document.body.style.overflow === 'hidden' ||
        !(event.target instanceof Element)
      )
        return;

      const main = event.target.closest('main');
      const page = document.scrollingElement;
      if (!main || !page || event.target.closest('[role="dialog"]')) return;
      const delta =
        event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      const pageRoom = Math.max(0, page.scrollHeight - page.clientHeight - page.scrollTop);
      if (!delta || (delta > 0 ? delta <= pageRoom : pageRoom > 1)) return;

      for (
        let node: Element | null = event.target;
        node && node !== main;
        node = node.parentElement
      ) {
        if (node.classList.contains(railClass)) return;
        if (
          node.scrollHeight > node.clientHeight &&
          /auto|scroll/.test(getComputedStyle(node).overflowY)
        )
          return;
      }

      const rails = Array.from(main.querySelectorAll<HTMLElement>(`.${railClass}`)).filter(
        (rail) => rail.getClientRects().length && rail.scrollHeight > rail.clientHeight,
      );
      const remaining = delta > 0 ? delta - pageRoom : delta;
      const railRoom = Math.max(
        0,
        ...rails.map((rail) =>
          remaining > 0 ? rail.scrollHeight - rail.clientHeight - rail.scrollTop : rail.scrollTop,
        ),
      );
      if (!railRoom) return;

      // Native chaining runs child-to-parent, so the reverse handoff needs the unused wheel delta.
      event.preventDefault();
      const consumed = Math.sign(remaining) * Math.min(Math.abs(remaining), railRoom);
      for (const rail of rails) rail.scrollTop += consumed;
      page.scrollTop += delta > 0 ? pageRoom : delta - consumed;
    }

    document.addEventListener('wheel', onWheel, { passive: false });
    return () => document.removeEventListener('wheel', onWheel);
  }, []);

  return null;
}
