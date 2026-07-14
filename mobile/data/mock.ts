import type { ChatMessage, Dinner, MessageThread, Profile } from "@/types";

// Used only when Supabase isn't configured yet (see lib/env.ts), so the app is
// click-through-able out of the box. Swapped out automatically once real env vars are set.

export const mockProfile: Profile = {
  id: "mock-me",
  name: "Tirza Cohen",
  photoUrl: null,
  age: 26,
  gender: "Woman",
  origin: "Ra'anana",
  kosherLevel: "kosher",
  dietaryPrefs: "Vegetarian",
  interests: ["Hiking", "Startups", "Music"],
  funFact: "I once hiked the entire Israel National Trail.",
  roles: ["attendee"],
  verificationTier: 1,
};

export const mockDinners: Dinner[] = [
  {
    id: "d1",
    hostId: "h1",
    hostName: "Jonathan Levi",
    hostPhotoUrl: null,
    hostDinnersHostedCount: 6,
    date: "2026-07-03",
    startTime: "19:30",
    capacity: 8,
    seatsTaken: 5,
    area: "Florentin, Tel Aviv",
    exactAddress: "12 Herzl St, Apt 4",
    kosherLevel: "kosher",
    costPerHead: 0,
    isFree: true,
    description:
      "Laid-back Shabbat with homemade challah and a lot of guitar. New olim especially welcome.",
    approvalMode: "auto_accept",
    budgetNeeded: null,
    seekingSponsorship: false,
    status: "published",
  },
  {
    id: "d2",
    hostId: "h2",
    hostName: "Maya Ben-David",
    hostPhotoUrl: null,
    hostDinnersHostedCount: 2,
    date: "2026-07-03",
    startTime: "20:00",
    capacity: 6,
    seatsTaken: 3,
    area: "Neve Tzedek, Tel Aviv",
    exactAddress: "5 Shabazi St",
    kosherLevel: "strictly_kosher",
    costPerHead: 60,
    isFree: false,
    description: "Traditional family-style dinner, quiet and intimate. Great for first-timers.",
    approvalMode: "host_approves",
    budgetNeeded: null,
    seekingSponsorship: false,
    status: "published",
  },
  {
    id: "d3",
    hostId: "h3",
    hostName: "Amit Peretz",
    hostPhotoUrl: null,
    hostDinnersHostedCount: 11,
    date: "2026-07-10",
    startTime: "19:00",
    capacity: 12,
    seatsTaken: 12,
    area: "Kerem HaTeimanim, Tel Aviv",
    exactAddress: "8 Yemin Moshe St",
    kosherLevel: "not_kosher",
    costPerHead: 40,
    isFree: false,
    description: "Big lively table, lots of music, always runs late. Bring a friend.",
    approvalMode: "auto_accept",
    budgetNeeded: null,
    seekingSponsorship: false,
    status: "published",
  },
];

export const mockRsvps: Record<string, { status: string; paymentStatus: string }> = {};

export const mockThreads: MessageThread[] = [
  {
    id: "t1",
    dinnerId: "d1",
    dinnerTitle: "Shabbat with Jonathan",
    counterpartName: "Jonathan Levi",
    counterpartPhotoUrl: null,
    lastMessage: "Great, see you at 19:30! Address is 12 Herzl St.",
    lastMessageAt: "2026-07-01T14:00:00Z",
    unread: true,
  },
];

export const mockMessages: Record<string, ChatMessage[]> = {
  t1: [
    {
      id: "m1",
      senderId: "h1",
      body: "Hey! Excited to have you Friday. Any allergies I should know about?",
      createdAt: "2026-07-01T13:40:00Z",
    },
    {
      id: "m2",
      senderId: "mock-me",
      body: "Nothing serious, just vegetarian \u2014 thank you for asking!",
      createdAt: "2026-07-01T13:55:00Z",
    },
    {
      id: "m3",
      senderId: "h1",
      body: "Great, see you at 19:30! Address is 12 Herzl St.",
      createdAt: "2026-07-01T14:00:00Z",
    },
  ],
};
