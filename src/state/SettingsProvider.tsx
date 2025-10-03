// src/state/SettingsProvider.tsx
import React, { createContext, useContext, useMemo, useEffect } from "react";
import { useLocalStorage } from "../lib/useLocalStorage";
import type { ContactInfo, ProjectMeta } from "../types";
import { CONTACTS, type ContactRecord } from "../data/contacts";

type Settings = {
  contact: ContactInfo;
  project: ProjectMeta;
  contacts: ContactRecord[];
  selectedContactId: string | null;
  setContact: (c: ContactInfo) => void;
  setProject: (p: ProjectMeta) => void;
  selectContactById: (id: string | null) => void;
  resetToDefaults: () => void;
};

const Ctx = createContext<Settings | null>(null);

const today = () => new Date().toISOString().slice(0, 10);

function envDefault<T = string>(key: string, fallback?: T): T | undefined {
  const v = (import.meta.env?.[key] ?? "").toString().trim();
  return (v ? (v as unknown as T) : fallback) as T | undefined;
}

function parseUrlParams() {
  const q = new URLSearchParams(location.search);
  const pick = (k: string) => {
    const v = q.get(k);
    return v && v.trim() ? v.trim() : undefined;
  };
  return {
    contactName: pick("contactName") ?? pick("name"),
    email: pick("email"),
    phone: pick("phone"),
    title: pick("title"),
    company: pick("company"),
    projectName: pick("projectName") ?? pick("project"),
    clientName: pick("clientName") ?? pick("client"),
    presentationDate: pick("date") ?? pick("presentationDate"),
    contactId: pick("contactId") ?? pick("contact") ?? undefined,
  };
}

const DEFAULT_CONTACT: ContactInfo = {
  company: envDefault("VITE_DEFAULT_COMPANY", "Pacific Bathroom"),
  contactName: envDefault("VITE_DEFAULT_CONTACT", "Your Name")!,
  email: envDefault("VITE_DEFAULT_EMAIL", "you@example.com")!,
  phone: envDefault("VITE_DEFAULT_PHONE", ""),
  title: envDefault("VITE_DEFAULT_TITLE", "Sales Consultant"),
};

const DEFAULT_PROJECT: ProjectMeta = {
  projectName: "",
  clientName: "",
  presentationDate: today(),
};

function findContactByLooseKey(key?: string): ContactRecord | undefined {
  if (!key) return;
  const k = key.toLowerCase();
  return (
    CONTACTS.find((c) => c.id === k) ||
    CONTACTS.find((c) => c.email?.toLowerCase() === k) ||
    CONTACTS.find((c) => c.contactName.toLowerCase() === k)
  );
}

// coalesce empties to defaults
function normalizedContact(c: Partial<ContactInfo>): ContactInfo {
  return {
    company: c.company ?? DEFAULT_CONTACT.company,
    contactName: (c.contactName && c.contactName.trim()) || DEFAULT_CONTACT.contactName,
    email: (c.email && c.email.trim()) || DEFAULT_CONTACT.email,
    phone: c.phone ?? DEFAULT_CONTACT.phone,
    title: c.title ?? DEFAULT_CONTACT.title,
  };
}
function normalizedProject(p: Partial<ProjectMeta>): ProjectMeta {
  return {
    projectName: p.projectName ?? DEFAULT_PROJECT.projectName,
    clientName: p.clientName ?? DEFAULT_PROJECT.clientName,
    presentationDate: (p.presentationDate && p.presentationDate.trim()) || today(),
  };
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const url = parseUrlParams();
  const envDefaultId = envDefault("VITE_DEFAULT_CONTACT_ID", "");

  const seededSelectedId =
    url.contactId && findContactByLooseKey(url.contactId)?.id
      ? findContactByLooseKey(url.contactId)!.id
      : envDefaultId && findContactByLooseKey(envDefaultId)?.id
      ? findContactByLooseKey(envDefaultId)!.id
      : null;

  const [selectedContactId, setSelectedContactId] = useLocalStorage<string | null>(
    "pb:selectedContactId",
    seededSelectedId
  );

  const base = selectedContactId
    ? (CONTACTS.find((c) => c.id === selectedContactId) as ContactInfo)
    : DEFAULT_CONTACT;

  const seededContact = normalizedContact({ ...base, ...(url as Partial<ContactInfo>) });
  const seededProject = normalizedProject({ ...DEFAULT_PROJECT, ...(url as Partial<ProjectMeta>) });

  const [contact, setContact] = useLocalStorage<ContactInfo>("pb:contact", seededContact);
  const [project, setProject] = useLocalStorage<ProjectMeta>("pb:project", seededProject);

  // On first load (or if old empty values linger in storage), normalize them:
  useEffect(() => {
    setContact((c) => normalizedContact(c));
    setProject((p) => normalizedProject(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectContactById = (id: string | null) => {
    setSelectedContactId(id);
    if (id) {
      const fromCatalog = CONTACTS.find((c) => c.id === id);
      if (fromCatalog) {
        setContact(normalizedContact(fromCatalog));
      }
    }
  };

  const resetToDefaults = () => {
    const freshUrl = parseUrlParams();
    const idFromUrl =
      freshUrl.contactId && findContactByLooseKey(freshUrl.contactId)?.id
        ? findContactByLooseKey(freshUrl.contactId)!.id
        : null;

    setSelectedContactId(idFromUrl);
    const baseContact = idFromUrl
      ? (CONTACTS.find((c) => c.id === idFromUrl) as ContactInfo)
      : DEFAULT_CONTACT;

    setContact(normalizedContact({ ...baseContact, ...(freshUrl as Partial<ContactInfo>) }));
    setProject(normalizedProject({ ...DEFAULT_PROJECT, ...(freshUrl as Partial<ProjectMeta>) }));
  };

  const value = useMemo<Settings>(
    () => ({
      contact,
      project,
      contacts: CONTACTS,
      selectedContactId,
      setContact,
      setProject,
      selectContactById,
      resetToDefaults,
    }),
    [contact, project, selectedContactId]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used within <SettingsProvider>");
  return ctx;
}
