import Discussion from '@/components/lounge/Discussion';

export default async function LoungePostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Discussion postId={id} />;
}
