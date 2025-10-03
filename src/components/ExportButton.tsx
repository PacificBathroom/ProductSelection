// src/components/ExportButton.tsx
import React from "react";
import { exportDeck } from "../lib/exportPptx"; // zero-arg legacy wrapper

export default function ExportButton() {
  return (
    <button
      className="px-4 py-2 rounded bg-black text-white"
      onClick={() => exportDeck()}
    >
      Export PPTX
    </button>
  );
}
