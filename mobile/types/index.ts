import type {
  ApprovalMode,
  DinnerStatus,
  DonationStatus,
  KosherLevel,
  PaymentStatus,
  PotluckCategory,
  ReportStatus,
  ReportTargetType,
  RsvpStatus,
  SponsorStatus,
} from "./database";

export type Role = "attendee" | "host" | "sponsor";

export interface Profile {
  id: string;
  name: string;
  photoUrl: string | null;
  age: number | null;
  gender: string | null;
  origin: string | null;
  kosherLevel: KosherLevel | null;
  dietaryPrefs: string | null;
  interests: string[];
  funFact: string | null;
  roles: Role[];
  verificationTier: number;
}

export interface HostDetails {
  bio: string;
  homeVibe: string;
  dinnersHostedCount: number;
}

export interface SponsorDetails {
  whyIGive: string;
  budgetCeiling: number | null;
  monthlyBudget: number | null;
  locationPref: string | null;
  dinnerTypePrefs: string[];
  status: SponsorStatus;
}

export interface Dinner {
  id: string;
  hostId: string;
  hostName: string;
  hostPhotoUrl: string | null;
  hostDinnersHostedCount: number;
  date: string;
  startTime: string;
  capacity: number;
  seatsTaken: number;
  area: string;
  exactAddress: string | null;
  kosherLevel: KosherLevel;
  costPerHead: number;
  isFree: boolean;
  description: string;
  approvalMode: ApprovalMode;
  budgetNeeded: number | null;
  seekingSponsorship: boolean;
  dinnerTypeTags: string[];
  sponsorApproved: boolean;
  amountFunded: number;
  status: DinnerStatus;
}

export interface SponsorDonation {
  id: string;
  dinnerId: string;
  hostId: string;
  sponsorId: string;
  donorLegalName: string;
  donorReceiptEmail: string;
  amount: number;
  currency: string;
  status: DonationStatus;
  message: string | null;
  anonymous: boolean;
  createdAt: string;
}

export interface PotluckClaim {
  id: string;
  itemId: string;
  attendeeId: string;
  attendeeName: string;
  attendeePhotoUrl: string | null;
  quantity: number;
  contributionAmount: number | null;
  note: string | null;
  createdAt: string;
}

export interface PotluckItem {
  id: string;
  dinnerId: string;
  name: string;
  category: PotluckCategory;
  quantityNeeded: number;
  isMoneyRequest: boolean;
  moneyAmount: number | null;
  notes: string | null;
  claims: PotluckClaim[];
  createdAt: string;
}

export interface Rsvp {
  id: string;
  dinnerId: string;
  attendeeId: string;
  status: RsvpStatus;
  paymentStatus: PaymentStatus;
}

export interface MessageThread {
  id: string;
  dinnerId: string;
  dinnerTitle: string;
  counterpartId: string;
  counterpartName: string;
  counterpartPhotoUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unread: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface Report {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  status: ReportStatus;
}
