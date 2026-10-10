import LoginGate from '@/components/LoginGate';
import StartDiscussion from '@/components/lounge/StartDiscussion';

export default function StartDiscussionScreen() {
  return (
    <LoginGate>
      <StartDiscussion />
    </LoginGate>
  );
}
