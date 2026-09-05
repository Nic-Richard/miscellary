import type { ProfilePage } from '@miscellary/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import ProfileView from '@/components/ProfileView';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/endpoints';
import { ErrorText, Loading } from '@/components/ui';

export default function UserScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { loading } = useAuth();
  const [profile, setProfile] = useState<ProfilePage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    getProfile(username)
      .then(setProfile)
      .catch((e: Error) => setError(e.message));
  }, [username, loading]);

  if (error) return <ErrorText>{error}</ErrorText>;
  if (!profile) return <Loading />;
  return <ProfileView key={profile.username + String(profile.is_following)} profile={profile} />;
}
