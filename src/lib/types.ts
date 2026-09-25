/**
 * Client-safe data shapes returned by the service layer and API. Keeping
 * them here (not in Prisma types) decouples UI from the database schema.
 */
export interface UserMini {
  id: string;
  username: string;
  displayName: string;
  avatarKey: string | null;
}

export interface CategoryMini {
  slug: string;
  name: string;
  emoji: string | null;
}

export interface GenreMini {
  slug: string;
  name: string;
}

export interface VenueMini {
  id: string;
  slug: string;
  name: string;
  ratingAvg: number;
  ratingCount: number;
}

export interface EventCardData {
  id: string;
  slug: string;
  title: string;
  coverKey: string | null;
  startsAt: Date;
  endsAt: Date | null;
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  timezone: string;
  locationName: string;
  address: string | null;
  lat: number;
  lng: number;
  category: CategoryMini;
  genres: GenreMini[];
  venue: VenueMini | null;
  interestedCount: number;
  goingCount: number;
  isFeatured: boolean;
  isDemo: boolean;
  status: "PENDING" | "PUBLISHED" | "REJECTED" | "CANCELLED";
}

export interface ViewerEventState {
  attendance: "INTERESTED" | "GOING" | null;
  saved: boolean;
}

export interface PhotoData {
  id: string;
  key: string;
  width: number;
  height: number;
  blurDataUrl: string | null;
}

export interface GalleryPhoto extends PhotoData {
  createdAt: Date;
  likeCount: number;
  uploader: UserMini;
  liked: boolean;
}

export interface EventDetail extends EventCardData {
  description: string | null;
  minAge: number | null;
  ticketUrl: string | null;
  organizer: UserMini;
  isOfficial: boolean;
  city: { slug: string; name: string };
  photos: PhotoData[];
  attendeesPreview: UserMini[];
  viewer: ViewerEventState;
  canEdit: boolean;
}

export interface VenueCardData {
  id: string;
  slug: string;
  name: string;
  type: string;
  coverKey: string | null;
  neighborhood: string | null;
  address: string;
  lat: number;
  lng: number;
  ratingAvg: number;
  ratingCount: number;
  followerCount: number;
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  genres: GenreMini[];
  isDemo: boolean;
}

export interface OpeningHours {
  [day: string]: Array<{ open: string; close: string }>;
}

export interface ReviewData {
  id: string;
  rating: number;
  ambience: number | null;
  music: number | null;
  staff: number | null;
  price: number | null;
  space: number | null;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: UserMini;
}

export interface VenueDetail extends VenueCardData {
  description: string | null;
  timezone: string;
  openingHours: OpeningHours | null;
  minAge: number | null;
  website: string | null;
  instagram: string | null;
  city: { slug: string; name: string };
  subScores: { ambience: number | null; music: number | null; staff: number | null; price: number | null; space: number | null };
  ratingDistribution: number[]; // index 0 → 1 star … index 4 → 5 stars
  viewer: { following: boolean; review: ReviewData | null; canManage: boolean };
}

export interface FeedPost {
  id: string;
  type: "PHOTO" | "CAROUSEL" | "VIDEO";
  caption: string | null;
  createdAt: Date;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  locationName: string | null;
  isDemo: boolean;
  author: UserMini;
  photos: PhotoData[];
  video: { id: string; key: string; posterKey: string | null; width: number | null; height: number | null } | null;
  event: { id: string; slug: string; title: string; startsAt: Date } | null;
  venue: { id: string; slug: string; name: string } | null;
  tagged: UserMini[];
  viewer: { liked: boolean; saved: boolean; followsAuthor: boolean; isAuthor: boolean };
}

export interface CommentData {
  id: string;
  body: string;
  createdAt: Date;
  author: UserMini;
  canDelete: boolean;
}

export interface ProfileData extends UserMini {
  bio: string | null;
  followerCount: number;
  followingCount: number;
  postCount: number;
  eventCount: number;
  city: { slug: string; name: string } | null;
  isDemo: boolean;
  joinedAt: Date;
  viewer: { isSelf: boolean; following: boolean; followsYou: boolean };
}

export interface NotificationData {
  id: string;
  type: string;
  createdAt: Date;
  read: boolean;
  actor: UserMini | null;
  post: { id: string; thumbKey: string | null } | null;
  event: { slug: string; title: string; startsAt: Date; coverKey: string | null } | null;
  comment: { body: string } | null;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface MapPlace {
  kind: "venue" | "event";
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  coverKey: string | null;
  address: string;
  category: string; // "club" | "fm" | "fiesta" | …
  ratingAvg: number | null;
  ratingCount: number | null;
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  timezone: string;
  /** For venues: the event happening now / next; for events: itself. */
  currentEvent: { slug: string; title: string; startsAt: Date; endsAt: Date | null; priceMin: number | null; priceMax: number | null } | null;
  nextEvent: { slug: string; title: string; startsAt: Date; endsAt: Date | null; priceMin: number | null; priceMax: number | null } | null;
  openingHours: OpeningHours | null;
}
