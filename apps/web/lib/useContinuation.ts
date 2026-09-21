'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { CONTINUE_PARAM } from './returnTo';

export function useContinuation(
  action: string,
  run: (carried: URLSearchParams) => void,
  ready = true,
  carries: string[] = [],
): void {
  const pathname = usePathname();
  const router = useRouter();
  const done = useRef(false);
  const latest = useRef(run);
  latest.current = run;

  useEffect(() => {
    if (done.current || !ready) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get(CONTINUE_PARAM) !== action) return;
    done.current = true;
    const carried = new URLSearchParams(params.toString());
    const rest = new URLSearchParams(params.toString());
    rest.delete(CONTINUE_PARAM);
    for (const name of carries) rest.delete(name);
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    latest.current(carried);
  }, [action, carries, pathname, ready, router]);
}
