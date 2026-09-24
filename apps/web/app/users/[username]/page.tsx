import type { Metadata } from 'next';
import { cache } from 'react';
import { profilePath } from '@miscellary/shared';
import ProfileClient from './ProfileClient';
import { snippet } from '@/lib/seo';
import { getProfile } from '@/lib/social';
import { listPublicSets } from '@/lib/sets';

const loadProfile = cache((username: string) => getProfile(username));

export const revalidate = 300;

export async function generateStaticParams() {
  const page = await listPublicSets('new');
  const usernames = new Set(page.results.map((set) => set.creator.username));
  return [...usernames].map((username) => ({ username }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await loadProfile(username).catch(() => null);
  if (!profile) return { title: 'Collector not found', robots: { index: false } };
  const name = profile.display_name || profile.username;
  const title = `${name} (@${profile.username})`;
  const description = profile.bio
    ? snippet(profile.bio)
    : `${name} has published ${profile.set_count} ${profile.set_count === 1 ? 'set' : 'sets'} on Miscellary.`;
  return {
    title,
    description,
    alternates: { canonical: profilePath(profile.username) },
    openGraph: { title, description, url: profilePath(profile.username), type: 'profile' },
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await loadProfile(username);

  return <ProfileClient username={username} initialProfile={profile} />;
}
