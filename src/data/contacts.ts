// src/data/contacts.ts
import type { ContactInfo } from "../types";

export type ContactRecord = ContactInfo & {
  id: string;           // stable key used in URLs / dropdown
  initials?: string;    // optional nicety
  avatarUrl?: string;   // optional nicety
};

/**
 * Edit this list with your real details.
 * Tip: keep `id` kebab-cased and unique.
 */
export const CONTACTS: ContactRecord[] = [
  {
    id: "mark-sheppard",
    contactName: "Mark Sheppard",
    email: "mark@pacificbathroom.com.au",
    phone: "07 4755 2266",
    title: "Sales Manager",
    company: "Pacific Bathroom",
    initials: "MS",
  },
  {
    id: "amy-keys",
    contactName: "Amy Keys",
    email: "amy@pacificbathroom.com.au",
    phone: "07 4755 2266",
    title: "Showroom Consultant",
    company: "Pacific Bathroom",
    initials: "AK",
  },
  {
    id: "jeff-copper",
    contactName: "Jeff Copper",
    email: "jeff@pacificbathroom.com.au",
    phone: "0499 247 061",
    title: "Director",
    company: "Pacific Bathroom",
    initials: "JC",
  },
   {
    id: "wayne-kennedy",
    contactName: "Wayne Kennedy",
    email: "wayne@pacificbathroom.com.au",
    phone: "0431 042 233",
    title: "Sales Consultant",
    company: "Pacific Bathroom",
    initials: "WK",
  },
];
