import type { ProfilePage } from '@miscellary/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import ProfileView from '@/components/ProfileView';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/endpoints';
import { readPublicCache, writePublicCache } from '@/lib/publicCache';
import { ErrorText, Loading } from '@/components/ui';

export default function UserScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { loading, user } = useAuth();
  const [profile, setProfile] = useState<ProfilePage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const personalized = useRef(false);

  useEffect(() => {
    let active = true;
    const cacheKey = `profile:${username}`;
    setProfile(null);
    setError(null);
    personalized.current = false;
    void (async () => {
      const cached = await readPublicCache<ProfilePage>(cacheKey);
      if (!active) return;
      if (cached && !personalized.current) setProfile(cached);
      try {
        const next = await getProfile(username, false);
        void writePublicCache(cacheKey, next);
        if (active && !personalized.current) setProfile(next);
      } catch (e) {
        if (active && !cached && !personalized.current) {
          setError(e instanceof Error ? e.message : 'Could not load profile.');
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [username]);

  useEffect(() => {
    if (loading || !user) return;
    personalized.current = true;
    getProfile(username)
      .then((next) => {
        setProfile(next);
        setError(null);
      })
      .catch(() => undefined);
  }, [username, loading, user]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!profile) return <Loading />;
  return <ProfileView key={profile.username + String(profile.is_following)} profile={profile} />;
}
