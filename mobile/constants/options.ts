import type { KosherLevel } from "@/types/database";

export const KOSHER_LEVELS: { value: KosherLevel; label: string }[] = [
  { value: "not_kosher", label: "Not kosher" },
  { value: "kosher", label: "Kosher" },
  { value: "strictly_kosher", label: "Strictly kosher" },
];

export const INTEREST_TAGS = [
  "Music",
  "Hiking",
  "Torah study",
  "Startups",
  "Food",
  "Travel",
  "Sports",
  "Art",
  "Books",
  "Politics",
  "Comedy",
  "Volunteering",
  "Film",
  "Dancing",
  "Fitness",
];

export const DINNER_TYPE_TAGS = [
  "Young professionals",
  "Students",
  "Olim (new immigrants)",
  "Families welcome",
  "LGBTQ+ friendly",
  "Quiet & intimate",
  "Big & lively",
  "Traditional",
  "Musical",
];

export const MISSION_STATS = [
  { value: "70%+", label: "of Jewish Israelis have a Friday night Shabbat dinner each week." },
  { value: "~$2B", label: "given to Israeli causes from abroad each year." },
  { value: "80/7", label: "80% of that giving comes from just 7% of donor organizations." },
];
