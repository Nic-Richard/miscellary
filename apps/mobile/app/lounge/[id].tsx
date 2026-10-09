import { useLocalSearchParams } from 'expo-router';
import { LoungeView } from '../lounge';

export default function LoungePostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <LoungeView postId={id} />;
}
