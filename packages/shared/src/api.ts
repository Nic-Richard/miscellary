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
  /** Cover of the personal binder on this profile. Empty means the default. */
  binder_colour: string;
  avatar_url: string | null;
  is_demo: boolean;
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

/* Attribution the image's licence asks for. Null when nobody is named. */
export interface ImageCredit {
  author: string;
  license: string;
  license_url: string;
  source_url: string;
}

export interface ImageRef {
  id: string;
  kind: ImageKind;
  url: string;
  width: number;
  height: number;
  ready: boolean;
  credit?: ImageCredit | null;
}

export interface CardRenderImage {
  url: string;
  width: number;
  height: number;
}

export interface CardRenderAssets {
  status: 'pending' | 'ready';
  signature: string;
  version: number;
  /** The spot treatment this card is masked for, if it has one. */
  spot: { material: string; area: string } | null;
  thumbnail: CardRenderImage | null;
  /** The finished card under the default key light, for views that never move it. */
  flat_thumbnail: CardRenderImage | null;
  front: CardRenderImage | null;
  mask_thumbnail: CardRenderImage | null;
  mask: CardRenderImage | null;
  back: CardRenderImage | null;
}

/** A picture of the wrapper, for lists that cannot afford to draw it live. */
export interface PackRender {
  status: 'pending' | 'ready';
  signature: string;
  version: number;
  image: CardRenderImage | null;
}

export interface CardBackRender {
  status: 'pending' | 'ready';
  signature: string;
  version: number;
  image: CardRenderImage | null;
}

export interface CreateUploadResponse {
  image: ImageRef;
  upload_url: string;
  max_size: number;
}

export const OPTION_GROUPS = ['board', 'print', 'type', 'press'] as const;
export type OptionGroup = (typeof OPTION_GROUPS)[number];

export interface TemplateOption {
  label: string;
  values: string[];
  default: string;
  type?: 'choice' | 'swatch' | 'font';
  group?: OptionGroup;
  unlocks?: Record<string, Rarity>;
}

export interface CardTemplate {
  key: string;
  version: number;
  name: string;
  description: string;
  unlocks?: Rarity;
  options: Record<string, TemplateOption>;
  text: CardTextRules;
}

export type CopyMarkup = 'none' | 'inline' | 'block';

export interface TextRegionRules {
  max_length: number;
  min_scale: number;
  lines: number;
  markup: CopyMarkup;
}

export interface CardTextRules {
  printed_label: string | null;
  title: TextRegionRules;
  printed: TextRegionRules | null;
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
  is_demo: boolean;
}

export interface Card {
  id: string;
  title: string;
  rarity: Rarity;
  description: string;
  printed_text: string;
  image: ImageRef;
  template_key: string;
  template_version: number;
  template_config: TemplateConfig;
  position: number;
  /** Frozen at publication, with position, for the printed card identifier. */
  printed_set_code: string;
  set_total: number;
  like_count: number;
  /** Presentation cache for a published definition. Drafts return null. */
  render?: CardRenderAssets | null;
}

export interface CardSetSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover: ImageRef | null;
  mark: string;
  pack_colour: string;
  pack_finish: string;
  /** Cover of the binder this set's public page is bound in. */
  binder_colour: string;
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
  set_code: string;
  suggested_set_code: string;
  /** Published code, or the draft base before a suffix is assigned. */
  printed_set_code: string;
  status: SetStatus;
  creator: Creator;
  card_count: number;
  like_count: number;
  opening_count: number;
  liked: boolean;
  render_back?: CardBackRender | null;
  render_pack?: PackRender | null;
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
  printed_text: string;
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
  set_pack_colour: string;
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
  /** Public sleeve number, from 1 through SHOWCASE_SLOTS. */
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
