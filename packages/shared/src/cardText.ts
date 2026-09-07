export function captionFrom(description: string): string {
  const line = description
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  if (!line) return '';
  const plain = line.replace(/^[-*]\s+/, '').replace(/[*_]+/g, '');
  return plain.length > 42 ? `${plain.slice(0, 40).trimEnd()}…` : plain;
}

export function restOf(description: string): string {
  const lines = description.split(/\r?\n/);
  const first = lines.findIndex((l) => l.trim());
  return first === -1
    ? ''
    : lines
        .slice(first + 1)
        .join('\n')
        .trim();
}
