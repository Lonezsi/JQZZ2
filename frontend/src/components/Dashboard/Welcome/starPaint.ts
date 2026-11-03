/* How the poster's star is drawn: StarFlare draws it once, the launch (components/common/LaunchStar.tsx) every frame as it nears. */

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, stops: [number, string][]) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  stops.forEach(([at, c]) => g.addColorStop(at, c));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/**
 * One arm pair of the +: a needle through the centre, widest there and
 * thinning to nothing at the tips, its light falling off along the way.
 */
function spike(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  length: number,
  width: number,
  vertical: boolean,
  colour: [number, number, number],
  alpha: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  if (vertical) ctx.rotate(Math.PI / 2);
  const g = ctx.createLinearGradient(-length, 0, length, 0);
  const [r, gg, b] = colour;
  const at = (a: number) => `rgba(${r}, ${gg}, ${b}, ${a * alpha})`;
  // light along a diffraction spike falls off slowly, then all at once
  const stops: [number, number][] = [
    [0, 0],
    [0.06, 0.06],
    [0.18, 0.18],
    [0.3, 0.36],
    [0.4, 0.58],
    [0.46, 0.85],
    [0.5, 1],
  ];
  stops.forEach(([p, v]) => g.addColorStop(p, at(v)));
  stops
    .slice(0, -1)
    .reverse()
    .forEach(([p, v]) => g.addColorStop(1 - p, at(v)));
  ctx.fillStyle = g;
  ctx.beginPath();
  // a long, thin lens shape: curved sides so it thins smoothly, not like a kite
  ctx.moveTo(-length, 0);
  ctx.quadraticCurveTo(-length * 0.08, -width, 0, -width);
  ctx.quadraticCurveTo(length * 0.08, -width, length, 0);
  ctx.quadraticCurveTo(length * 0.08, width, 0, width);
  ctx.quadraticCurveTo(-length * 0.08, width, -length, 0);
  ctx.fill();
  ctx.restore();
}

const ramp = (a: number, b: number, x: number) => Math.min(1, Math.max(0, (x - a) / (b - a)));

/**
 * The star at (cx, cy): its horizontal arms reach H either way, its vertical
 * ones V, and s is the size the rest is drawn for. near is how close it is,
 * 0 to 1: from far off it's only a line of light (the vertical arm, a pinprick
 * core), and the side arms, the bloom and the faint blades come in as it nears.
 * soft draws the blurred passes, which are too slow to draw every frame.
 */
export function paintStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  H: number,
  V: number,
  s: number,
  k: number,
  near: number,
  soft: boolean,
) {
  const side = ramp(0.12, 1, near) ** 1.4;
  const glowing = ramp(0.3, 1, near);
  const blades = ramp(0.65, 1, near);
  ctx.globalCompositeOperation = "lighter";

  // the wide haze the light throws into the lens, warm and violet
  if (glowing > 0)
    glow(ctx, cx, cy, 340 * s, [
      [0, `rgba(255, 170, 205, ${0.2 * glowing})`],
      [0.35, `rgba(190, 140, 255, ${0.08 * glowing})`],
      [1, "rgba(120, 90, 255, 0)"],
    ]);

  // the + : soft wide passes first, then the sharp needles, with a red and a
  // blue copy a little longer and shorter for the lens's colour split
  if (soft) {
    ctx.filter = `blur(${6 * k}px)`;
    if (side > 0) spike(ctx, cx, cy, H * 0.9 * side, 9 * s, false, [255, 150, 200], 0.45);
    spike(ctx, cx, cy, V * 0.9, 8 * s, true, [255, 150, 200], 0.4);
    ctx.filter = `blur(${1.5 * k}px)`;
  }
  if (side > 0) {
    spike(ctx, cx, cy, H * side, 3 * s, false, [255, 120, 150], 0.7);
    spike(ctx, cx, cy, H * 0.85 * side, 3 * s, false, [140, 170, 255], 0.6);
  }
  spike(ctx, cx, cy, V, 2.8 * s, true, [255, 120, 150], 0.65);
  spike(ctx, cx, cy, V * 0.82, 2.8 * s, true, [140, 170, 255], 0.55);
  ctx.filter = "none";
  if (side > 0) spike(ctx, cx, cy, H * 0.96 * side, 1.3 * s, false, [255, 245, 250], 1);
  // far off, the line is all there is: it's drawn a little bolder than its size
  spike(ctx, cx, cy, V * 0.9, Math.max(1.3 * s, 1.2 * k), true, [255, 245, 250], 1);
  // a faint second set at 45°, much shorter: the aperture's other blades
  if (blades > 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.translate(-cx, -cy);
    if (soft) ctx.filter = `blur(${1 * k}px)`;
    spike(ctx, cx, cy, 70 * s, 1.4 * s, false, [255, 220, 240], 0.35 * blades);
    spike(ctx, cx, cy, 70 * s, 1.4 * s, true, [255, 220, 240], 0.35 * blades);
    ctx.filter = "none";
    ctx.restore();
  }

  // bloom, and the core where the sensor simply gives up
  glow(ctx, cx, cy, 70 * s * (0.3 + 0.7 * glowing), [
    [0, "rgba(255, 236, 246, 0.95)"],
    [0.25, "rgba(255, 196, 225, 0.55)"],
    [0.6, "rgba(220, 150, 255, 0.12)"],
    [1, "rgba(200, 140, 255, 0)"],
  ]);
  const core = Math.max(16 * s, 3 * k);
  glow(ctx, cx, cy, core, [
    [0, "rgba(255, 255, 255, 1)"],
    [0.45, "rgba(255, 255, 255, 1)"],
    [1, "rgba(255, 240, 248, 0)"],
  ]);
  ctx.globalCompositeOperation = "source-over";
}
