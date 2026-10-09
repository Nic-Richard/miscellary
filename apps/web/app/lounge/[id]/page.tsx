import LoungeView from '../LoungeClient';

export default async function LoungePostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LoungeView postId={id} />;
}
