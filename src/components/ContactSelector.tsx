// src/components/ContactSelector.tsx
import React from "react";
import { useSettings } from "../state/SettingsProvider";

export default function ContactSelector() {
  const { contacts, selectedContactId, selectContactById, contact } = useSettings();

  return (
    <div className="flex flex-col gap-2 mb-2">
      <label className="text-sm font-medium">Team member</label>
      <div className="flex gap-2 items-center">
        <select
          value={selectedContactId ?? ""}
          onChange={(e) => selectContactById(e.target.value || null)}
          className="border rounded px-3 py-2 w-full md:w-80"
          aria-label="Team member"
        >
          <option value="">Custom (type details below)</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.contactName} {c.title ? `— ${c.title}` : ""} {c.email ? `(${c.email})` : ""}
            </option>
          ))}
        </select>
        <div className="text-xs text-gray-600 hidden md:block">
          <div><strong>{contact.contactName || "—"}</strong>{contact.title ? `, ${contact.title}` : ""}</div>
          <div>{contact.email || "—"}{contact.phone ? ` • ${contact.phone}` : ""}</div>
        </div>
      </div>
    </div>
  );
}
