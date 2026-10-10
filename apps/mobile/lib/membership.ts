import { useEffect, useState } from 'react';
import type { Membership } from '@miscellary/shared';
import { apiFetch } from './api';
import { useAuth } from './auth';

export interface MembershipState {
  /** Memberships can be bought or used at all. */
  enabled: boolean;
  supporter: boolean;
}

const OFF: MembershipState = { enabled: false, supporter: false };
let cached: { userId: string; request: Promise<MembershipState> } | null = null;

export function refreshMembership() {
  cached = null;
}

// Shared by the nav, prompts and locked features, so the membership is fetched once per user.
export function useMembership(): MembershipState {
  const { user } = useAuth();
  const [state, setState] = useState<MembershipState>(OFF);
  useEffect(() => {
    if (!user) {
      setState(OFF);
      return;
    }
    if (!cached || cached.userId !== user.id) {
      cached = {
        userId: user.id,
        request: apiFetch<Membership>('/api/v1/me/membership/')
          .then((data) => ({ enabled: data.enabled, supporter: data.subscription.active }))
          .catch(() => OFF),
      };
    }
    let live = true;
    void cached.request.then((value) => {
      if (live) setState(value);
    });
    return () => {
      live = false;
    };
  }, [user]);
  return state;
}
