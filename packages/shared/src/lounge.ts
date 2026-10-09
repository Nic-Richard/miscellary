import type { Card, Creator, Paginated } from './api';

export type LoungeStyle = 'plain' | 'binder';
export interface LoungeCard extends Card {
  set_title: string;
  set_slug: string;
  set_mark: string;
  set_pack_colour: string;
  set_creator: Creator;
}
export interface LoungePost {
  id: string;
  title: string;
  body: string;
  author: Creator | null;
  author_badge: boolean;
  created_at: string;
  removed: boolean;
  style: LoungeStyle;
  can_delete: boolean;
  likes: number;
  liked: boolean;
  reply_count: number;
  cards: (LoungeCard | null)[];
}
export interface LoungeReply {
  id: string;
  body: string;
  author: Creator | null;
  author_badge: boolean;
  parent_id: string | null;
  created_at: string;
  removed: boolean;
  can_delete: boolean;
  likes: number;
  liked: boolean;
  child_count: number;
}
export interface LoungeFeed extends Paginated<LoungePost> {
  enabled: boolean;
  subscriber: boolean;
}
export interface LoungePostWrite {
  title: string;
  body: string;
  style: LoungeStyle;
  card_ids: string[];
  rules_accepted: boolean;
}
