import { createContext } from "svelte";

export type ContentDisplaySettingsState = {
  showSpoilerContent: boolean;
  mosaickedSpoilerContent: boolean;
};

export const [getContentDisplaySettings, setContentDisplaySettings] =
  createContext<ContentDisplaySettingsState>();
