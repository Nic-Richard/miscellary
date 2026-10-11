import type { Rarity } from './rarity';
import type { PaidPackQuote } from './membership';

export interface ApiError {
  error: string;
  fields?: Record<string, string[]>;
  /** Set when the client can act on the failure, e.g. `email_unverified`. */
  code?: string;
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
  has_password?: boolean;
  google_connected?: boolean;
  theme?: string;
  /** When the next username change is allowed. Null means now. */
  username_change_available_at: string | null;
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
  terms_accepted: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export type GooglePurpose = 'login' | 'link' | 'username' | 'password' | 'delete';

export interface GoogleProof {
  credential: string;
  nonce: string;
}

export interface GoogleSignup extends GoogleProof {
  username: string;
  terms_accepted: boolean;
}

export interface GoogleConfirmation {
  google_credential: string;
  google_nonce: string;
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
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export interface Tag {
  slug: string;
  label: string;
}

export interface TagSummary extends Tag {
  set_count: number;
}

export type SetStatus = 'draft' | 'published' | 'deleted' | 'removed';

/** Everything waiting for the signed-in collector, for the status bar. */
export interface AccountStatus {
  unread: number;
  free_packs: number;
  offers: number;
  tickets: number;
  supporter_tier: SupporterTier | null;
  ring_style: string | null;
}

/** A supporter's emblem, named after the card rarities, upgrading with months supported. */
export type SupporterTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export const SUPPORTER_TIERS: { id: SupporterTier; label: string; months: number }[] = [
  { id: 'common', label: 'Common', months: 1 },
  { id: 'uncommon', label: 'Uncommon', months: 3 },
  { id: 'rare', label: 'Rare', months: 6 },
  { id: 'epic', label: 'Epic', months: 12 },
  { id: 'legendary', label: 'Legendary', months: 24 },
];

/** Emblem artwork shared by web and app: a tilted card on a 26 by 34 grid. */
export const EMBLEM_STAR =
  'M0 -1L0.265 -0.364L0.951 -0.309L0.428 0.139L0.588 0.809L0 0.45L-0.588 0.809L-0.428 0.139L-0.951 -0.309L-0.265 -0.364Z';
export const EMBLEM_ART: Record<
  SupporterTier,
  { stops: string[]; edge: string; star: string; frame: number; sparkle: boolean; shine: number }
> = {
  common: {
    stops: ['#c3c8cc', '#8a9196', '#5c6368'],
    edge: '#3f4549',
    star: '#ffffff',
    frame: 0,
    sparkle: false,
    shine: 0,
  },
  uncommon: {
    stops: ['#9cc0ea', '#3f6ea8', '#244a78'],
    edge: '#1d3c63',
    star: '#ffffff',
    frame: 0.45,
    sparkle: false,
    shine: 0,
  },
  rare: {
    stops: ['#c9b4ea', '#7b5fa3', '#4d3770'],
    edge: '#3a2858',
    star: '#ffffff',
    frame: 0.55,
    sparkle: false,
    shine: 0.5,
  },
  epic: {
    stops: ['#ffd0e6', '#c0568c', '#f6b3d2', '#7d2f58'],
    edge: '#5e2142',
    star: '#ffffff',
    frame: 0.7,
    sparkle: true,
    shine: 0.6,
  },
  legendary: {
    stops: ['#fff6dc', '#c9a24a', '#f6b3c9', '#b9d7ff', '#fff1a8', '#8a6a24'],
    edge: '#5e4518',
    star: '#3a2a0c',
    frame: 0.55,
    sparkle: true,
    shine: 0.7,
  },
};

export interface Creator {
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_demo: boolean;
  /** A closed account: show it as a deleted user and do not link to it. */
  deleted: boolean;
  supporter_tier?: SupporterTier | null;
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
  tags: Tag[];
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
  /** Following a set is what puts it on the viewer's packs page. */
  following: boolean;
  follower_count: number;
  tags: Tag[];
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
  monetization_enabled?: boolean;
  paid_quote?: PaidPackQuote | null;
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
  kind: 'free' | 'points' | 'stars' | 'bonus';
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
  subscriber_badge?: boolean;
  follower_count: number;
  following_count: number;
  set_count: number;
  card_count: number;
  is_following: boolean;
  is_me: boolean;
  is_blocked: boolean;
  badge_style?: string | null;
  ring_style?: string | null;
  supporter_tier?: SupporterTier | null;
  supporter_months?: number;
  featured_card?: (Card & { set_title: string; set_slug: string }) | null;
  showcase_slots?: number;
  showcase_title: string;
  showcase: ShowcaseSlot[];
  sets: CardSetSummary[];
}

export interface PackEntry {
  monetization_enabled?: boolean;
  card_set: CardSetSummary;
  free_available: boolean;
  resets_at: string;
  points: number;
  pack_cost: number;
  /** Distinct cards held from this set, against its total. */
  owned_count: number;
  card_count: number;
  /** Extra copies, including any held in a trade. */
  duplicate_count: number;
  /** Excludes held copies and keeps one free copy; absent on older API deployments. */
  recyclable_count?: number;
  /** The newest distinct pulls from this set, newest first. */
  recent_cards: Card[];
  followed_at: string;
}

export interface PacksPage {
  results: PackEntry[];
  free_count: number;
}

export type NotificationKind =
  | 'set_like'
  | 'card_like'
  | 'set_comment'
  | 'comment_reply'
  | 'follow'
  | 'lounge_reply'
  | 'lounge_mention';

export interface Notification {
  id: string;
  kind: NotificationKind;
  actor: Creator;
  set_slug: string | null;
  set_title: string | null;
  card_title: string | null;
  /** Empty when the comment has since been removed. */
  comment_body: string;
  /** The baked face of the card this is about, when it is about one. */
  card_image: string | null;
  /** The set's baked wrapper for set notifications. */
  set_pack_image: string | null;
  lounge_post_id: string | null;
  lounge_post_title: string | null;
  /** Empty when the reply has since been removed. */
  lounge_reply_body: string;
  read: boolean;
  created_at: string;
}

export interface NotificationList extends Paginated<Notification> {
  /** Across every notification, not just this page. */
  unread: number;
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

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'explicit', label: 'Explicit or adult content' },
  { value: 'real_person', label: 'Inappropriate use of a real person' },
  { value: 'stolen', label: 'Stolen photo or content' },
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'spam', label: 'Spam' },
  { value: 'other', label: 'Something else' },
];

export type FeedbackKind = 'bug' | 'idea' | 'account' | 'other';

export const FEEDBACK_KINDS: { value: FeedbackKind; label: string }[] = [
  { value: 'bug', label: "Something isn't working" },
  { value: 'idea', label: 'An idea or suggestion' },
  { value: 'account', label: 'My account or tickets' },
  { value: 'other', label: 'Something else' },
];

export interface SearchResults {
  query: string;
  users: Creator[];
  sets: CardSetSummary[];
  cards: (Card & { set_slug: string; set_title: string })[];
  tags: TagSummary[];
}
