import { parseDescription } from '@miscellary/shared';
import type { DescriptionNode } from '@miscellary/shared';

export function InlineMarkdown({ nodes }: { nodes: DescriptionNode[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.type === 'bold') return <strong key={i}>{n.value}</strong>;
        if (n.type === 'italic') return <em key={i}>{n.value}</em>;
        if (n.type === 'underline') return <u key={i}>{n.value}</u>;
        if (n.type === 'break') return <br key={i} />;
        return <span key={i}>{n.value}</span>;
      })}
    </>
  );
}

export default function Description({
  text,
  className,
}: {
  text: string;
  className?: string | undefined;
}) {
  const blocks = parseDescription(text);
  return (
    <div className={className}>
      {blocks.map((block, i) =>
        block.type === 'list' ? (
          <ul key={i}>
            {block.items.map((item, j) => (
              <li key={j}>
                <InlineMarkdown nodes={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            <InlineMarkdown nodes={block.children} />
          </p>
        ),
      )}
    </div>
  );
}
