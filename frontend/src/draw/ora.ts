/*
 * A drawing as an OpenRaster file (.ora): the layered format Krita, GIMP and
 * MyPaint open, every layer kept with its name, opacity, visibility and blend.
 * It's a zip of PNGs and a stack.xml; stored, not compressed (PNGs are
 * already), which a zip writer does in a page of code.
 */

export interface OraLayer {
  name: string;
  canvas: HTMLCanvasElement;
  opacity: number;
  visible: boolean;
  /** a canvas blend mode: "source-over", "multiply" and so on */
  blend: GlobalCompositeOperation;
}

const png = (c: HTMLCanvasElement) =>
  new Promise<Uint8Array>((resolve, reject) =>
    c.toBlob((b) => (b ? b.arrayBuffer().then((a) => resolve(new Uint8Array(a)), reject) : reject(new Error("Couldn't make a PNG"))), "image/png"),
  );

/** canvas blend modes as OpenRaster names them */
const composite = (blend: GlobalCompositeOperation) =>
  blend === "source-over" ? "svg:src-over" : `svg:${blend}`;

const esc = (s: string) => s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * The file: layers top first, as OpenRaster lists them, the paper under them
 * all, and the picture as it looks (mergedimage) with a thumbnail of it.
 */
export async function oraOf(width: number, height: number, layers: OraLayer[], paper: HTMLCanvasElement, merged: HTMLCanvasElement): Promise<Blob> {
  const files: { name: string; data: Uint8Array }[] = [];
  const enc = new TextEncoder();
  files.push({ name: "mimetype", data: enc.encode("image/openraster") });

  const entries: string[] = [];
  const top = [...layers].reverse();
  for (let i = 0; i < top.length; i++) {
    const l = top[i];
    const src = `data/layer${top.length - i}.png`;
    files.push({ name: src, data: await png(l.canvas) });
    entries.push(
      `<layer name="${esc(l.name)}" src="${src}" x="0" y="0" opacity="${l.opacity.toFixed(3)}" visibility="${l.visible ? "visible" : "hidden"}" composite-op="${composite(l.blend)}"/>`,
    );
  }
  files.push({ name: "data/paper.png", data: await png(paper) });
  entries.push(`<layer name="paper" src="data/paper.png" x="0" y="0" opacity="1.000" visibility="visible" composite-op="svg:src-over"/>`);

  const stack = `<?xml version="1.0" encoding="UTF-8"?>\n<image version="0.0.3" w="${width}" h="${height}">\n<stack>\n${entries.join("\n")}\n</stack>\n</image>\n`;
  files.splice(1, 0, { name: "stack.xml", data: enc.encode(stack) });

  files.push({ name: "mergedimage.png", data: await png(merged) });
  const k = Math.min(1, 256 / Math.max(width, height));
  const thumb = document.createElement("canvas");
  thumb.width = Math.max(1, Math.round(width * k));
  thumb.height = Math.max(1, Math.round(height * k));
  thumb.getContext("2d")!.drawImage(merged, 0, 0, thumb.width, thumb.height);
  files.push({ name: "Thumbnails/thumbnail.png", data: await png(thumb) });

  return new Blob([zip(files)], { type: "image/openraster" });
}

// ─── a zip, stored ──────────────────────────────────────────────────

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** files in order, uncompressed: OpenRaster needs "mimetype" first and stored */
function zip(files: { name: string; data: Uint8Array }[]): Uint8Array<ArrayBuffer> {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // names in UTF-8
    local.setUint16(8, 0, true); // stored
    local.setUint32(14, crc, true);
    local.setUint32(18, f.data.length, true);
    local.setUint32(22, f.data.length, true);
    local.setUint16(26, name.length, true);
    parts.push(new Uint8Array(local.buffer), name, f.data);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, f.data.length, true);
    dir.setUint32(24, f.data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), name);
    offset += 30 + name.length + f.data.length;
  }
  const dirSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, dirSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
