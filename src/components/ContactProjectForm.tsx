// src/components/ContactProjectForm.tsx
import React from "react";
import { useSettings } from "../state/SettingsProvider";
import DateInput from "./DateInput";
import ContactSelector from "./ContactSelector";

export default function ContactProjectForm() {
  const { contact, project, setContact, setProject, resetToDefaults } = useSettings();

  return (
    <form className="form-grid">
      <div className="form-head">
        <h3>Contact Details</h3>
        <button type="button" onClick={resetToDefaults} className="ghost">Reset to defaults</button>
      </div>

      <ContactSelector />

      <div className="grid-3">
        <TextField label="Name" value={contact.contactName}
          onChange={(v) => setContact({ ...contact, contactName: v })} required />
        <TextField label="Email" type="email" value={contact.email}
          onChange={(v) => setContact({ ...contact, email: v })} required />
        <TextField label="Phone" value={contact.phone ?? ""}
          onChange={(v) => setContact({ ...contact, phone: v })} />
        <TextField label="Title" value={contact.title ?? ""}
          onChange={(v) => setContact({ ...contact, title: v })} />
        <TextField label="Company" value={contact.company ?? ""}
          onChange={(v) => setContact({ ...contact, company: v })} />
      </div>

      <h3 className="mt-4">Project</h3>
      <div className="grid-3">
        <TextField label="Project name" value={project.projectName ?? ""}
          onChange={(v) => setProject({ ...project, projectName: v })} />
        <TextField label="Client name" value={project.clientName ?? ""}
          onChange={(v) => setProject({ ...project, clientName: v })} />
        <DateInput label="Presentation date" value={project.presentationDate}
          onChange={(v) => setProject({ ...project, presentationDate: v })} required />
      </div>
    </form>
  );
}

function TextField({
  label, value, onChange, required, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string;
}) {
  const id = React.useId();
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        required={required}
      />
    </label>
  );
}
