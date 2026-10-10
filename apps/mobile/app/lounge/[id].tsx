import { useLocalSearchParams } from 'expo-router';
import Discussion from '@/components/lounge/Discussion';

export default function LoungePostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Discussion key={id} postId={id} />;
}
