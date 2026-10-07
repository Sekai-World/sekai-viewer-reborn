import BaseLayer from "./BaseLayer.js";
import type { ILive2DLayerData } from "../player-types.js";
import { SeScenarioEffectType } from "../../../model/scenario-types.js";
import type { Live2DPlayerEventEmitter } from "../Live2DPlayerEventEmitter.js";

import BaseAnimation from "../animation/BaseAnimation.js";
import Line from "../animation/Line.js";
import LineLegend from "../animation/LineLegend.js";
import Kirakira from "../animation/Kirakira.js";
import Blackout from "../animation/Blackout.js";
import Lightup from "../animation/Lightup.js";
import LightupLegend from "../animation/LightupLegend.js";

const LINE_LEGEND_COLORS: Record<string, { color: number; color2: number | undefined }> = {
  line_legend: { color: 0x000000, color2: undefined },
  line_legend_02: { color: 0xffffff, color2: undefined },
  line_legend_02_akito: { color: 0xffffff, color2: 0xff7722 },
  line_legend_02_an: { color: 0xffffff, color2: 0x00bbdd },
  line_legend_02_kohane: { color: 0xffffff, color2: 0xff6699 },
  line_legend_02_toya: { color: 0xffffff, color2: 0x0077dd }
};
const DEFAULT_LINE_LEGEND_COLORS: { color: number; color2: number | undefined } = {
  color: 0x000000,
  color2: undefined
};

const KIRAKIRA_MOVING_TYPES: Record<string, string> = {
  kirakira_01_still_an: "still",
  kirakira_02_still: "still",
  kirakira_03: "inward"
};

const BLACK_OUT_OPACITIES: Record<string, number> = {
  black_out: 0.7,
  black_out_02: 0.8,
  black_out_03: 0.5,
  black_out_04: 0.6
};

const LIGHT_UPS: Record<string, { color: string; light_type: string }> = {
  light_up: { light_type: "normal", color: "255, 255, 235" },
  light_up_fireworks_01: { light_type: "firework", color: "255, 255, 235" },
  light_up_fireworks_02: { light_type: "firework", color: "235, 235, 255" }
};

const LIGHT_UP_LEGEND_FOGS: Record<string, string> = {
  light_up_legend_01: "normal",
  light_up_legend_02: "corner",
  light_up_legend_03: "corner"
};

const DASH_LINE_DIRECTIONS: Record<string, string> = {
  dash_line_l: "left",
  dash_line_r: "right",
  dash_line_down: "down",
  dash_line_up: "up"
};

export default class SceneEffect extends BaseLayer {
  structure: Record<string, never>;
  scene_effects: { type: string; ani: BaseAnimation }[];

  constructor(data: ILive2DLayerData) {
    super(data);
    this.structure = {};
    this.scene_effects = [];
  }

  draw(effect: string, emitter: Live2DPlayerEventEmitter): Promise<void> {
    const container = this.root;
    const catagory = Object.entries(SeScenarioEffectType).find(([, list]) => list.includes(effect));
    if (!catagory) {
      this.logger.warn("SceneEffects", `${effect} not implemented!`);
      emitter.emit("warn", `${effect} not implemented!`);
      return Promise.resolve();
    }
    const ani = this.buildAnimation(catagory[0], effect, emitter);
    if (!ani) return Promise.resolve();
    container.addChild(ani.root);
    this.scene_effects.push({
      type: effect,
      ani: ani
    });
    ani.set_style(this.stage_size);
    ani.start();
    return Promise.resolve();
  }

  private warnUnknownEffect(effect: string, emitter: Live2DPlayerEventEmitter): void {
    this.logger.warn("SceneEffects", `${effect} not implemented!`);
    emitter.emit("warn", `${effect} not implemented!`);
  }

  private buildAnimation(
    catagory: string,
    effect: string,
    emitter: Live2DPlayerEventEmitter
  ): BaseAnimation | undefined {
    switch (catagory) {
      case "line":
        return new Line(0xffffff);
      case "line_legend": {
        const style = LINE_LEGEND_COLORS[effect] ?? DEFAULT_LINE_LEGEND_COLORS;
        return new LineLegend("up", style.color, style.color2);
      }
      case "kirakira": {
        const ani = new Kirakira(this.textures, KIRAKIRA_MOVING_TYPES[effect] ?? "outward");
        this.logger.log("SceneEffects", ani);
        return ani;
      }
      case "black_out":
        return new Blackout(BLACK_OUT_OPACITIES[effect] ?? 0.7);
      case "light_up": {
        const config = LIGHT_UPS[effect] ?? { light_type: "normal", color: "255, 255, 235" };
        return new Lightup(config.color, config.light_type);
      }
      case "light_up_legend":
        return new LightupLegend(this.textures, LIGHT_UP_LEGEND_FOGS[effect] ?? "normal");
      case "dash_line":
        return new LineLegend(DASH_LINE_DIRECTIONS[effect] ?? "left", 0xffffff);
      default:
        this.warnUnknownEffect(effect, emitter);
        return undefined;
    }
  }

  set_style(stage_size?: [number, number]): void {
    this.stage_size = stage_size ?? this.stage_size;
    this.scene_effects.forEach((e) => e.ani.set_style(this.stage_size));
  }

  remove(effect: string) {
    const idx = this.scene_effects.findIndex((e) => e.type === effect);
    if (idx !== -1) {
      this.scene_effects[idx].ani.destroy();
      this.scene_effects.splice(idx, 1);
    }
  }

  destroy() {
    this.scene_effects.forEach((e) => e.ani.destroy());
    this.scene_effects = [];
    super.destroy();
  }
}
