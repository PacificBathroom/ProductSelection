// e.g., src/components/ExportButton.tsx
import React from "react";
import { useSettings } from "../state/SettingsProvider";
import { exportDeck } from "../lib/exportPptx";

export default function ExportButton() {
  const { contact, project } = useSettings();
  return (
    <button
      className="px-4 py-2 rounded bg-black text-white"
      onClick={() => exportDeck(contact, project)}
    >
      Export PPTX
    </button>
  );
}
