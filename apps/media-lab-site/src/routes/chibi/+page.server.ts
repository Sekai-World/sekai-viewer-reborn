import type { ChibiCatalog } from "#lib/chibi/chibi-catalog.js";
import { resolveChibiCatalog } from "#lib/server/chibi-catalog.js";
import type { PageServerLoad } from "./$types";

export const _createChibiCatalogPageLoad =
  (resolveCatalog: typeof resolveChibiCatalog = resolveChibiCatalog): PageServerLoad =>
  ({ fetch }) => {
    // Streamed: the page shell renders before the master API answers.
    const catalog = Promise.resolve()
      .then(() => resolveCatalog(fetch))
      .catch((): ChibiCatalog => ({ status: "error" }));

    return { catalog };
  };

export const load: PageServerLoad = _createChibiCatalogPageLoad();
