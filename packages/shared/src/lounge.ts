import type { Card, Creator, Paginated } from './api';

export type LoungeStyle = 'plain' | 'binder';
export const LOUNGE_TOPICS = [
  { id: 'show', label: 'Show and tell' },
  { id: 'trading', label: 'Trading' },
  { id: 'making', label: 'Making sets' },
  { id: 'questions', label: 'Questions' },
  { id: 'other', label: 'Anything else' },
] as const;
export type LoungeTopic = (typeof LOUNGE_TOPICS)[number]['id'];
export function loungeTopicLabel(topic: string): string {
  return LOUNGE_TOPICS.find((item) => item.id === topic)?.label ?? 'Anything else';
}
export interface LoungeCard extends Card {
  set_title: string;
  set_slug: string;
  set_mark: string;
  set_pack_colour: string;
  set_creator: Creator;
}
/** A supporter badge as "colour-finish", such as "gold-foil", or null when not shown. */
export type BadgeStyle = string | null;
export type Vote = -1 | 0 | 1;
export interface LoungePost {
  id: string;
  title: string;
  body: string;
  author: Creator | null;
  author_badge: BadgeStyle;
  created_at: string;
  edited: boolean;
  draft: boolean;
  removed: boolean;
  topic: LoungeTopic;
  style: LoungeStyle;
  can_edit: boolean;
  can_delete: boolean;
  score: number;
  my_vote: Vote;
  saved: boolean;
  saved_folder: number | null;
  unread: boolean;
  reply_count: number;
  cards: (LoungeCard | null)[];
}
export interface LoungeReply {
  id: string;
  body: string;
  author: Creator | null;
  author_badge: BadgeStyle;
  is_op: boolean;
  parent_id: string | null;
  created_at: string;
  edited: boolean;
  removed: boolean;
  can_edit: boolean;
  can_delete: boolean;
  score: number;
  my_vote: Vote;
  child_count: number;
  cards: (LoungeCard | null)[];
}
export type ReplySort = 'top' | 'new' | 'oldest';
export interface SavedFolder {
  id: number;
  name: string;
  count: number;
}
export interface UserSummary extends Creator {
  badge_style: BadgeStyle;
  created_at: string;
  card_count: number;
  set_count: number;
  follower_count: number;
  featured_card: LoungeCard | null;
  is_me: boolean;
  is_following: boolean;
  is_blocked: boolean;
}
export const LOUNGE_LIMITS = {
  postCards: 6,
  binderCards: 40,
  replyCards: 3,
  supporterReplyCards: 6,
} as const;
export const BADGE_COLOURS = [
  { id: 'gold', label: 'Gold' },
  { id: 'silver', label: 'Silver' },
  { id: 'rose', label: 'Rose gold' },
  { id: 'jade', label: 'Jade' },
  { id: 'sapphire', label: 'Sapphire' },
] as const;
export const BADGE_FINISHES = [
  { id: 'foil', label: 'Foil' },
  { id: 'satin', label: 'Satin' },
  { id: 'holo', label: 'Holographic' },
] as const;
export type BadgeColour = (typeof BADGE_COLOURS)[number]['id'];
/** Badge metals are materials like card foil, so they stay the same in every theme. */
export const BADGE_METALS: Record<string, { lo: string; mid: string; hi: string; ink: string }> = {
  gold: { lo: '#5e4518', mid: '#c9a24a', hi: '#fff6dc', ink: '#3a2a0c' },
  silver: { lo: '#50565e', mid: '#b9bec5', hi: '#ffffff', ink: '#24282d' },
  rose: { lo: '#6b372f', mid: '#d09180', hi: '#fff0ea', ink: '#3d1c16' },
  jade: { lo: '#1b4a3d', mid: '#64ad94', hi: '#eafff7', ink: '#0f2a22' },
  sapphire: { lo: '#1b2c58', mid: '#6688d2', hi: '#eef3ff', ink: '#101a36' },
};
export const HOLO_STOPS = ['#f6b3c9', '#b9d7ff', '#c8f5d2', '#fff1a8'];
export type BadgeFinish = (typeof BADGE_FINISHES)[number]['id'];
export function splitBadge(style: BadgeStyle): { colour: BadgeColour; finish: BadgeFinish } | null {
  if (!style) return null;
  const [colour, finish] = style.split('-');
  return {
    colour: (BADGE_COLOURS.find((item) => item.id === colour)?.id ?? 'gold') as BadgeColour,
    finish: (BADGE_FINISHES.find((item) => item.id === finish)?.id ?? 'foil') as BadgeFinish,
  };
}
export interface LoungeFeed extends Paginated<LoungePost> {
  enabled: boolean;
  subscriber: boolean;
}
export interface LoungePostWrite {
  title: string;
  body: string;
  style: LoungeStyle;
  topic: LoungeTopic;
  card_ids: string[];
  draft?: boolean;
  rules_accepted: boolean;
}
