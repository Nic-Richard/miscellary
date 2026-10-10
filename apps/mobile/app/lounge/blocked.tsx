import LoginGate from '@/components/LoginGate';
import BlockedList from '@/components/lounge/BlockedList';

export default function BlockedScreen() {
  return (
    <LoginGate>
      <BlockedList />
    </LoginGate>
  );
}
