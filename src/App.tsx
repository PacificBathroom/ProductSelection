// src/App.tsx
import React from "react";
import { SettingsProvider } from "./state/SettingsProvider";
import SettingsBridge from "./state/SettingsBridge";
import ContactProjectForm from "./components/ContactProjectForm";
import ExportButton from "./components/ExportButton";

export default function App() {
  return (
    <SettingsProvider>
      <SettingsBridge />
      <main className="max-w-5xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Project Setup</h1>
        <ContactProjectForm />
        <div className="mt-6">
          <ExportButton />
        </div>
      </main>
    </SettingsProvider>
  );
}

