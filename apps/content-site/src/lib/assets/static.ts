import { asset } from "$app/paths";
import type { AssetPath } from "$app/types";

/**
 * Resolve a static asset whose path is assembled from a constrained dynamic value.
 * SvelteKit's generated AssetPath union contains exact filenames and cannot represent
 * these runtime-built paths; callers must use a path matching an app-owned static asset.
 */
export const getDynamicStaticAssetURL = (path: string): string => asset(path as AssetPath);
