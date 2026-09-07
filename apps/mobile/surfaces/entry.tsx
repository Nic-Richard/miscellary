import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Card, CardSetDetail, CardTemplate, PackOpening } from '@miscellary/shared';
import CardPreview from '../../web/components/CardPreview';
import type { CardPreviewProps } from '../../web/components/CardPreview';
import CardInspector from '../../web/components/CardInspector';
import Binder from '../../web/components/binder/Binder';
import PackPouch from '../../web/components/PackPouch';
import PackReveal from '../../web/components/PackReveal';
import PackDesigner from '../../web/components/studio/PackDesigner';
import CardForm from '../../web/components/CardForm';
import { apiFetch } from './api';
import { send } from './bridge';
import '../../web/app/globals.css';
import './surface.css';

type Props = { mode: string; data: Record<string, unknown> };
function Surface({ mode, data }: Props) {
  const [draft, setDraft] = useState(data.set as CardSetDetail);
  const [error, setError] = useState('');
  useEffect(() => setDraft(data.set as CardSetDetail), [data.set]);
  useEffect(() => {
    document.body.dataset.surface = mode;
    const observer = new ResizeObserver(() =>
      send('height', document.getElementById('content')?.getBoundingClientRect().height),
    );
    const content = document.getElementById('content');
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, [mode]);
  const cardProps = data as unknown as CardPreviewProps;
  const set = data.set as CardSetDetail;
  let content;
  if (mode === 'card') content = <CardPreview {...cardProps} size="large" />;
  else if (mode === 'pack') content = <PackPouch title={set.title} identity={set} />;
  else if (mode === 'reveal')
    content = <PackReveal opening={data.opening as PackOpening} onClose={() => send('close')} />;
  else if (mode === 'inspect')
    content = (
      <CardInspector
        card={data.card as Card}
        setTitle={String(data.setTitle ?? '')}
        setSlug={String(data.setSlug ?? '')}
        mark={data.mark as string}
        packColour={data.packColour as string}
        onClose={() => send('close')}
      />
    );
  else if (mode === 'binder') {
    const page = Number(data.page ?? 0);
    const half = Boolean(data.half);
    const spread = Math.floor(page / 2);
    const cards = set.cards;
    const slots = Array.from({ length: 8 }, (_, slot) => {
      const row = Math.floor(slot / 4),
        column = slot % 4;
      const index = spread * 8 + (column >= 2 ? 4 : 0) + row * 2 + (column % 2);
      const card = cards[index];
      return card ? (
        <button className="card-slot" onClick={() => send('inspect', card.id)}>
          <CardPreview
            title={card.title}
            rarity={card.rarity}
            description={card.description}
            imageUrl={card.image.url}
            templateKey={card.template_key}
            templateConfig={card.template_config}
            number={card.position + 1}
            mark={set.mark}
          />
        </button>
      ) : null;
    });
    content = (
      <div className="binder-viewport" data-half={half} data-right={page % 2 === 1}>
        <Binder slots={slots} page={spread} mark={set.mark} colour={set.binder_colour} />
      </div>
    );
  } else if (mode === 'card-editor')
    content = (
      <CardForm
        setId={String(data.setId)}
        templates={data.templates as CardTemplate[]}
        card={data.card as Card | null}
        mark={data.mark as string}
        onDone={async () => send('saved')}
        onCancel={() => send('close')}
      />
    );
  else if (mode === 'pack-editor' && draft)
    content = (
      <>
        <p role="alert">{error}</p>
        <PackDesigner
          set={draft}
          onDraft={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          onSave={(patch) => {
            setDraft((current) => ({ ...current, ...patch }));
            setError('');
            void apiFetch<CardSetDetail>(`/api/v1/me/sets/${draft.id}/`, {
              method: 'PATCH',
              body: patch,
            })
              .then((saved) => {
                setDraft(saved);
                send('updated', saved);
              })
              .catch((reason) => setError(reason.message));
          }}
        />
      </>
    );
  return <main id="content">{content}</main>;
}
const root = createRoot(document.getElementById('root')!);
window.miscellaryRender = (props) => root.render(<Surface {...(props as Props)} />);
send('ready');
