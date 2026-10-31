import type { StampItem } from "#lib/domain/stamp.js";

declare global {
  namespace App {
    interface Locals {}
    interface PageData {}
    interface PageState {
      stampPreview?: { catalogueKey: string; stamp: StampItem };
    }
    interface Platform {}
  }
}

export {};
