import { createContext } from "svelte";

export type ContentDisplaySettingsState = {
  showSpoilerContent: boolean;
  mosaickedSpoilerContent: boolean;
  lowMotionMode: boolean;
};

export const [getContentDisplaySettings, setContentDisplaySettings] =
  createContext<ContentDisplaySettingsState>();
