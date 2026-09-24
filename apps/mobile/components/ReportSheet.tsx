import { REPORT_REASONS } from '@miscellary/shared';
import type { ReportReason } from '@miscellary/shared';
import type Feather from '@expo/vector-icons/Feather';
import { Alert } from 'react-native';
import ChoiceSheet from '@/components/ChoiceSheet';
import { sendReport } from '@/lib/endpoints';

const ICONS: Record<ReportReason, keyof typeof Feather.glyphMap> = {
  explicit: 'eye-off',
  real_person: 'user-x',
  stolen: 'image',
  harassment: 'message-circle',
  spam: 'slash',
  other: 'more-horizontal',
};

export type ReportTarget = { set_slug: string } | { card_id: string } | { username: string };

export default function ReportSheet({
  visible,
  subject,
  target,
  onClose,
}: {
  visible: boolean;
  subject: string;
  target: ReportTarget;
  onClose: () => void;
}) {
  return (
    <ChoiceSheet
      visible={visible}
      title={`Report ${subject}`}
      choices={REPORT_REASONS.map((r) => ({
        value: r.value,
        label: r.label,
        icon: ICONS[r.value],
      }))}
      onChoose={(reason) => {
        onClose();
        sendReport({ ...target, reason, details: '' })
          .then(() =>
            Alert.alert(
              'Report sent',
              'Thanks. A moderator will look at it, and will only be in touch if they need more detail.',
            ),
          )
          .catch((e: unknown) =>
            Alert.alert('Could not send the report', e instanceof Error ? e.message : 'Try again.'),
          );
      }}
      onClose={onClose}
    />
  );
}
