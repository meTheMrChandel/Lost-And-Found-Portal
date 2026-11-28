import {
  Banknote,
  Bike,
  Headphones,
  IconType,
  IdCard,
  KeyRound,
  Laptop,
  Milk,
  Package,
  Smartphone,
  Tag,
  Umbrella,
  Wallet,
} from "../ui/icons";

/** Icons for the seeded categories (backend seed_data), which only carry emoji. */
const BY_SLUG: Record<string, IconType> = {
  bicycle: Bike,
  phone: Smartphone,
  laptop: Laptop,
  earbuds: Headphones,
  keys: KeyRound,
  id_card: IdCard,
  bottle: Milk,
  umbrella: Umbrella,
  wallet: Wallet,
  cash: Banknote,
  other: Package,
};

const BY_KEYWORD: [RegExp, IconType][] = [
  [/cycle|bike/, Bike],
  [/phone|mobile/, Smartphone],
  [/laptop|computer|tablet/, Laptop],
  [/ear|headphone|audio/, Headphones],
  [/key/, KeyRound],
  [/card|id/, IdCard],
  [/bottle|flask/, Milk],
  [/umbrella/, Umbrella],
  [/wallet|purse/, Wallet],
  [/cash|money/, Banknote],
];

/** Icon for a category slug or name; a tag for anything unknown. */
export function categoryIcon(category?: string | null): IconType {
  const key = (category || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  if (BY_SLUG[key]) return BY_SLUG[key];
  const match = BY_KEYWORD.find(([pattern]) => pattern.test(key));
  return match ? match[1] : key ? Tag : Package;
}
