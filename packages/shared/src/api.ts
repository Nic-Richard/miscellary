import type { Rarity } from './rarity';

export interface ApiError {
  error: string;
  fields?: Record<string, string[]>;
}

export interface PublicProfile {
  username: string;
  display_name: string;
  bio: string;
  showcase_title: string;
  avatar_url: string | null;
  created_at: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  email_verified: boolean;
  profile: PublicProfile;
}

export interface TokenPair {
  access: string;
  refresh?: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export type ImageKind = 'card' | 'cover' | 'avatar' | 'pack';

export interface ImageRef {
  id: string;
  kind: ImageKind;
  url: string;
  width: number;
  height: number;
  ready: boolean;
}

export interface CreateUploadResponse {
  image: ImageRef;
  upload_url: string;
  max_size: number;
}

export interface TemplateOption {
  label: string;
  values: string[];
  default: string;
  /** Which control to draw: a colour swatch grid, or a plain list of choices. */
  type?: 'choice' | 'swatch' | 'font';
}

export interface CardTemplate {
  key: string;
  version: number;
  name: string;
  description: string;
  options: Record<string, TemplateOption>;
}

export type TemplateConfig = Record<string, string>;

export interface PackLayer {
  kind: string;
  image_id: string;
  hidden: boolean;
  /** Filled in by the API from image_id, so a client can render and measure it. */
  url: string;
  width: number;
  height: number;
  scale: number;
  x: number;
  y: number;
  rotate: number;
  flip_x: boolean;
  flip_y: boolean;
  opacity: number;
}

export interface PackTextLayer {
  text: string;
  hidden: boolean;
  font: string;
  colour: string;
  size: number;
  x: number;
  y: number;
  rotate: number;
  tracking: number;
}

export type SetStatus = 'draft' | 'published' | 'deleted' | 'removed';

export interface Creator {
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export interface Card {
  id: string;
  title: string;
  rarity: Rarity;
  description: string;
  image: ImageRef;
  template_key: string;
  template_version: number;
  template_config: TemplateConfig;
  position: number;
  like_count: number;
}

export interface CardSetSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover: ImageRef | null;
  /** Creator-chosen identity. Empty strings mean the platform default. */
  mark: string;
  pack_colour: string;
  pack_finish: string;
  /** What is printed on the pack front, bottom of the stack first. */
  pack_layers: PackLayer[];
  emblem_layout: string;
  emblem_shape: string;
  emblem_style: string;
  emblem_text: string;
  emblem_type_scale: number;
  mark_scale: number;
  pack_subtitle: string;
  pack_text: PackTextLayer[];
  pack_size: number;
  status: SetStatus;
  creator: Creator;
  card_count: number;
  like_count: number;
  opening_count: number;
  liked: boolean;
  created_at: string;
  published_at: string | null;
}

export interface CardSetDetail extends CardSetSummary {
  cards: Card[];
  liked_card_ids: string[];
}

export interface CardWrite {
  image_id: string;
  title: string;
  rarity: Rarity;
  description: string;
  template_key: string;
  template_config: TemplateConfig;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface PackStatus {
  free_available: boolean;
  points: number;
  pack_cost: number;
  pack_size: number;
  recycle_values: Record<Rarity, number>;
  resets_at: string;
}

export interface OwnedCard {
  id: string;
  card: Card;
  set_slug: string;
  set_title: string;
  set_mark: string;
  copies: number;
  held: boolean;
  acquired_at: string;
}

export interface PackOpening {
  id: string;
  kind: 'free' | 'points';
  card_set: CardSetSummary;
  cards: OwnedCard[];
  opened_at: string;
  status: PackStatus;
}

export interface SetPointsBalance {
  set_slug: string;
  set_title: string;
  points: number;
}

export type TradeStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'countered';

export interface TradeOffer {
  id: string;
  sender: Creator;
  recipient: Creator;
  status: TradeStatus;
  message: string;
  counter_of: string | null;
  give: OwnedCard[];
  want: OwnedCard[];
  created_at: string;
  resolved_at: string | null;
}

export interface TradeOfferWrite {
  recipient?: string;
  give: string[];
  want: string[];
  message?: string;
}

export interface ShowcaseSlot {
  position: number;
  owned_card: OwnedCard;
}

export interface ProfilePage extends PublicProfile {
  follower_count: number;
  following_count: number;
  set_count: number;
  card_count: number;
  is_following: boolean;
  is_me: boolean;
  showcase_title: string;
  showcase: ShowcaseSlot[];
  sets: CardSetSummary[];
}

export interface Comment {
  id: string;
  /** Null once the comment has been removed; the row stays to hold its replies. */
  author: Creator | null;
  body: string;
  removed: boolean;
  is_creator: boolean;
  created_at: string;
  can_delete: boolean;
  /** Replies go one level deep, oldest first. */
  replies: Comment[];
}

export interface CommentThread {
  count: number;
  results: Comment[];
}

export type ReportReason = 'explicit' | 'real_person' | 'stolen' | 'harassment' | 'spam' | 'other';

export interface SearchResults {
  query: string;
  users: Creator[];
  sets: CardSetSummary[];
  cards: (Card & { set_slug: string; set_title: string })[];
}
