import BaseAnimation from "./BaseAnimation";
import { Sprite, Texture, Rectangle } from "pixi.js";
import { Curve } from "./Curve";
import type { ILive2DTexture } from "../player-types";

export default class Kirakira extends BaseAnimation {
  private readonly moving_type: string;
  constructor(textures: ILive2DTexture[], moving_type: string) {
    super({ textures });
    this.period_ms = 10000;
    this.moving_type = moving_type;

    const base_texture = this.textures.find(
      (a) => a.identifier === "ui/tex_kirakira_01"
    )!.texture.baseTexture;
    const texture_big_circle = new Texture(
      base_texture,
      new Rectangle(0, 256, 256, 256)
    );
    const texture_big_sparkle = new Texture(
      base_texture,
      new Rectangle(256, 0, 256, 256)
    );
    const texture_small_circle = new Texture(
      base_texture,
      new Rectangle(128, 0, 128, 128)
    );
    const texture_small_sparkle = new Texture(
      base_texture,
      new Rectangle(0, 0, 128, 128)
    );

    // background not move sparkle
    this.add_scattered_sprites(texture_small_sparkle, 15, [0.5, 1], [0.05, 0.1]);
    // background not move small circle
    this.add_scattered_sprites(texture_small_circle, 15, [0.5, 1], [0.05, 0.1]);
    // background not move big circle
    this.add_scattered_sprites(texture_big_circle, 10, [0.4, 1.2], [0.05, 0.1]);
    // background moving sparkle
    this.add_scattered_sprites(
      texture_big_sparkle,
      20,
      [0.6, 1],
      [0.05, 0.2],
      () => new Curve().bounce().loop(5).map_range(0.2, 0.9)
    );
    if (this.moving_type !== "still") {
      let curve = new Curve();
      if (this.moving_type === "outward") {
        curve = curve.easeOutExpo().shrink(0.1, 1);
      } else {
        curve = curve.easeOutExpo().shrink(0.1, 1).shrink(0.95).offset(0.05);
      }
      // show big circle
      this.add_moving_sprites(texture_big_circle, 15, curve, true);
      // show sparkle
      this.add_moving_sprites(texture_big_sparkle, 15, curve, false);
    }

    // add alpha mask
    const mask_curve = new Curve().bounce(0.05, 0.05);
    this.settings.forEach((s) => {
      if (s.alpha_curve) {
        s.alpha_curve = s.alpha_curve.multiply(mask_curve);
      } else {
        s.alpha_curve = mask_curve;
      }
    });
  }

  /**
   * Adds `count` sprites scattered over the stage, each drifting from a
   * random position toward a random nearby point. Kept as a helper of the
   * constructor while preserving the original per-iteration `random` call
   * order: scale, position, distance, rotation.
   */
  private add_scattered_sprites(
    texture: Texture,
    count: number,
    scale_range: [number, number],
    distance_range: [number, number],
    alpha_curve?: () => Curve
  ) {
    for (let i = 0; i < count; i++) {
      const obj = new Sprite(texture);
      obj.anchor.set(0.5);
      const scale = this.random(scale_range[0], scale_range[1]);
      const position: [number, number] = [this.random(0, 1), this.random(0, 1)];
      const distance = this.random(distance_range[0], distance_range[1]);
      const rotation = this.random(0, 2 * Math.PI);
      const position_to: [number, number] = [
        position[0] + Math.cos(rotation) * distance,
        position[1] + Math.sin(rotation) * distance,
      ];
      this.settings.push({
        obj,
        scale: () => (scale * this.em(150)) / 256,
        x_curve: new Curve().map_range(position[0], position_to[0]),
        y_curve: new Curve().map_range(position[1], position_to[1]),
        ...(alpha_curve ? { alpha_curve: alpha_curve() } : {}),
      });
      this.root.addChild(obj);
    }
  }

  /**
   * Adds `count` sprites bursting from the stage center along `curve`.
   * Preserves the original per-iteration `random` call order: scale,
   * distance, rotation.
   */
  private add_moving_sprites(
    texture: Texture,
    count: number,
    curve: Curve,
    with_alpha_curve: boolean
  ) {
    for (let i = 0; i < count; i++) {
      const obj = new Sprite(texture);

      obj.anchor.set(0.5);
      const scale = this.random(0.6, 1);
      const distance = this.random(0.3, 0.5);
      const rotation = this.random(0, 2 * Math.PI);
      let position: [number, number] = [0.5, 0.5];
      let position_to: [number, number] = [
        0.5 + Math.cos(rotation) * distance,
        0.5 + Math.sin(rotation) * distance,
      ];
      let curve_alpha = new Curve(() => 1);
      if (this.moving_type === "inward") {
        const t = position;
        position = position_to;
        position_to = t;
        if (with_alpha_curve) {
          curve_alpha = new Curve()
            .easeOutExpo()
            .shrink(0.1, 1)
            .shrink(0.95)
            .offset(0.05)
            .map_range(1, 0);
        }
      }
      this.settings.push({
        obj,
        scale_func: (t) =>
          curve
            .map_range(
              (this.em(150) * 0.1) / 256,
              (this.em(150) * scale) / 256
            )
            .p(t),
        x_curve: curve.map_range(position[0], position_to[0]),
        y_curve: curve.map_range(position[1], position_to[1]),
        ...(with_alpha_curve ? { alpha_curve: curve_alpha } : {}),
      });
      this.root.addChild(obj);
    }
  }
}
