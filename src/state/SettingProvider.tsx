// src/state/SettingsProvider.tsx
import React, { createContext, useContext, useMemo } from "react";
import { useLocalStorage } from "../lib/useLocalStorage";
import type { ContactInfo, ProjectMeta } from "../types";

type Settings = {
  contact: ContactInfo;
  project: ProjectMeta;
  setContact: (c: ContactInfo) => void;
  setProject: (p: ProjectMeta) => void;
  resetToDefaults: () => void;
};

const Ctx = createContext<Settings | null>(null);

function envDefault<T = string>(key: string, fallback?: T): T | undefined {
  const v = (import.meta.env?.[key] ?? "").trim();
  return (v ? (v as unknown as T) : fallback) as T | undefined;
}

function parseUrlOverrides(): Partial<ContactInfo & ProjectMeta> {
  const params = new URLSearchParams(location.search);
  const pick = (k: string) => {
    const v = params.get(k);
    return v && v.trim() ? v.trim() : undefined;
  };
  return {
    contactName: pick("contactName") ?? pick("name"),
    email:       pick("email"),
    phone:       pick("phone"),
    title:       pick("title"),
    company:     pick("company"),
    projectName: pick("projectName") ?? pick("project"),
    clientName:  pick("clientName") ?? pick("client"),
    presentationDate: pick("date") ?? pick("presentationDate"),
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
  presentationDate: new Date().toISOString().slice(0, 10), // today
};

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  // start with defaults
  const url = parseUrlOverrides();
  const seededContact: ContactInfo = {
    ...DEFAULT_CONTACT,
    ...(url as Partial<ContactInfo>),
  };
  const seededProject: ProjectMeta = {
    ...DEFAULT_PROJECT,
    ...(url as Partial<ProjectMeta>),
  };

  const [contact, setContact] = useLocalStorage<ContactInfo>("pb:contact", seededContact);
  const [project, setProject] = useLocalStorage<ProjectMeta>("pb:project", seededProject);

  const resetToDefaults = () => {
    setContact({ ...DEFAULT_CONTACT, ...(parseUrlOverrides() as Partial<ContactInfo>) });
    setProject({ ...DEFAULT_PROJECT, ...(parseUrlOverrides() as Partial<ProjectMeta>) });
  };

  const value = useMemo<Settings>(
    () => ({ contact, project, setContact, setProject, resetToDefaults }),
    [contact, project]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSettings must be used within <SettingsProvider>");
  return ctx;
}
