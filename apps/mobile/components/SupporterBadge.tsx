import Feather from '@expo/vector-icons/Feather';
import { useColors } from '@/lib/theme';

export default function SupporterBadge() {
  const colors = useColors();
  return (
    <Feather
      name="star"
      size={16}
      color={colors.accent}
      accessible
      accessibilityLabel="Monthly member"
    />
  );
}
