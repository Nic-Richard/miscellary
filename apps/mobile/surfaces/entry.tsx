import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type {
  Card,
  CardSetDetail,
  CardTemplate,
  Creator,
  PackOpening,
  ShowcaseSlot,
} from '@miscellary/shared';
import CardPreview from '../../web/components/CardPreview';
import type { CardPreviewProps } from '../../web/components/CardPreview';
import CardBack from '../../web/components/CardBack';
import CardInspector from '../../web/components/CardInspector';
import Binder from '../../web/components/binder/Binder';
import PackPouch from '../../web/components/PackPouch';
import PackReveal from '../../web/components/PackReveal';
import ProfileBinder from '../../web/components/ProfileBinder';
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
  useEffect(() => {
    if (mode !== 'binder' || !set?.cards) return;
    const spread = Math.floor(Number(data.page ?? 0) / 2);
    const first = Math.max(0, spread - 1) * 8;
    const last = Math.min(set.cards.length, (spread + 2) * 8);
    for (const card of set.cards.slice(first, last)) {
      const image = new Image();
      image.src = card.render?.thumbnail?.url ?? card.image.url;
      void image.decode?.().catch(() => undefined);
    }
  }, [data.page, mode, set]);
  let content;
  if (mode === 'card') content = <CardPreview {...cardProps} size="large" />;
  else if (mode === 'render-front')
    content = <CardPreview {...cardProps} size="large" renderMode="static" />;
  else if (mode === 'render-mask')
    content = <CardPreview {...cardProps} size="large" renderMode="mask" />;
  else if (mode === 'render-back')
    content = (
      <CardBack
        title={String(data.title ?? '')}
        mark={data.mark as string}
        packColour={data.packColour as string}
        unclipped
      />
    );
  else if (mode === 'pack') content = <PackPouch title={set.title} identity={set} />;
  else if (mode === 'reveal')
    content = (
      <PackReveal
        opening={data.opening as PackOpening}
        mobileLayout
        onClose={() => send('close')}
      />
    );
  else if (mode === 'inspect')
    content = (
      <CardInspector
        card={data.card as Card}
        setTitle={String(data.setTitle ?? '')}
        setSlug={String(data.setSlug ?? '')}
        mark={data.mark as string}
        packColour={data.packColour as string}
        creator={data.creator as Creator | undefined}
        copies={data.copies as number | undefined}
        onClose={() => send('close')}
      />
    );
  else if (mode === 'binder') {
    const page = Number(data.page ?? 0);
    const half = Boolean(data.half);
    const spread = Math.floor(page / 2);
    const cards = set.cards;
    const binderPages = Array.from(
      { length: Math.max(1, Math.ceil(cards.length / 8)) },
      (_, spreadIndex) => ({
        startIndex: spreadIndex * 8,
        slots: Array.from({ length: 8 }, (_, slot) => {
          const row = Math.floor(slot / 4),
            column = slot % 4;
          const index = spreadIndex * 8 + (column >= 2 ? 4 : 0) + row * 2 + (column % 2);
          const card = cards[index];
          return card ? (
            <button className="card-slot" onClick={() => send('inspect', card.id)}>
              <CardPreview
                size="small"
                title={card.title}
                rarity={card.rarity}
                description={card.description}
                imageUrl={card.image.url}
                templateKey={card.template_key}
                templateConfig={card.template_config}
                number={card.position + 1}
                mark={set.mark}
                render={card.render}
              />
            </button>
          ) : null;
        }),
      }),
    );
    const slots = binderPages[spread]?.slots ?? [];
    content = (
      <div className="binder-viewport" data-half={half} data-right={page % 2 === 1}>
        <Binder
          slots={slots}
          page={spread}
          pages={binderPages}
          startIndex={spread * 8}
          mark={set.mark}
          colour={set.binder_colour}
          canPrevious={page > 0}
          canNext={page + (half ? 1 : 2) < Math.max(2, Math.ceil(cards.length / 8) * 2)}
          onNavigate={(direction) => send('page', page + direction * (half ? 1 : 2))}
        />
      </div>
    );
  } else if (mode === 'profile-binder') {
    const editing = Boolean(data.editing);
    content = (
      <ProfileBinder
        slots={data.slots as (ShowcaseSlot | null)[]}
        title={String(data.title ?? '')}
        colour={data.colour as string}
        mine={Boolean(data.mine)}
        open
        onPick={editing ? (position) => send('pick', position) : undefined}
        onRemove={editing ? (position) => send('remove', position) : undefined}
        onInspect={editing ? undefined : (owned) => send('inspect', owned.id)}
      />
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
        {error ? <p role="alert">{error}</p> : null}
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
window.miscellaryReady = Promise.resolve();
window.miscellaryRender = (props) => {
  root.render(<Surface {...(props as Props)} />);
  window.miscellaryReady = new Promise((resolve) => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        void document.fonts.ready.then(async () => {
          await Promise.allSettled(
            [...document.images].map(
              (image) =>
                image.decode?.() ??
                new Promise<void>((done) => {
                  if (image.complete) done();
                  else {
                    image.addEventListener('load', () => done(), { once: true });
                    image.addEventListener('error', () => done(), { once: true });
                  }
                }),
            ),
          );
          resolve();
        });
      }),
    );
  });
};
send('ready');
