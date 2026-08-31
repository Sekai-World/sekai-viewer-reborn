/**
 * Draft ModelBundleManifest contract for the media-lab 3D Asset/Animation Lab.
 *
 * DRAFT (issue #256): per-bundle layout follows the upstream asset pipeline;
 * availability of compatibility metadata is pending upstream confirmation.
 * See `docs/media-lab/api-contract-audit.md`. Do not build viewer code before
 * #262 finalizes the shapes.
 */

export type ManifestRegion = "jp" | "en" | "tw" | "kr" | "cn";

export interface ModelBundleModel {
  /** Per-bundle directory identifier; model discovery must not use flat `model.fbx` paths. */
  bundleId: string;
  /** Ingestion FBX export path, relative to the bundle root. */
  fbxPath: string;
  /** Sibling texture paths, relative to the bundle root. */
  textures: string[];
  /** Upstream source bundle the export was produced from. */
  sourceBundle: string;
  /** Derived browser viewing asset (glTF/GLB), when conversion exists. */
  derivedViewerAsset?: {
    format: "gltf" | "glb";
    path: string;
  };
}

export interface ModelBundleAnimation {
  name: string;
  /** Animation clip path under `model3d/motion/`, relative to the manifest root. */
  path: string;
  sourceBundle: string;
  /** Rig facts required for compatibility binding, when the upstream pipeline provides them. */
  rig?: {
    skeletonPaths?: string[];
    boneNames?: string[];
    hasAnimator?: boolean;
    blendShapeNames?: string[];
  };
}

export interface ModelBundleCompatibility {
  unityVersion?: string;
  avatar?: string;
  sourceDependencies?: string[];
}

export interface ModelBundleManifest {
  /** Draft schema version; bump when #262 finalizes the contract. */
  schemaVersion: 0;
  region: ManifestRegion;
  models: ModelBundleModel[];
  /** Animation clips stay separate from model exports. */
  animations: ModelBundleAnimation[];
  compatibility?: ModelBundleCompatibility;
}
