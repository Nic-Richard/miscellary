'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { registerHref } from '@/lib/returnTo';

export function useRequireAccount(): void {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !user) {
      const here = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      router.replace(registerHref(here));
    }
  }, [loading, user, router]);
}
