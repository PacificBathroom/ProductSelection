// src/components/ContactProjectForm.tsx
import React from "react";
import { useSettings } from "../state/SettingsProvider";
import DateInput from "./DateInput";
import ContactSelector from "./ContactSelector";

export default function ContactProjectForm() {
  const { contact, project, setContact, setProject, resetToDefaults } = useSettings();

  return (
    <form className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="col-span-1 md:col-span-2">
        <h3 className="text-lg font-semibold mb-2">Contact Details</h3>

        <ContactSelector />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
          <TextField
            label="Name"
            value={contact.contactName}
            onChange={(v) => setContact({ ...contact, contactName: v })}
            required
          />
          <TextField
            label="Email"
            type="email"
            value={contact.email}
            onChange={(v) => setContact({ ...contact, email: v })}
            required
          />
          <TextField
            label="Phone"
            value={contact.phone ?? ""}
            onChange={(v) => setContact({ ...contact, phone: v })}
          />
          <TextField
            label="Title"
            value={contact.title ?? ""}
            onChange={(v) => setContact({ ...contact, title: v })}
          />
          <TextField
            label="Company"
            value={contact.company ?? ""}
            onChange={(v) => setContact({ ...contact, company: v })}
          />
        </div>
      </div>

      <div className="col-span-1 md:col-span-2">
        <h3 className="text-lg font-semibold mb-2">Project</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <TextField
            label="Project name"
            value={project.projectName ?? ""}
            onChange={(v) => setProject({ ...project, projectName: v })}
          />
          <TextField
            label="Client name"
            value={project.clientName ?? ""}
            onChange={(v) => setProject({ ...project, clientName: v })}
          />
          <DateInput
            label="Presentation date"
            value={project.presentationDate}
            onChange={(v) => setProject({ ...project, presentationDate: v })}
            required
          />
        </div>
      </div>

      <div className="col-span-1 md:col-span-2 flex gap-2">
        <button
          type="button"
          onClick={resetToDefaults}
          className="px-3 py-2 rounded bg-gray-100 hover:bg-gray-200"
          title="Reset to defaults (env + URL)"
        >
          Reset to defaults
        </button>
      </div>
    </form>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="border rounded px-3 py-2 outline-none focus:ring w-full"
        placeholder={label}
      />
    </div>
  );
}
