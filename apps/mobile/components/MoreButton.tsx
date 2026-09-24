import type Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import ActionChip from '@/components/ActionChip';
import ChoiceSheet from '@/components/ChoiceSheet';

export interface MoreItem {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onSelect: () => void;
}

// A sheet rather than Alert: Android shows at most three Alert buttons.
export default function MoreButton({
  title,
  items,
  dark = false,
}: {
  title: string;
  items: MoreItem[];
  dark?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  return (
    <>
      <ActionChip
        dark={dark}
        icon="more-horizontal"
        accessibilityLabel={`More for ${title}`}
        onPress={() => setOpen(true)}
      />
      <ChoiceSheet
        visible={open}
        title={title}
        choices={items.map((item, index) => ({
          value: String(index),
          label: item.label,
          icon: item.icon,
        }))}
        onChoose={(value) => {
          setOpen(false);
          items[Number(value)]?.onSelect();
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
