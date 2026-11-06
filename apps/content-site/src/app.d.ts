import type { ComicItem } from "#lib/domain/comic.js";
import type { StampItem } from "#lib/domain/stamp.js";

declare global {
  namespace App {
    interface Locals {}
    interface PageData {}
    interface PageState {
      stampPreview?: { catalogueKey: string; stamp: StampItem };
      comicPreview?: { catalogueKey: string; comic: ComicItem };
    }
    interface Platform {}
  }
}

export {};
