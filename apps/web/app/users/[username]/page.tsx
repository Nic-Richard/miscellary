import ProfileClient from './ProfileClient';
import { getProfile } from '@/lib/social';
import { listPublicSets } from '@/lib/sets';

export const revalidate = 300;

export async function generateStaticParams() {
  const page = await listPublicSets('new');
  const usernames = new Set(page.results.map((set) => set.creator.username));
  return [...usernames].map((username) => ({ username }));
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getProfile(username);

  return <ProfileClient username={username} initialProfile={profile} />;
}
