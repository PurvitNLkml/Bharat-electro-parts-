export const CATEGORIES = [
  { slug: "microcontrollers", name: "Microcontrollers" },
  { slug: "passives", name: "Passives" },
  { slug: "power", name: "Power" },
  { slug: "connectors", name: "Connectors" },
  { slug: "sensors", name: "Sensors" },
  { slug: "discretes", name: "Discretes" },
  { slug: "memory", name: "Memory" },
  { slug: "electromechanical", name: "Electromechanical" },
  { slug: "rf", name: "RF" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export function categoryName(slug: string): string {
  return CATEGORIES.find((row) => row.slug === slug)?.name ?? slug;
}

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;
