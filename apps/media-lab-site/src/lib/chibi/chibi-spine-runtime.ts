import type { Spine } from "@esotericsoftware/spine-pixi";
import type {
  ChibiRuntimeFacade,
  ChibiSpineModel,
  ChibiSpineRuntime,
  ChibiStage
} from "./chibi-player";

/** Share of the stage's shorter side that the model's larger side may fill. */
const STAGE_FILL_RATIO = 0.8;

const DESTROY_OPTIONS = { children: true } as const;

interface ModelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PixiModel {
  spine: Spine;
  /** Setup-pose bounds in the model's own coordinates. */
  bounds: ModelBounds;
}

const getDevicePixelRatio = (): number =>
  typeof window === "undefined" ? 1 : Math.max(1, window.devicePixelRatio || 1);

const loadSpineRuntime = async (): Promise<ChibiSpineRuntime> => {
  const [pixi, spine] = await Promise.all([
    import("pixi.js"),
    import("@esotericsoftware/spine-pixi")
  ]);
  const pixiModels = new WeakMap<ChibiSpineModel, PixiModel>();

  return {
    createStage(host): ChibiStage {
      const app = new pixi.Application({
        antialias: true,
        autoDensity: true,
        backgroundAlpha: 0,
        resolution: getDevicePixelRatio(),
        width: host.clientWidth,
        height: host.clientHeight
      });
      const view = app.view as unknown as HTMLElement;
      host.appendChild(view);
      let shown: PixiModel | undefined;
      // The stage's own ticker drives the model, so nothing outlives the stage
      // on Pixi's shared ticker.
      app.ticker.add(() => shown?.spine.update(app.ticker.deltaMS / 1000));

      const layout = (): void => {
        if (!shown) return;
        const { width, height } = app.screen;
        const { spine: object, bounds } = shown;
        const scale =
          (Math.min(width, height) * STAGE_FILL_RATIO) / Math.max(bounds.width, bounds.height, 1);
        object.scale.set(scale);
        object.position.set(
          width / 2 - (bounds.x + bounds.width / 2) * scale,
          height / 2 - (bounds.y + bounds.height / 2) * scale
        );
      };

      return {
        show(model) {
          const pixiModel = pixiModels.get(model);
          if (!pixiModel) throw new Error("Chibi model was created by another runtime");
          shown = pixiModel;
          app.stage.addChild(pixiModel.spine);
          layout();
        },
        resize(width, height) {
          app.renderer.resize(width, height);
          layout();
        },
        destroy() {
          shown = undefined;
          // The model is destroyed by its owner; only the canvas goes here.
          app.stage.removeChildren();
          app.destroy(true);
        }
      };
    },

    async createModel({ atlasText, textureUrl, skeletonBytes }) {
      const atlas = new spine.TextureAtlas(atlasText);
      // `pma:true` atlases (main and v2 families) hold premultiplied colors and
      // must be uploaded as-is; the mob family has straight alpha, which Pixi
      // premultiplies on upload. Either way an image element keeps the raw pixels.
      const premultiplied = atlas.pages.every((page) => page.pma);
      // Built directly instead of through `BaseTexture.from`, which would share
      // one cached texture between two loads of the same model.
      const baseTexture = new pixi.BaseTexture(
        new pixi.ImageResource(textureUrl, {
          autoLoad: false,
          createBitmap: false,
          crossorigin: "anonymous"
        }),
        { alphaMode: premultiplied ? pixi.ALPHA_MODES.PMA : pixi.ALPHA_MODES.UNPACK }
      );
      let object: Spine | undefined;
      const release = (): void => {
        object?.destroy(DESTROY_OPTIONS);
        atlas.dispose();
        baseTexture.destroy();
      };

      let bounds: ModelBounds;
      let animationNames: string[];
      try {
        await baseTexture.resource.load();
        for (const page of atlas.pages) page.setTexture(spine.SpineTexture.from(baseTexture));

        const parser = new spine.SkeletonBinary(new spine.AtlasAttachmentLoader(atlas));
        object = new spine.Spine(parser.readSkeletonData(skeletonBytes), { autoUpdate: false });
        object.state.data.defaultMix = 0;
        animationNames = object.skeleton.data.animations.map((animation) => animation.name);
        const { x, y, width, height } = object.getLocalBounds();
        bounds = { x, y, width, height };
      } catch (error) {
        release();
        throw error;
      }

      const created = object;
      const model: ChibiSpineModel = {
        animationNames,
        setAnimation(name, loop) {
          created.state.setAnimation(0, name, loop);
        },
        destroy: release
      };
      pixiModels.set(model, { spine: created, bounds });
      return model;
    }
  };
};

/** Browser-only runtime: Pixi 7 with the Spine 4.1 runtime, assets via `fetch`. */
export const createChibiRuntimeFacade = (): ChibiRuntimeFacade => {
  let spineRuntime: Promise<ChibiSpineRuntime> | undefined;

  return {
    loadSpine: () => (spineRuntime ??= loadSpineRuntime()),
    fetchAsset: (url, signal) => fetch(url, { signal })
  };
};
