import type { ILive2DLayerData, ILive2DScenarioResource } from "./player-types.js";
import type { PixiStoryAudioAdapter } from "./audio-adapter.js";
import type { StoryPlayerLogger } from "../../core/log.js";
import { Container, Texture } from "pixi.js";
import type { Application } from "pixi.js";

import { log } from "../../core/log.js";

// layers
import Background from "./layer/Background.js";
import Fullcolor from "./layer/Fullcolor.js";
import Dialog from "./layer/Dialog.js";
import Telop from "./layer/Telop.js";
import PlaceInfo from "./layer/PlaceInfo.js";
import SceneEffect from "./layer/SceneEffect.js";
import Live2D from "./layer/Live2D.js";
import Wipe from "./layer/Wipe.js";
import Sekai from "./layer/Sekai.js";
import FullScreenText from "./layer/FullScreenText.js";
import Movie from "./layer/Movie.js";

import AnimationController from "./animation/AnimationController.js";
import { Live2DPlayerEventEmitter } from "./Live2DPlayerEventEmitter.js";

export class Live2DPlayer {
  app: Application;
  stage_size: [number, number];
  animate: AnimationController;
  root: Container;
  UIRoot: Container;
  layers: {
    background: Background;
    fullcolor: Fullcolor;
    memory_filter: Fullcolor;
    dialog: Dialog;
    fullscreen_text: FullScreenText;
    telop: Telop;
    place_info: PlaceInfo;
    flashback_filter: Fullcolor;
    scene_effect: SceneEffect;
    live2d: Live2D;
    wipe: Wipe;
    sekai: Sekai;
    movie: Movie;
  };
  camera: {
    pivot: [number, number];
    position: [number, number];
    scale: [number, number];
    rotation: number;
  };
  events: Live2DPlayerEventEmitter;
  readonly logger: StoryPlayerLogger;

  constructor(
    app: Application,
    stage_size: [number, number],
    ui_assets: ILive2DScenarioResource,
    screen_length = 2000,
    audioAdapter?: PixiStoryAudioAdapter,
    logger: StoryPlayerLogger = log
  ) {
    this.app = app;
    this.stage_size = stage_size;
    this.animate = new AnimationController();
    this.events = new Live2DPlayerEventEmitter();
    this.logger = logger;
    // create texture
    const textures = ui_assets.image.map((asset) => ({
      identifier: asset.identifier,
      texture: Texture.from(asset.data)
    }));

    //initilize stage
    app.stage.removeChildren();
    app.stage.eventMode = "none";
    app.stage.interactiveChildren = false;
    const layer_data: ILive2DLayerData = {
      stage_size: this.stage_size,
      screen_length: screen_length,
      animation_controller: this.animate,
      textures: textures,
      audioAdapter,
      logger: this.logger
    };
    this.layers = {
      background: new Background(layer_data),
      fullcolor: new Fullcolor(layer_data),
      fullscreen_text: new FullScreenText(layer_data),
      telop: new Telop(layer_data),
      place_info: new PlaceInfo(layer_data),
      flashback_filter: new Fullcolor(layer_data),
      scene_effect: new SceneEffect(layer_data),
      dialog: new Dialog(layer_data),
      memory_filter: new Fullcolor(layer_data),
      live2d: new Live2D(layer_data),
      wipe: new Wipe(layer_data),
      sekai: new Sekai(layer_data),
      movie: new Movie(layer_data)
    };
    const root = new Container();
    this.root = root;

    const UIRoot = new Container();
    this.UIRoot = UIRoot;

    app.stage.addChild(root);
    app.stage.addChild(UIRoot);

    root.addChild(this.layers.background.root);
    root.addChild(this.layers.live2d.root);
    root.addChild(this.layers.scene_effect.root);
    root.addChild(this.layers.memory_filter.root);
    root.addChild(this.layers.flashback_filter.root);

    root.addChild(this.layers.telop.root);
    root.addChild(this.layers.sekai.root);
    root.addChild(this.layers.wipe.root);
    root.addChild(this.layers.fullcolor.root);
    root.addChild(this.layers.fullscreen_text.root);
    root.addChild(this.layers.movie.root);

    UIRoot.addChild(this.layers.dialog.root);
    UIRoot.addChild(this.layers.place_info.root);

    this.camera = {
      pivot: [0.5, 0.5],
      position: [0, 0],
      scale: [1, 1],
      rotation: 0
    };
    this.set_stage_size(stage_size);
    this.logger.log("Live2DPlayer", `player init.`);
  }

  set_style = () => {
    this.root.pivot.set(
      this.stage_size[0] * this.camera.pivot[0],
      this.stage_size[1] * this.camera.pivot[1]
    );
    this.root.position.set(
      this.stage_size[0] * (this.camera.pivot[0] - this.camera.position[0] / this.camera.scale[0]),
      this.stage_size[1] * (this.camera.pivot[1] + this.camera.position[1] / this.camera.scale[1])
    );
    this.root.scale.set(this.camera.scale[0], this.camera.scale[1]);
    this.root.rotation = this.camera.rotation;
  };

  set_stage_size = (stage_size: [number, number]) => {
    this.stage_size = stage_size;
    this.set_style();
    Object.values(this.layers).forEach((l) => l.set_style(this.stage_size));
  };

  public destroy() {
    // abort all animations
    this.animate.abort_controller.abort();
    // destroy all layers
    Object.values(this.layers).forEach((l) => l.destroy());
    // clean up containers
    this.UIRoot.destroy();
    this.root.destroy();
  }
}
