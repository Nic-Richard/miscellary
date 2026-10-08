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
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0;
    let pending = 0;
    let lastTime = 0;
    let active: {
      layout: Element;
      page: Element;
      rails: HTMLElement[];
      hovered: HTMLElement | null;
    } | null = null;

    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      pending = 0;
      active = null;
    }

    function tick(time: number) {
      if (
        !active?.layout.isConnected ||
        !desktop.matches ||
        document.body.style.overflow === 'hidden'
      ) {
        stop();
        return;
      }
      const elapsed = Math.min(40, Math.max(1, time - lastTime));
      lastTime = time;
      // Whole-pixel steps avoid losing distance when browsers round scrollTop writes.
      const eased = Math.trunc(pending * (1 - Math.exp(-elapsed / 55)));
      const step = Math.abs(pending) < 1 ? pending : eased || Math.sign(pending);
      pending -= step;
      scrollColumns(step, active.page, active.rails, active.hovered);
      if (pending) frame = requestAnimationFrame(tick);
      else stop();
    }

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
      ) {
        stop();
        return;
      }

      const target = document.elementFromPoint(event.clientX, event.clientY) ?? event.target;
      const layout = target.closest(`.${layoutClass}`);
      const page = document.scrollingElement;
      if (!layout || !page || target.closest('[role="dialog"]')) {
        stop();
        return;
      }
      const delta =
        event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1);
      if (!delta) return;

      for (let node: Element | null = target; node && node !== layout; node = node.parentElement) {
        if (node.classList.contains(railClass)) break;
        if (
          node.scrollHeight > node.clientHeight &&
          /auto|scroll/.test(getComputedStyle(node).overflowY)
        ) {
          stop();
          return;
        }
      }

      const rails = Array.from(layout.querySelectorAll<HTMLElement>(`.${railClass}`)).filter(
        (rail) => rail.getClientRects().length && rail.scrollHeight > rail.clientHeight,
      );
      if (!rails.length) {
        stop();
        return;
      }
      const hovered = target.closest<HTMLElement>(`.${railClass}`);

      // Keep each wheel event under the pointer; native scroll latching delays edge handoffs and reversals.
      event.preventDefault();
      if (reducedMotion.matches) {
        stop();
        scrollColumns(delta, page, rails, hovered);
        return;
      }
      if (active?.layout !== layout || active?.hovered !== hovered || pending * delta < 0) stop();
      active = { layout, page, rails, hovered };
      pending += delta;
      if (!frame) {
        lastTime = performance.now();
        frame = requestAnimationFrame(tick);
      }
    }

    document.addEventListener('wheel', onWheel, { passive: false });
    document.addEventListener('pointerdown', stop, true);
    document.addEventListener('keydown', stop, true);
    window.addEventListener('resize', stop);
    reducedMotion.addEventListener('change', stop);
    return () => {
      stop();
      document.removeEventListener('wheel', onWheel);
      document.removeEventListener('pointerdown', stop, true);
      document.removeEventListener('keydown', stop, true);
      window.removeEventListener('resize', stop);
      reducedMotion.removeEventListener('change', stop);
    };
  }, []);

  return null;
}
