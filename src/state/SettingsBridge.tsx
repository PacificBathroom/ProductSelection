// src/state/SettingsBridge.tsx
import { useEffect } from "react";
import { useSettings } from "./SettingsProvider";
import { store } from "./storeAccess";

export default function SettingsBridge() {
  const { contact, project } = useSettings();
  useEffect(() => {
    store.set({ contact, project });
  }, [contact, project]);
  return null;
}
