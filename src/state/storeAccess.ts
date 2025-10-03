// src/state/storeAccess.ts
import type { ContactInfo, ProjectMeta } from "../types";

let snapshot: { contact: ContactInfo; project: ProjectMeta } = {
  contact: { contactName: "", email: "" },
  project: { presentationDate: new Date().toISOString().slice(0, 10) },
};

export const store = {
  get() {
    return snapshot;
  },
  set(next: { contact: ContactInfo; project: ProjectMeta }) {
    snapshot = next;
  },
};
