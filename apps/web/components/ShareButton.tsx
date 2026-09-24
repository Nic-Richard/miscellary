'use client';

import { useEffect, useRef, useState } from 'react';
import ui from './ui.module.css';

// Desktop browsers that implement navigator.share open an OS dialog most people
// never use there, so only touch devices get the share sheet.
function prefersShareSheet() {
  return typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

export default function ShareButton({ path, title }: { path: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    if (prefersShareSheet()) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link', url);
    }
  }

  return (
    <button
      type="button"
      className={`${ui.action} ${copied ? ui.actionOn : ''}`}
      aria-label={copied ? 'Link copied' : `Share ${title}`}
      onClick={() => void share()}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {copied ? (
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        ) : (
          <path d="M12 15V3.5M7.5 8 12 3.5 16.5 8M5 12v7.5h14V12" />
        )}
      </svg>
      <span aria-live="polite">{copied ? 'Link copied' : 'Share'}</span>
    </button>
  );
}
