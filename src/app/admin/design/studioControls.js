/* UI and pixel interactions ported from the administrator's supplied candy-mockup.html.
 * Candy drawing and persistence are deliberately delegated to the shared application framework.
 */
/* eslint-disable @typescript-eslint/no-unused-vars */
export function mountStudioControls(document, window, bridge) {
  const localStorage = window.localStorage;
  const timers = [];
  const setTimeout = (fn, ms) => {
    const id = window.setTimeout(fn, ms);
    timers.push(id);
    return id;
  };
  const clearTimeout = (id) => window.clearTimeout(id);
  const addEventListener = (...args) => window.addEventListener(...args);

  const W = 1772,
    H = 1300,
    TAU = Math.PI * 2;
  const $ = (s) => document.querySelector(s);
  const main = $("#main"),
    ov = $("#ov"),
    mctx = main.getContext("2d"),
    octx = ov.getContext("2d");
  main.width = ov.width = W;
  main.height = ov.height = H;
  const sctx = document.createElement("canvas").getContext("2d");
  const FACE = { cx: 545, cy: 660, R: 532 };
  const FONTS = [
    ["Helvetica", "Helvetica / Arial"],
    ["Montserrat"],
    ["Poppins"],
    ["Oswald"],
    ["Bebas Neue"],
    ["Playfair Display"],
    ["Cormorant Garamond"],
    ["Georgia"],
    ["Pacifico"],
    ["Dancing Script"],
    ["Great Vibes"],
    ["Lobster"],
    ["Courier New"],
    ["Roboto"],
    ["Roboto Slab"],
    ["Roboto Mono"],
  ];
  const stack = (f) => bridge.fontFamily(f);
  const PALETTE = [
    "#ffffff",
    "#f2d2bd",
    "#f4a6c0",
    "#e63946",
    "#ee8456",
    "#f6d24a",
    "#d3e5bd",
    "#2f8f3a",
    "#cfe6f0",
    "#5cc9bf",
    "#3d6ae6",
    "#1c2a6b",
    "#d9d2fb",
    "#9b6fe0",
    "#4b1f8c",
    "#e3cf9f",
    "#8a7a58",
    "#9a9aa8",
    "#3a3a46",
    "#111111",
  ];
  let custom = [];
  try {
    custom = JSON.parse(localStorage.getItem("rc_palette") || "[]");
  } catch (e) {
    custom = [];
  }
  const state = {
    jacket: {
      style: "segmented",
      segments: 8,
      gap: 0.15,
      cols: 2,
      ring: 0.19,
      shade: 0.35,
      shadow: true,
      colorA: "#f2d2bd",
      colorB: "#cfe6f0",
      colorC: "#d3e5bd",
      colorD: "#d9d2fb",
      face: "#ffffff",
      pin: "#ffffff",
    },
    bg: "#ffffff",
    transparent: false,
    layers: [],
    sel: null,
    tool: "move",
    prevTool: null,
    target: "A",
    tol: 40,
    selection: null,
    zoom: 1,
    recol: "#d6336c",
    brush: { color: "#e63946", size: 28, erase: false },
    eraser: { size: 30 },
    mask: null,
    hover: null,
  };
  let uid = 1;
  const geom = () => {
    const { cx, cy, R } = FACE;
    return { cx, cy, R, rIn: bridge.faceRadius(state) };
  };

  /* ---------- history ---------- */
  let hist = [],
    redo = [],
    lastTag = "",
    lastT = 0;
  function boundHistory() {
    let bytes = 0;
    const seen = new Set();
    for (let i = hist.length - 1; i >= 0; i--) {
      for (const l of hist[i].layers) {
        if (l.img && !seen.has(l.img)) {
          seen.add(l.img);
          bytes += l.img.width * l.img.height * 4;
        }
      }
      if (bytes > 96000000 && i < hist.length - 1) {
        hist = hist.slice(i + 1);
        break;
      }
    }
  }
  const snap = () => ({
    layers: state.layers.map((l) => ({ ...l })),
    jacket: { ...state.jacket },
    bg: state.bg,
    sel: state.sel,
    zoom: state.zoom,
    transparent: state.transparent,
    caption: $("#caption").value,
    productionNotes: state.productionNotes,
  });
  function touch(tag) {
    const n = Date.now();
    if (tag !== lastTag || n - lastT > 1000) {
      hist.push(snap());
      if (hist.length > 80) hist.shift();
      boundHistory();
      redo = [];
    }
    lastTag = tag;
    lastT = n;
    syncUndo();
  }
  function restore(s) {
    state.layers = s.layers.map((l) => ({ ...l }));
    Object.assign(state.jacket, s.jacket);
    state.bg = s.bg;
    state.productionNotes = s.productionNotes || "";
    $("#productionNotes").value = state.productionNotes;
    state.transparent = s.transparent === true;
    $("#caption").value = s.caption || "";
    state.zoom = s.zoom || 1;
    state.sel = s.sel;
    state.selection = null;
    state.mask = null;
    lastTag = "";
    refreshAll();
  }
  function undo() {
    if (!hist.length) return;
    redo.push(snap());
    restore(hist.pop());
    syncUndo();
  }
  function redoF() {
    if (!redo.length) return;
    hist.push(snap());
    restore(redo.pop());
    syncUndo();
  }
  function syncUndo() {
    $("#undo").disabled = !hist.length;
    $("#redo").disabled = !redo.length;
  }

  /* ---------- layers ---------- */
  const setFont = (ctx, l) => {
    ctx.font =
      (l.italic ? "italic " : "") +
      (l.bold ? "700" : "400") +
      " " +
      l.size +
      "px " +
      stack(l.font);
  };
  const txt = (l) => (l.caps ? l.text.toUpperCase() : l.text);
  function lineW(ctx, l, s) {
    if (!l.spacing) return ctx.measureText(s).width;
    let w = 0;
    for (const ch of s) w += ctx.measureText(ch).width + l.spacing;
    return w - l.spacing;
  }
  function textMetrics(l) {
    setFont(sctx, l);
    const lines = txt(l).split("\n"),
      lh = l.size * 1.15;
    let w = 0;
    for (const s of lines) w = Math.max(w, lineW(sctx, l, s));
    return { lines, lh, w, h: lh * lines.length };
  }
  function arcInfo(ctx, l) {
    setFont(ctx, l);
    const g = geom(),
      chars = [...txt(l)],
      ws = chars.map((c) => ctx.measureText(c).width + l.spacing);
    const r = l.radiusF * g.rIn,
      total = Math.max(0, ws.reduce((a, b) => a + b, 0) - l.spacing),
      top = l.side === "top";
    return {
      chars,
      ws,
      r,
      span: total / r,
      top,
      a0: (top ? -Math.PI / 2 : Math.PI / 2) + (l.angle * Math.PI) / 180,
    };
  }
  function jacketPaths() {
    return bridge.jacketPaths(state);
  }
  function render() {
    bridge.changed(state, $("#caption").value);
  }
  function paint() {
    render();
    drawOverlay();
    updateExpInfo();
  }

  /* ---------- geometry helpers ---------- */
  const cur = () => state.layers.find((l) => l.id === state.sel) || null;
  const sx = (l) => (l.original?.scaleX ?? 1) * (l.original?.flipX ? -1 : 1),
    sy = (l) => (l.original?.scaleY ?? 1) * (l.original?.flipY ? -1 : 1);
  function toLocal(l, p) {
    const r = (-l.rot * Math.PI) / 180,
      dx = p.x - l.x,
      dy = p.y - l.y;
    return {
      x:
        (dx * Math.cos(r) - dy * Math.sin(r)) / (l.scale * sx(l)) +
        l.img.width / 2,
      y:
        (dx * Math.sin(r) + dy * Math.cos(r)) / (l.scale * sy(l)) +
        l.img.height / 2,
    };
  }
  function halfBox(l) {
    if (l.type === "text") {
      const m = textMetrics(l);
      return { w: m.w / 2 + 8, h: m.h / 2 + 6 };
    }
    if (["heart", "circle", "star"].includes(l.type))
      return { w: l.size / 2, h: l.size * 0.46 };
    if (l.type === "image")
      return {
        w: (l.img.width * l.scale * Math.abs(sx(l))) / 2,
        h: (l.img.height * l.scale * Math.abs(sy(l))) / 2,
      };
    return { w: 0, h: 0 };
  }
  function hit(l, p) {
    if (!l.visible || l.type === "paint") return false;
    if (l.type === "arc") {
      const a = arcInfo(sctx, l),
        dx = p.x - l.x,
        dy = p.y - l.y,
        d = Math.hypot(dx, dy);
      if (Math.abs(d - a.r) > l.size * 0.8) return false;
      let df = Math.atan2(dy, dx) - a.a0;
      df = Math.atan2(Math.sin(df), Math.cos(df));
      return Math.abs(df) <= a.span / 2 + 0.15;
    }
    const r = (-l.rot * Math.PI) / 180,
      dx = p.x - l.x,
      dy = p.y - l.y,
      lx = dx * Math.cos(r) - dy * Math.sin(r),
      ly = dx * Math.sin(r) + dy * Math.cos(r),
      b = halfBox(l);
    return Math.abs(lx) <= b.w && Math.abs(ly) <= b.h;
  }
  const topHit = (p, pred) => {
    for (let i = state.layers.length - 1; i >= 0; i--) {
      const l = state.layers[i];
      if ((!pred || pred(l)) && hit(l, p)) return l;
    }
    return null;
  };
  function handlesOf(l) {
    if (!l || !l.visible || l.type === "arc" || l.type === "paint") return null;
    const b = halfBox(l),
      r = (l.rot * Math.PI) / 180,
      c = Math.cos(r),
      s = Math.sin(r),
      P = (x, y) => ({ x: l.x + x * c - y * s, y: l.y + x * s + y * c });
    return {
      corners: [P(-b.w, -b.h), P(b.w, -b.h), P(b.w, b.h), P(-b.w, b.h)],
      rot: P(0, -b.h - 44 / state.zoom),
      top: P(0, -b.h),
    };
  }
  function handleAt(l, p) {
    const h = handlesOf(l);
    if (!h) return null;
    if (Math.hypot(p.x - h.rot.x, p.y - h.rot.y) <= 20 / state.zoom)
      return "rot";
    return h.corners.some(
      (q) => Math.hypot(p.x - q.x, p.y - q.y) <= 18 / state.zoom,
    )
      ? "size"
      : null;
  }

  /* ---------- overlay ---------- */
  function drawOverlay() {
    octx.clearRect(0, 0, W, H);
    octx.save();
    octx.translate(W / 2, H / 2);
    octx.scale(state.zoom, state.zoom);
    octx.translate(-W / 2, -H / 2);
    const l = cur();
    if (l && l.visible && l.type !== "paint" && state.tool === "move") {
      octx.save();
      octx.strokeStyle = "#d6336c";
      octx.lineWidth = 2;
      octx.setLineDash([8, 6]);
      if (l.type === "arc") {
        const a = arcInfo(sctx, l);
        octx.beginPath();
        octx.arc(
          l.x,
          l.y,
          a.r + l.size * 0.7,
          a.a0 - a.span / 2 - 0.1,
          a.a0 + a.span / 2 + 0.1,
        );
        octx.stroke();
        octx.beginPath();
        octx.arc(
          l.x,
          l.y,
          Math.max(2, a.r - l.size * 0.7),
          a.a0 - a.span / 2 - 0.1,
          a.a0 + a.span / 2 + 0.1,
        );
        octx.stroke();
      } else {
        const b = halfBox(l);
        octx.translate(l.x, l.y);
        octx.rotate((l.rot * Math.PI) / 180);
        octx.strokeRect(-b.w, -b.h, b.w * 2, b.h * 2);
      }
      octx.restore();
      const h = handlesOf(l);
      if (h) {
        octx.save();
        octx.setLineDash([]);
        octx.lineWidth = 2;
        octx.strokeStyle = "#d6336c";
        octx.fillStyle = "#fff";
        octx.beginPath();
        octx.moveTo(h.top.x, h.top.y);
        octx.lineTo(h.rot.x, h.rot.y);
        octx.stroke();
        octx.beginPath();
        octx.arc(h.rot.x, h.rot.y, 9 / state.zoom, 0, TAU);
        octx.fill();
        octx.stroke();
        const hs = 8 / state.zoom;
        h.corners.forEach((q) => {
          octx.fillRect(q.x - hs, q.y - hs, hs * 2, hs * 2);
          octx.strokeRect(q.x - hs, q.y - hs, hs * 2, hs * 2);
        });
        octx.restore();
      }
    }
    if (state.mask && state.mask.path) {
      const m = state.mask,
        ml = state.layers.find((v) => v.id === m.layerId);
      if (ml && ml.visible) {
        const ppu =
          (ov.getBoundingClientRect().width / W) * state.zoom * ml.scale || 1;
        octx.save();
        octx.translate(ml.x, ml.y);
        octx.rotate((ml.rot * Math.PI) / 180);
        octx.scale(ml.scale * sx(ml), ml.scale * sy(ml));
        octx.translate(-m.w / 2, -m.h / 2);
        octx.lineJoin = "miter";
        octx.setLineDash([]);
        octx.lineWidth = 3 / ppu;
        octx.strokeStyle = "#fff";
        octx.stroke(m.path);
        octx.lineWidth = 1.6 / ppu;
        octx.strokeStyle = "#111";
        octx.setLineDash([5 / ppu, 5 / ppu]);
        octx.lineDashOffset = -((Date.now() / 70) % 10) / ppu;
        octx.stroke(m.path);
        octx.restore();
      }
    }
    const s = state.selection;
    if (s && s.length > 1) {
      octx.save();
      octx.beginPath();
      s.forEach((p, i) => (i ? octx.lineTo(p.x, p.y) : octx.moveTo(p.x, p.y)));
      if (!s.open) octx.closePath();
      octx.lineWidth = 2.5;
      octx.strokeStyle = "#fff";
      octx.setLineDash([]);
      octx.stroke();
      octx.strokeStyle = "#24202f";
      octx.setLineDash([7, 7]);
      octx.stroke();
      if (!s.open) {
        octx.fillStyle = "rgba(214,51,108,0.10)";
        octx.fill();
      }
      octx.restore();
    }
    if ((state.tool === "brush" || state.tool === "erase") && state.hover) {
      octx.beginPath();
      octx.arc(
        state.hover.x,
        state.hover.y,
        (state.tool === "brush" ? state.brush.size : state.eraser.size) / 2,
        0,
        TAU,
      );
      octx.lineWidth = 2.5;
      octx.strokeStyle = "#fff";
      octx.stroke();
      octx.lineWidth = 1;
      octx.strokeStyle = "#24202f";
      octx.stroke();
    }
    octx.restore();
  }

  /* ---------- adding layers ---------- */
  const base = () => ({
    id: uid++,
    visible: true,
    opacity: 1,
    x: FACE.cx,
    y: FACE.cy,
    rot: 0,
    clip: false,
  });
  function addLayer(l, tag) {
    if (state.layers.length >= 20) {
      toast("A design supports up to 20 layers.");
      return;
    }
    touch(tag || "add" + Math.random());
    state.layers.push(l);
    state.sel = l.id;
    refreshAll();
  }
  function newText() {
    return {
      ...base(),
      type: "text",
      name: "Text",
      text: "NAME",
      font: "Helvetica",
      size: 100,
      spacing: 2,
      bold: true,
      italic: false,
      caps: true,
      color: "#ee8456",
    };
  }
  function newArc(side) {
    return {
      ...base(),
      type: "arc",
      name: side === "top" ? "Curved top" : "Curved bottom",
      text: side === "top" ? "ROMEO" : "JULIET",
      side,
      angle: 0,
      radiusF: 0.72,
      font: "Helvetica",
      size: 68,
      spacing: 5,
      bold: true,
      italic: false,
      caps: true,
      color: "#ee8456",
    };
  }
  function newHeart() {
    return {
      ...base(),
      type: "heart",
      name: "Heart",
      size: 100,
      color: "#3d6ae6",
    };
  }
  function addImageFile(f) {
    if (f?.size > 20000000) {
      toast("Choose artwork up to 20MB.");
      return;
    }
    if (!f) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) {
      toast("Choose PNG, JPEG or WebP artwork.");
      return;
    }
    const url = URL.createObjectURL(f),
      im = new Image();
    im.onload = async () => {
      const m = Math.min(1, 6000 / Math.max(im.width, im.height)),
        c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(im.width * m));
      c.height = Math.max(1, Math.round(im.height * m));
      c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      if (m === 1) {
        try {
          await bridge.rememberImage(c, f);
        } catch {
          toast("The artwork could not be read. Try uploading it again.");
          return;
        }
      }
      const blank = state.jacket.show === false,
        fit = blank
          ? Math.min((W * 0.9) / c.width, (H * 0.9) / c.height)
          : (geom().rIn * 2 * 0.72) / Math.max(c.width, c.height);
      addLayer({
        ...base(),
        type: "image",
        name: f.name.replace(/\.[^.]+$/, "") || "Image",
        img: c,
        scale: fit,
        clip: !blank,
      });
    };
    im.onerror = () => {
      URL.revokeObjectURL(url);
      toast("That file could not be read as an image.");
    };
    im.src = url;
  }

  /* ---------- selection tools ---------- */
  function selectionLocal(l) {
    return state.selection.map((p) => toLocal(l, p));
  }
  function bboxOf(pts, l) {
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    pts.forEach((p) => {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    });
    x0 = Math.max(0, Math.floor(x0));
    y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(l.img.width, Math.ceil(x1));
    y1 = Math.min(l.img.height, Math.ceil(y1));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  function cropToSelection(l) {
    const pts = selectionLocal(l),
      b = bboxOf(pts, l);
    if (b.w < 2 || b.h < 2) return null;
    const c = document.createElement("canvas");
    c.width = b.w;
    c.height = b.h;
    const x = c.getContext("2d");
    x.translate(-b.x, -b.y);
    x.beginPath();
    pts.forEach((p, i) => (i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y)));
    x.closePath();
    x.clip();
    x.drawImage(l.img, 0, 0);
    const dx = (b.x + b.w / 2 - l.img.width / 2) * l.scale,
      dy = (b.y + b.h / 2 - l.img.height / 2) * l.scale,
      r = (l.rot * Math.PI) / 180;
    return {
      c,
      x: l.x + dx * Math.cos(r) - dy * Math.sin(r),
      y: l.y + dx * Math.sin(r) + dy * Math.cos(r),
    };
  }
  function selAction(kind) {
    if (kind === "clear") {
      state.selection = null;
      refreshSel();
      paint();
      return;
    }
    const l = cur();
    if (
      !state.selection ||
      state.selection.open ||
      state.selection.length < 3
    ) {
      toast("Draw a selection around part of an image first.");
      return;
    }
    if (!l || l.type !== "image") {
      toast("Click an image layer in the Layers list first.");
      return;
    }
    if (kind === "keep") {
      const r = cropToSelection(l);
      if (!r) {
        toast("Selection is outside the image.");
        return;
      }
      touch("sel" + Math.random());
      l.img = r.c;
      l.x = r.x;
      l.y = r.y;
    } else if (kind === "cut") {
      touch("sel" + Math.random());
      const c = document.createElement("canvas");
      c.width = l.img.width;
      c.height = l.img.height;
      const x = c.getContext("2d");
      x.drawImage(l.img, 0, 0);
      x.globalCompositeOperation = "destination-out";
      x.beginPath();
      selectionLocal(l).forEach((p, i) =>
        i ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y),
      );
      x.closePath();
      x.fill();
      l.img = c;
    } else if (kind === "recolor") {
      const d = polyMask(l);
      touch("sel" + Math.random());
      l.img = recolorMask(l.img, d);
    } else if (kind === "copy") {
      const r = cropToSelection(l);
      if (!r) {
        toast("Selection is outside the image.");
        return;
      }
      touch("sel" + Math.random());
      const n = {
        ...l,
        id: uid++,
        name: l.name + " (section)",
        img: r.c,
        x: r.x,
        y: r.y,
      };
      state.layers.splice(state.layers.indexOf(l) + 1, 0, n);
      state.sel = n.id;
    }
    state.selection = null;
    refreshAll();
  }
  function removeColor(l, rgb, tol) {
    const c = document.createElement("canvas");
    c.width = l.img.width;
    c.height = l.img.height;
    const x = c.getContext("2d");
    x.drawImage(l.img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height),
      a = d.data,
      soft = tol * 0.35 + 1;
    if (rgb.every((v) => v >= 225) || rgb.every((v) => v <= 30)) {
      /* white or black background: peel it off cleanly so edges keep their true ink colour (no grey halo) */
      const tau = Math.min(0.7, tol / 300);
      for (let i = 0; i < a.length; i += 4) {
        if (!a[i + 3]) continue;
        let al = 0;
        for (let ch = 0; ch < 3; ch++) {
          const pv = a[i + ch],
            b = rgb[ch];
          let v = 0;
          if (pv > b) v = b >= 255 ? 0 : (pv - b) / (255 - b);
          else if (pv < b) v = b <= 0 ? 0 : (b - pv) / b;
          if (v > al) al = v;
        }
        if (al <= tau) {
          a[i + 3] = 0;
          continue;
        }
        for (let ch = 0; ch < 3; ch++)
          a[i + ch] = rgb[ch] + (a[i + ch] - rgb[ch]) / al;
        a[i + 3] = Math.round(a[i + 3] * Math.min(1, al));
      }
      x.putImageData(d, 0, 0);
      touch("rm" + Math.random());
      l.img = c;
      refreshAll();
      return;
    }
    for (let i = 0; i < a.length; i += 4) {
      const dist = Math.hypot(
        a[i] - rgb[0],
        a[i + 1] - rgb[1],
        a[i + 2] - rgb[2],
      );
      if (dist <= tol) a[i + 3] = 0;
      else if (dist < tol + soft)
        a[i + 3] = Math.round((a[i + 3] * (dist - tol)) / soft);
    }
    x.putImageData(d, 0, 0);
    touch("rm" + Math.random());
    l.img = c;
    refreshAll();
  }

  /* ---------- pointer interaction ---------- */
  const pos = (e) => {
    const r = ov.getBoundingClientRect(),
      x = ((e.clientX - r.left) * W) / r.width,
      y = ((e.clientY - r.top) * H) / r.height;
    return {
      x: W / 2 + (x - W / 2) / state.zoom,
      y: H / 2 + (y - H / 2) / state.zoom,
    };
  };
  let drag = null;
  ov.addEventListener("pointerdown", (e) => {
    const p = pos(e);
    ov.setPointerCapture(e.pointerId);
    if (state.tool === "move") {
      const cl = cur(),
        hd = cl && handleAt(cl, p);
      if (hd && !cl.locked) {
        drag = {
          l: cl,
          mode: hd,
          d0: Math.hypot(p.x - cl.x, p.y - cl.y) || 1,
          v0: cl.type === "image" ? cl.scale : cl.size,
          moved: false,
        };
        return;
      }
      const l = topHit(p);
      if (l) {
        state.sel = l.id;
        drag = l.locked
          ? null
          : { l, dx: l.x - p.x, dy: l.y - p.y, moved: false };
        refreshAll();
      } else {
        state.sel = null;
        refreshAll();
      }
    } else if (state.tool === "wand") {
      const l = imageAt(p, true);
      if (!l) {
        toast("Click on a coloured part of an image to remove that colour.");
        return;
      }
      state.sel = l.id;
      const q = toLocal(l, p),
        px = Math.max(0, Math.min(l.img.width - 1, Math.floor(q.x))),
        py = Math.max(0, Math.min(l.img.height - 1, Math.floor(q.y)));
      const d = l.img.getContext("2d").getImageData(px, py, 1, 1).data;
      removeColor(l, [d[0], d[1], d[2]], state.tol);
    } else if (state.tool === "pick") {
      pickColour(p);
    } else if (state.tool === "recolor") {
      recolorClick(p);
    } else if (state.tool === "brush") {
      startPaint(p);
    } else if (state.tool === "erase") {
      startErase(p);
    } else if (state.tool === "magic") {
      magicClick(p, e);
    } else {
      drag = { sel: true, start: p, lasso: state.tool === "lasso", pts: [p] };
      state.selection = [p];
      state.selection.open = true;
      refreshSel();
    }
  });
  ov.addEventListener("pointermove", (e) => {
    if (!drag) {
      if (state.tool === "move") {
        const cl = cur(),
          hd = cl && handleAt(cl, pos(e));
        ov.style.cursor =
          hd === "rot" ? "grab" : hd ? "nwse-resize" : "default";
      } else if (state.tool === "brush" || state.tool === "erase") {
        state.hover = pos(e);
        drawOverlay();
      }
      return;
    }
    const p = pos(e);
    if (drag.paint) {
      continuePaint(p);
      return;
    }
    if (drag.erase) {
      continueErase(p);
      return;
    }
    if (drag.sel) {
      if (drag.lasso) {
        drag.pts.push(p);
        state.selection = drag.pts.slice();
      } else {
        const s = drag.start;
        state.selection = [s, { x: p.x, y: s.y }, p, { x: s.x, y: p.y }];
      }
      state.selection.open = drag.lasso;
      drawOverlay();
      return;
    }
    if (!drag.moved) {
      touch((drag.mode ? "xf" : "drag") + drag.l.id);
      drag.moved = true;
    }
    if (drag.mode === "rot") {
      let a = (Math.atan2(p.y - drag.l.y, p.x - drag.l.x) * 180) / Math.PI + 90;
      if (a > 180) a -= 360;
      if (e.shiftKey) a = Math.round(a / 15) * 15;
      drag.l.rot = Math.round(a);
    } else if (drag.mode === "size") {
      const v =
        (drag.v0 * Math.hypot(p.x - drag.l.x, p.y - drag.l.y)) / drag.d0;
      if (drag.l.type === "image")
        drag.l.scale = Math.max(0.005, Math.min(6, v));
      else drag.l.size = Math.max(8, Math.min(900, v));
    } else {
      drag.l.x = p.x + drag.dx;
      drag.l.y = p.y + drag.dy;
    }
    paint();
  });
  const endDrag = (e) => {
    if (!drag) return;
    if (drag.sel) {
      const s = state.selection;
      let ok = false;
      if (s && s.length > 2) {
        let x0 = 1e9,
          y0 = 1e9,
          x1 = -1e9,
          y1 = -1e9;
        s.forEach((q) => {
          x0 = Math.min(x0, q.x);
          x1 = Math.max(x1, q.x);
          y0 = Math.min(y0, q.y);
          y1 = Math.max(y1, q.y);
        });
        ok = x1 - x0 > 6 && y1 - y0 > 6;
      }
      if (ok) {
        state.selection.open = false;
        if (drag.lasso) state.selection = drag.pts.slice();
        state.selection.open = false;
        polyToMask(drag.start);
      } else {
        state.selection = null;
        const l = topHit(drag.start, (v) => v.type === "image");
        if (l) {
          state.sel = l.id;
          refreshAll();
        }
      }
      refreshSel();
      drawOverlay();
    }
    const was = drag;
    drag = null;
    if (was && was.mode && was.moved) buildProps();
  };
  ov.addEventListener("pointerleave", () => {
    state.hover = null;
    if (!drag) drawOverlay();
  });
  ov.addEventListener("pointerup", endDrag);
  ov.addEventListener("pointercancel", endDrag);

  function paintLayer() {
    let l = cur();
    if (l && l.type === "paint") return l;
    l = state.layers.find((v) => v.type === "paint");
    if (l) {
      state.sel = l.id;
      return l;
    }
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    l = {
      ...base(),
      type: "paint",
      name: "Paint touch-ups",
      img: c,
      jacketOnly: true,
    };
    state.layers.unshift(l);
    state.sel = l.id;
    return l;
  }
  function dab(l, a, b) {
    const x = l.img.getContext("2d"),
      br = state.brush;
    x.save();
    x.globalCompositeOperation = br.erase ? "destination-out" : "source-over";
    x.strokeStyle = x.fillStyle = br.color;
    x.lineWidth = br.size;
    x.lineCap = "round";
    x.lineJoin = "round";
    if (a.x === b.x && a.y === b.y) {
      x.beginPath();
      x.arc(a.x, a.y, br.size / 2, 0, TAU);
      x.fill();
    } else {
      x.beginPath();
      x.moveTo(a.x, a.y);
      x.lineTo(b.x, b.y);
      x.stroke();
    }
    x.restore();
    bridge.invalidate(l.img);
  }
  function startPaint(p) {
    touch("paint" + Math.random());
    const l = paintLayer();
    l.visible = true;
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    c.getContext("2d").drawImage(l.img, 0, 0);
    l.img = c;
    drag = { paint: true, l, last: p };
    dab(l, p, p);
    buildLayers();
    paint();
  }
  function continuePaint(p) {
    dab(drag.l, drag.last, p);
    drag.last = p;
    paint();
  }
  function clearPaint(l) {
    touch("clr" + Math.random());
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    l.img = c;
    paint();
  }
  const hexRGB = (h) => {
    h = toHex(h);
    return [
      parseInt(h.slice(1, 3), 16),
      parseInt(h.slice(3, 5), 16),
      parseInt(h.slice(5, 7), 16),
    ];
  };
  function editPixels(l, fn) {
    const c = document.createElement("canvas");
    c.width = l.img.width;
    c.height = l.img.height;
    const x = c.getContext("2d");
    x.drawImage(l.img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height);
    fn(d.data);
    x.putImageData(d, 0, 0);
    touch("rc" + Math.random());
    l.img = c;
    refreshAll();
  }
  /* Recolour that also fixes the blended edge pixels: an edge pixel is part ink, part background,
   so we work out how much ink it holds and swap only that share of it. This removes the faint outline. */
  function smartRecolor(base, reg, S, D, tol) {
    const w = base.width,
      h = base.height,
      n = w * h,
      c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    x.drawImage(base, 0, 0);
    const d = x.getImageData(0, 0, w, h),
      a = d.data,
      o = new Uint8ClampedArray(a),
      hard = new Uint8Array(n);
    for (let i = 0; i < n; i++) hard[i] = reg[i] >= 128 ? 1 : 0;
    const zone = hard.slice();
    for (let r = 0; r < 3; r++) {
      const pv = zone.slice();
      for (let i = 0; i < n; i++) {
        if (pv[i]) continue;
        const xx = i % w;
        if (
          (xx > 0 && pv[i - 1]) ||
          (xx < w - 1 && pv[i + 1]) ||
          (i >= w && pv[i - w]) ||
          (i < n - w && pv[i + w])
        )
          zone[i] = 1;
      }
    }
    const R = 3,
      soft = Math.max(60, tol),
      dr = D[0] - S[0],
      dg = D[1] - S[1],
      db = D[2] - S[2];
    for (let i = 0; i < n; i++) {
      if (!zone[i]) continue;
      const j = i * 4;
      if (o[j + 3] < 8) continue;
      const xx = i % w,
        yy = (i - xx) / w;
      let br = 0,
        bg = 0,
        bb = 0,
        bc = 0;
      for (let v = Math.max(0, yy - R); v <= Math.min(h - 1, yy + R); v++)
        for (let u = Math.max(0, xx - R); u <= Math.min(w - 1, xx + R); u++) {
          const k = v * w + u;
          if (hard[k]) continue;
          const q = k * 4;
          if (o[q + 3] < 200) continue;
          if (Math.hypot(o[q] - S[0], o[q + 1] - S[1], o[q + 2] - S[2]) < 60)
            continue;
          br += o[q];
          bg += o[q + 1];
          bb += o[q + 2];
          bc++;
        }
      let al;
      if (bc) {
        const B0 = br / bc,
          B1 = bg / bc,
          B2 = bb / bc,
          v0 = S[0] - B0,
          v1 = S[1] - B1,
          v2 = S[2] - B2,
          den = v0 * v0 + v1 * v1 + v2 * v2;
        if (den < 900) al = hard[i] ? 1 : 0;
        else {
          const p0 = o[j] - B0,
            p1 = o[j + 1] - B1,
            p2 = o[j + 2] - B2;
          al = Math.max(0, Math.min(1, (p0 * v0 + p1 * v1 + p2 * v2) / den));
          const e = Math.hypot(p0 - al * v0, p1 - al * v1, p2 - al * v2);
          if (!hard[i] && e > tol + 30) al = 0;
        }
      } else {
        const dd = Math.hypot(o[j] - S[0], o[j + 1] - S[1], o[j + 2] - S[2]);
        al = hard[i] ? 1 : Math.max(0, 1 - (dd - tol) / soft);
      }
      if (al > 0) {
        a[j] = o[j] + al * dr;
        a[j + 1] = o[j + 1] + al * dg;
        a[j + 2] = o[j + 2] + al * db;
      }
    }
    x.putImageData(d, 0, 0);
    return c;
  }
  function recolorSwap(l, src, tol) {
    const w = l.img.width,
      h = l.img.height,
      d = l.img.getContext("2d").getImageData(0, 0, w, h).data,
      reg = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < reg.length; i++, j += 4) {
      if (
        d[j + 3] >= 8 &&
        Math.hypot(d[j] - src[0], d[j + 1] - src[1], d[j + 2] - src[2]) <= tol
      )
        reg[i] = 255;
    }
    const c = smartRecolor(l.img, reg, src, hexRGB(state.recol), tol);
    touch("rc" + Math.random());
    l.img = c;
    refreshAll();
  }
  function tintAll(l) {
    const dst = hexRGB(state.recol);
    editPixels(l, (a) => {
      for (let i = 0; i < a.length; i += 4) {
        if (a[i + 3]) {
          a[i] = dst[0];
          a[i + 1] = dst[1];
          a[i + 2] = dst[2];
        }
      }
    });
  }
  function recolorClick(p) {
    const l = imageAt(p, true);
    if (!l) {
      toast("Click on a coloured part of an image to change that colour.");
      return;
    }
    state.sel = l.id;
    const q = toLocal(l, p),
      px = Math.max(0, Math.min(l.img.width - 1, Math.floor(q.x))),
      py = Math.max(0, Math.min(l.img.height - 1, Math.floor(q.y)));
    const d = l.img.getContext("2d").getImageData(px, py, 1, 1).data;
    if (d[3] < 20) {
      toast("That spot is see-through. Click a coloured part of the image.");
      return;
    }
    recolorSwap(l, [d[0], d[1], d[2]], state.tol);
  }
  function imageAt(p, strict) {
    const imgs = [];
    for (let i = state.layers.length - 1; i >= 0; i--) {
      const l = state.layers[i];
      if (
        l.type === "image" &&
        hit(l, p) &&
        (!l.clip ||
          state.jacket.show === false ||
          Math.hypot(p.x - FACE.cx, p.y - FACE.cy) <= geom().rIn)
      )
        imgs.push(l);
    }
    for (const l of imgs) {
      const q = toLocal(l, p),
        px = Math.floor(q.x),
        py = Math.floor(q.y);
      if (
        px >= 0 &&
        py >= 0 &&
        px < l.img.width &&
        py < l.img.height &&
        l.img.getContext("2d").getImageData(px, py, 1, 1).data[3] > 20
      )
        return l;
    }
    if (strict) return null;
    const c = cur();
    if (c && imgs.includes(c)) return c;
    return imgs[0] || null;
  }
  function buildContour(m) {
    const w = m.w,
      h = m.h,
      d = m.data,
      W1 = w + 1,
      inn = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[y * w + x] >= 128;
    const from = [],
      to = [],
      out = new Map();
    const add = (ax, ay, bx, by) => {
      const e = from.length,
        ka = ay * W1 + ax;
      from.push(ka);
      to.push(by * W1 + bx);
      const o = out.get(ka);
      if (o) o.push(e);
      else out.set(ka, [e]);
    };
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (d[y * w + x] < 128) continue;
        if (!inn(x, y - 1)) add(x, y, x + 1, y);
        if (!inn(x + 1, y)) add(x + 1, y, x + 1, y + 1);
        if (!inn(x, y + 1)) add(x + 1, y + 1, x, y + 1);
        if (!inn(x - 1, y)) add(x, y + 1, x, y);
      }
    const path = new Path2D();
    if (!from.length) {
      m.path = null;
      return;
    }
    if (from.length > 700000) {
      path.rect(0, 0, w, h);
      m.path = path;
      return;
    }
    const used = new Uint8Array(from.length);
    for (let e0 = 0; e0 < from.length; e0++) {
      if (used[e0]) continue;
      let e = e0,
        pdx = 0,
        pdy = 0,
        first = true;
      const a0 = from[e0];
      path.moveTo(a0 % W1, (a0 / W1) | 0);
      for (;;) {
        used[e] = 1;
        const a = from[e],
          b = to[e],
          dx = (b % W1) - (a % W1),
          dy = ((b / W1) | 0) - ((a / W1) | 0);
        if (!first && (dx !== pdx || dy !== pdy))
          path.lineTo(a % W1, (a / W1) | 0);
        first = false;
        pdx = dx;
        pdy = dy;
        const nx = out.get(b);
        let ne = -1;
        if (nx) {
          for (const c of nx) {
            if (!used[c]) {
              ne = c;
              break;
            }
          }
        }
        if (ne < 0) {
          path.lineTo(b % W1, (b / W1) | 0);
          break;
        }
        e = ne;
      }
      path.closePath();
    }
    m.path = path;
  }
  function setMask(l, data, o) {
    state.sel = l.id;
    state.mask = {
      id: uid++,
      layerId: l.id,
      w: l.img.width,
      h: l.img.height,
      data,
      base: o.base || l.img,
      parts: o.parts || null,
      live: !!o.live,
      path: null,
    };
    buildContour(state.mask);
    refreshMagic();
    buildLayers();
    drawOverlay();
  }
  function polyToMask(startPt) {
    let l = cur();
    if (!l || l.type !== "image") l = imageAt(startPt, false);
    if (!l) {
      state.selection = null;
      toast("Click an image layer first, then draw around the part you want.");
      return;
    }
    const data = polyMask(l);
    state.selection = null;
    setMask(l, data, {});
  }
  function morph(data, w, h, grow, n) {
    let cu = new Uint8Array(w * h);
    for (let i = 0; i < cu.length; i++) cu[i] = data[i] >= 128 ? 1 : 0;
    for (let it = 0; it < n; it++) {
      const nx = new Uint8Array(w * h),
        diag = it % 2 === 1;
      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          const i = row + x;
          let v = cu[i];
          if (grow) {
            if (!v) {
              if (
                (x > 0 && cu[i - 1]) ||
                (x < w - 1 && cu[i + 1]) ||
                (y > 0 && cu[i - w]) ||
                (y < h - 1 && cu[i + w])
              )
                v = 1;
              else if (
                diag &&
                ((x > 0 && y > 0 && cu[i - w - 1]) ||
                  (x < w - 1 && y > 0 && cu[i - w + 1]) ||
                  (x > 0 && y < h - 1 && cu[i + w - 1]) ||
                  (x < w - 1 && y < h - 1 && cu[i + w + 1]))
              )
                v = 1;
            }
          } else if (v) {
            if (
              x === 0 ||
              x === w - 1 ||
              y === 0 ||
              y === h - 1 ||
              !cu[i - 1] ||
              !cu[i + 1] ||
              !cu[i - w] ||
              !cu[i + w]
            )
              v = 0;
            else if (
              diag &&
              (!cu[i - w - 1] ||
                !cu[i - w + 1] ||
                !cu[i + w - 1] ||
                !cu[i + w + 1])
            )
              v = 0;
          }
          nx[i] = v;
        }
      }
      cu = nx;
    }
    for (let i = 0; i < cu.length; i++) cu[i] = cu[i] ? 255 : 0;
    return cu;
  }
  function maskEdited() {
    const m = state.mask;
    m.live = false;
    m.parts = null;
    buildContour(m);
    drawOverlay();
  }
  function growMask(dir) {
    const l = maskLayer();
    if (!l) return;
    const m = state.mask,
      n = Math.max(1, Math.min(60, parseInt($("#growAmt").value) || 1));
    m.data = morph(m.data, m.w, m.h, dir > 0, n);
    maskEdited();
    if (!m.path) toast("The selection has shrunk to nothing.");
  }
  function invertMask() {
    const l = maskLayer();
    if (!l) return;
    const m = state.mask;
    m.data = m.data.map((v) => 255 - v);
    maskEdited();
  }
  function fillMask() {
    const l = maskLayer();
    if (!l) return;
    const m = state.mask,
      w = m.w,
      h = m.h,
      col = hexRGB(state.recol);
    const f = document.createElement("canvas");
    f.width = w;
    f.height = h;
    const fx = f.getContext("2d"),
      fd = fx.createImageData(w, h);
    for (let i = 0, j = 0; i < m.data.length; i++, j += 4) {
      fd.data[j] = col[0];
      fd.data[j + 1] = col[1];
      fd.data[j + 2] = col[2];
      fd.data[j + 3] = m.data[i];
    }
    fx.putImageData(fd, 0, 0);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    x.drawImage(l.img, 0, 0);
    x.drawImage(f, 0, 0);
    touch("mfill" + Math.random());
    l.img = c;
    m.base = c;
    m.live = false;
    m.parts = null;
    paint();
  }
  function maskPart(l, m, keep) {
    const w = m.w,
      h = m.h,
      c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    x.drawImage(l.img, 0, 0);
    const d = x.getImageData(0, 0, w, h),
      a = d.data;
    for (let i = 0, j = 3; i < m.data.length; i++, j += 4) {
      const t = m.data[i] / 255;
      a[j] = Math.round(a[j] * (keep ? t : 1 - t));
    }
    x.putImageData(d, 0, 0);
    return c;
  }
  function copyMask() {
    if (state.layers.length >= 20) {
      toast("A design supports up to 20 layers.");
      return;
    }
    const l = maskLayer();
    if (!l) return;
    const m = state.mask;
    touch("mcopy" + Math.random());
    const n = {
      ...l,
      id: uid++,
      name: l.name + " (part)",
      img: maskPart(l, m, true),
    };
    state.layers.splice(state.layers.indexOf(l) + 1, 0, n);
    state.sel = n.id;
    state.mask = null;
    refreshMagic();
    refreshAll();
    toast("Copied onto its own layer. The original is unchanged.");
  }
  function keepMask() {
    const l = maskLayer();
    if (!l) return;
    const m = state.mask,
      w = m.w,
      h = m.h;
    let x0 = w,
      y0 = h,
      x1 = -1,
      y1 = -1;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (m.data[y * w + x] > 0) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    if (x1 < 0) {
      toast("Nothing is selected.");
      return;
    }
    const part = maskPart(l, m, true),
      bw = x1 - x0 + 1,
      bh = y1 - y0 + 1,
      c = document.createElement("canvas");
    c.width = bw;
    c.height = bh;
    c.getContext("2d").drawImage(part, -x0, -y0);
    const dx = (x0 + bw / 2 - w / 2) * l.scale,
      dy = (y0 + bh / 2 - h / 2) * l.scale,
      r = (l.rot * Math.PI) / 180;
    touch("mkeep" + Math.random());
    l.img = c;
    l.x += dx * Math.cos(r) - dy * Math.sin(r);
    l.y += dx * Math.sin(r) + dy * Math.cos(r);
    state.mask = null;
    refreshMagic();
    refreshAll();
  }
  function refreshMagic() {
    $("#maskActs").hidden = !state.mask;
  }
  function setRecol(c, fromInput) {
    state.recol = c;
    const h = toHex(c);
    $("#recolCol").value = h;
    $("#recolCol2").value = h;
    if (fromInput && state.target === "R") setCustomUI(c);
    if (
      state.mask &&
      state.mask.live &&
      (state.tool === "magic" || state.tool === "pick")
    )
      applyMaskRecolor();
  }
  function recolorMask(base, m) {
    const w = base.width,
      h = base.height,
      dst = hexRGB(state.recol),
      c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    x.drawImage(base, 0, 0);
    const d = x.getImageData(0, 0, w, h),
      a = d.data;
    for (let i = 0, j = 0; i < m.length; i++, j += 4) {
      const t = m[i] / 255;
      if (t > 0 && a[j + 3] > 0) {
        a[j] = a[j] * (1 - t) + dst[0] * t;
        a[j + 1] = a[j + 1] * (1 - t) + dst[1] * t;
        a[j + 2] = a[j + 2] * (1 - t) + dst[2] * t;
      }
    }
    x.putImageData(d, 0, 0);
    return c;
  }
  function polyMask(l) {
    const w = l.img.width,
      h = l.img.height,
      c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    x.fillStyle = "#000";
    x.beginPath();
    selectionLocal(l).forEach((q, i) =>
      i ? x.lineTo(q.x, q.y) : x.moveTo(q.x, q.y),
    );
    x.closePath();
    x.fill();
    const a = x.getImageData(0, 0, w, h).data,
      m = new Uint8Array(w * h);
    for (let i = 0; i < m.length; i++) m[i] = a[i * 4 + 3];
    return m;
  }
  function applyMaskRecolor() {
    const m = state.mask,
      l = state.layers.find((v) => v.id === m.layerId);
    if (!l) return;
    const D = hexRGB(state.recol);
    let c;
    if (m.parts && m.parts.length) {
      c = m.base;
      for (const pt of m.parts) c = smartRecolor(c, pt.data, pt.S, D, pt.tol);
    } else c = recolorMask(m.base, m.data);
    touch("mrc" + m.id);
    l.img = c;
    paint();
  }
  function maskLayer() {
    const m = state.mask,
      l = m && state.layers.find((v) => v.id === m.layerId);
    if (!l) {
      state.mask = null;
      refreshMagic();
      toast("Click a part of an image first.");
      return null;
    }
    return l;
  }
  function splitMask() {
    if (state.layers.length >= 20) {
      toast("A design supports up to 20 layers.");
      return;
    }
    const l = maskLayer();
    if (!l) return;
    const m = state.mask,
      w = m.w,
      h = m.h;
    const mk = (keep) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const x = c.getContext("2d");
      x.drawImage(l.img, 0, 0);
      const d = x.getImageData(0, 0, w, h),
        a = d.data;
      for (let i = 0, j = 3; i < m.data.length; i++, j += 4) {
        const t = m.data[i] / 255;
        a[j] = Math.round(a[j] * (keep ? t : 1 - t));
      }
      x.putImageData(d, 0, 0);
      return c;
    };
    const part = mk(true),
      rest = mk(false);
    touch("split" + Math.random());
    const n = { ...l, id: uid++, name: l.name + " (part)", img: part };
    l.img = rest;
    state.layers.splice(state.layers.indexOf(l) + 1, 0, n);
    state.sel = n.id;
    state.mask = null;
    refreshMagic();
    refreshAll();
    toast(
      "That part is now its own layer. Use the Move tool to move, resize or tint it.",
    );
  }
  function deleteMask() {
    const l = maskLayer();
    if (!l) return;
    const m = state.mask,
      w = m.w,
      h = m.h;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d");
    x.drawImage(l.img, 0, 0);
    const d = x.getImageData(0, 0, w, h),
      a = d.data;
    for (let i = 0, j = 3; i < m.data.length; i++, j += 4)
      a[j] = Math.round(a[j] * (1 - m.data[i] / 255));
    x.putImageData(d, 0, 0);
    touch("mdel" + Math.random());
    l.img = c;
    state.mask = null;
    refreshMagic();
    refreshAll();
  }
  function magicClick(p, e) {
    const l = imageAt(p, true);
    if (!l) {
      toast("Click on a coloured part of an image to select it.");
      return;
    }
    state.sel = l.id;
    const q = toLocal(l, p),
      w = l.img.width,
      h = l.img.height,
      px = Math.max(0, Math.min(w - 1, Math.floor(q.x))),
      py = Math.max(0, Math.min(h - 1, Math.floor(q.y)));
    const data = l.img.getContext("2d").getImageData(0, 0, w, h).data,
      i0 = (py * w + px) * 4;
    if (data[i0 + 3] < 20) {
      toast("That spot is see-through. Click a coloured part of the image.");
      return;
    }
    const sr = data[i0],
      sg = data[i0 + 1],
      sb = data[i0 + 2],
      tol = state.tol,
      soft = Math.max(8, tol),
      m = new Uint8Array(w * h);
    const dist = (i) => {
      const j = i * 4;
      return data[j + 3] < 20
        ? 1e9
        : Math.hypot(data[j] - sr, data[j + 1] - sg, data[j + 2] - sb);
    };
    if ($("#magicContig").checked) {
      const qu = new Int32Array(w * h);
      let qh = 0,
        qt = 0;
      const s0 = py * w + px;
      m[s0] = 255;
      qu[qt++] = s0;
      while (qh < qt) {
        const i = qu[qh++],
          xx = i % w;
        if (xx > 0 && !m[i - 1] && dist(i - 1) <= tol) {
          m[i - 1] = 255;
          qu[qt++] = i - 1;
        }
        if (xx < w - 1 && !m[i + 1] && dist(i + 1) <= tol) {
          m[i + 1] = 255;
          qu[qt++] = i + 1;
        }
        if (i >= w && !m[i - w] && dist(i - w) <= tol) {
          m[i - w] = 255;
          qu[qt++] = i - w;
        }
        if (i < w * h - w && !m[i + w] && dist(i + w) <= tol) {
          m[i + w] = 255;
          qu[qt++] = i + w;
        }
      }
    } else {
      for (let i = 0; i < w * h; i++) if (dist(i) <= tol) m[i] = 255;
    }
    for (let r = 0; r < 2; r++) {
      const prev = m.slice();
      for (let i = 0; i < w * h; i++) {
        if (prev[i]) continue;
        const xx = i % w;
        if (!(
          (xx > 0 && prev[i - 1]) ||
          (xx < w - 1 && prev[i + 1]) ||
          (i >= w && prev[i - w]) ||
          (i < w * h - w && prev[i + w])
        ))
          continue;
        const dd = dist(i);
        if (dd >= 1e8) continue;
        const t = 1 - (dd - tol) / soft;
        if (t > 0) m[i] = Math.round(255 * Math.min(1, t));
      }
    }
    const old = state.mask,
      same = old && old.layerId === l.id && old.w === w && old.h === h,
      part = { S: [sr, sg, sb], tol, data: m };
    if (e && e.shiftKey && same) {
      const u = old.data.slice();
      for (let i = 0; i < u.length; i++) if (m[i] > u[i]) u[i] = m[i];
      setMask(l, u, {
        parts: old.parts ? old.parts.concat([part]) : null,
        live: old.live,
        base: old.base,
      });
    } else if (e && e.altKey && same) {
      const u = old.data.slice();
      for (let i = 0; i < u.length; i++) if (m[i] >= 128) u[i] = 0;
      setMask(l, u, { parts: null, live: false, base: old.base });
    } else setMask(l, m, { parts: [part], live: true });
  }
  function startErase(p) {
    const l = imageAt(p, false);
    if (!l) {
      toast("Drag over an image to rub part of it out.");
      return;
    }
    state.sel = l.id;
    touch("erase" + Math.random());
    const c = document.createElement("canvas");
    c.width = l.img.width;
    c.height = l.img.height;
    c.getContext("2d").drawImage(l.img, 0, 0);
    l.img = c;
    const q = toLocal(l, p);
    drag = { erase: true, l, last: q };
    eraseDab(l, q, q);
    buildLayers();
    paint();
  }
  function eraseDab(l, a, b) {
    const x = l.img.getContext("2d");
    x.save();
    x.globalCompositeOperation = "destination-out";
    x.strokeStyle = x.fillStyle = "#000";
    x.lineWidth = Math.max(1, state.eraser.size / l.scale);
    x.lineCap = "round";
    x.lineJoin = "round";
    if (a.x === b.x && a.y === b.y) {
      x.beginPath();
      x.arc(a.x, a.y, x.lineWidth / 2, 0, TAU);
      x.fill();
    } else {
      x.beginPath();
      x.moveTo(a.x, a.y);
      x.lineTo(b.x, b.y);
      x.stroke();
    }
    x.restore();
  }
  function continueErase(p) {
    bridge.invalidate(drag.l.img);
    const q = toLocal(drag.l, p);
    eraseDab(drag.l, drag.last, q);
    drag.last = q;
    paint();
  }
  function pickColour(p) {
    let rgb = null;
    const l = imageAt(p, true);
    if (l) {
      const q = toLocal(l, p),
        px = Math.floor(q.x),
        py = Math.floor(q.y);
      if (px >= 0 && py >= 0 && px < l.img.width && py < l.img.height) {
        const d = l.img.getContext("2d").getImageData(px, py, 1, 1).data;
        if (d[3] > 20) rgb = d;
      }
    }
    if (!rgb) {
      const x = Math.max(
          0,
          Math.min(W - 1, Math.floor(W / 2 + (p.x - W / 2) * state.zoom)),
        ),
        y = Math.max(
          0,
          Math.min(H - 1, Math.floor(H / 2 + (p.y - H / 2) * state.zoom)),
        );
      rgb = mctx.getImageData(x, y, 1, 1).data;
    }
    const hex =
      "#" +
      [rgb[0], rgb[1], rgb[2]]
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
    setCustomUI(hex);
    applyColor(hex, true);
    setTool(
      state.prevTool && state.prevTool !== "pick" ? state.prevTool : "move",
    );
    toast(
      "Picked " +
        hex.toUpperCase() +
        ". Press Custom Colour to keep it in your palette.",
    );
  }
  /* ---------- UI: tools ---------- */
  const HINTS = {
    move: "Drag a layer to move it. Arrow keys nudge. Drop images anywhere on the page to add them.",
    rect: "Click an image layer, then drag a box around the part you want. The selection gets marching ants, and the buttons above let you recolour, fill, grow, shrink, invert or delete it.",
    lasso:
      "Click an image layer, then draw freehand around the part you want. The selection gets marching ants, and the buttons above let you recolour, fill, grow, shrink, invert or delete it.",
    wand: "Click a colour inside an image to make that colour see-through (for white backgrounds, etc).",
    brush:
      "Paint over the jacket to touch up colours or change a stripe. Pick a colour first. Hold Eraser to rub paint out.",
    recolor:
      "Click a colour inside an image to swap it for the Replace-with colour. Raise Tolerance to catch similar shades.",
    erase:
      "Drag over an image to rub part of it out (for example, text you do not want). Undo brings it back.",
    magic:
      "Click one coloured part of an image, like the gold H. Marching ants show the selection. Hold Shift and click another colour to add it, or hold Alt (Option) to take an area away. Click a swatch to recolour right away, or use Fill, Grow, Shrink, Inverse and the buttons above.",
    pick: "Click any colour on your design (an image, the jacket, text) to copy it into the Custom Colour box.",
  };
  function setTool(t) {
    if (t === "pick" && state.tool !== "pick") state.prevTool = state.tool;
    if (!(t === "pick" || state.tool === "pick")) state.mask = null;
    state.tool = t;
    state.selection = null;
    document
      .querySelectorAll("[data-tool]")
      .forEach((b) => b.classList.toggle("on", b.dataset.tool === t));
    ov.style.cursor = t === "move" ? "default" : "crosshair";
    $("#hint").textContent = HINTS[t];
    $("#tolWrap").hidden = !(t === "wand" || t === "recolor" || t === "magic");
    $("#brushOpts").hidden = t !== "brush";
    $("#recolOpts").hidden = t !== "recolor";
    $("#eraseOpts").hidden = t !== "erase";
    $("#magicOpts").hidden = t !== "magic";
    refreshMagic();
    state.hover = null;
    if (t === "brush") {
      state.target = "P";
      setCustomUI(colorOf("P"));
      buildTargets();
    }
    if (t === "recolor" || t === "magic") {
      state.target = "R";
      setCustomUI(colorOf("R"));
      buildTargets();
    }
    refreshSel();
    drawOverlay();
  }
  function refreshSel() {
    const el = $("#selActions");
    el.hidden = true;
    el.style.display = "none";
  }
  document
    .querySelectorAll("[data-tool]")
    .forEach((b) => b.addEventListener("click", () => setTool(b.dataset.tool)));
  document.querySelectorAll("[data-add]").forEach((b) =>
    b.addEventListener("click", () => {
      const k = b.dataset.add;
      if (k === "text") addLayer(newText());
      else if (k === "arctop") addLayer(newArc("top"));
      else if (k === "arcbottom") addLayer(newArc("bottom"));
      else if (k === "heart") addLayer(newHeart());
      else if (k === "circle" || k === "star")
        addLayer({ ...newHeart(), type: k, name: k });
      else $("#fileIn").click();
      if (k !== "image") setTool("move");
    }),
  );
  document
    .querySelectorAll("[data-sel]")
    .forEach((b) =>
      b.addEventListener("click", () => selAction(b.dataset.sel)),
    );
  $("#tol").addEventListener("input", (e) => {
    state.tol = +e.target.value;
    $("#tolVal").textContent = state.tol;
  });
  $("#fileIn").addEventListener("change", (e) => {
    [...e.target.files].forEach(addImageFile);
    e.target.value = "";
  });

  /* ---------- UI: jacket + colours ---------- */
  const J = state.jacket;
  function bindJ(id, key, conv, valId, fmt) {
    const el = $(id);
    el.addEventListener("input", () => {
      touch("j" + key);
      J[key] = conv(el);
      if (valId) $(valId).textContent = fmt(J[key]);
      syncJacketUI();
      paint();
    });
  }
  bindJ("#jStyle", "style", (e) => e.value);
  bindJ("#jSeg", "segments", (e) => +e.value);
  bindJ(
    "#jGap",
    "gap",
    (e) => +e.value,
    "#vGap",
    (v) => Math.round(v * 100) + "%",
  );
  bindJ("#jCols", "cols", (e) => +e.value);
  bindJ(
    "#jRing",
    "ring",
    (e) => +e.value,
    "#vRing",
    (v) => Math.round(v * 100) + "%",
  );
  bindJ(
    "#jShade",
    "shade",
    (e) => +e.value,
    "#vShade",
    (v) => Math.round(v * 100) + "%",
  );
  bindJ("#jShadow", "shadow", (e) => e.checked);
  $("#bgTransparent").addEventListener("input", (e) => {
    touch("transparent");
    state.transparent = e.target.checked;
    paint();
  });
  function syncJacketUI() {
    $("#jStyle").value = J.style;
    $("#jSeg").value = J.segments;
    $("#jGap").value = J.gap;
    $("#jCols").value = J.cols;
    $("#jRing").value = J.ring;
    $("#jShade").value = J.shade;
    $("#jShadow").checked = J.shadow;
    $("#vGap").textContent = Math.round(J.gap * 100) + "%";
    $("#vRing").textContent = Math.round(J.ring * 100) + "%";
    $("#vShade").textContent = Math.round(J.shade * 100) + "%";
    const multi = J.style === "segmented" || J.style === "pin";
    if (J.style === "segmented" && J.cols < 2) {
      J.cols = 2;
      $("#jCols").value = 2;
    }
    $("#rowSeg").hidden = !multi;
    $("#rowGap").hidden = J.style !== "pin";
    $("#rowCols").hidden = !multi;
    [...$("#jCols").options].forEach(
      (o) => (o.disabled = J.style === "segmented" && o.value === "1"),
    );
    syncEye();
    $("#colsHint").textContent =
      multi && J.segments % J.cols
        ? "Tip: " +
          J.segments +
          " segments don't repeat evenly with " +
          J.cols +
          " colours."
        : "";
    buildTargets();
  }
  const TARGETS = [
    ["A", "Jacket colour A"],
    ["B", "Jacket colour B"],
    ["C", "Jacket colour C"],
    ["D", "Jacket colour D"],
    ["S", "Pinstripe colour"],
    ["F", "Inside circle"],
    ["G", "Background"],
    ["L", "Selected layer"],
    ["P", "Paint brush"],
    ["R", "Image recolour"],
  ];
  const KEYS = {
    A: "colorA",
    B: "colorB",
    C: "colorC",
    D: "colorD",
    F: "face",
    S: "pin",
  };
  function colorOf(t) {
    if (t === "G") return state.bg;
    if (KEYS[t]) return J[KEYS[t]];
    if (t === "R") return state.recol;
    if (t === "P") return state.brush.color;
    const l = cur();
    return l && l.color ? l.color : "#cccccc";
  }
  function buildTargets() {
    const box = $("#targets");
    box.innerHTML = "";
    TARGETS.forEach(([k, lab]) => {
      const b = document.createElement("button");
      b.className =
        "target" +
        (state.target === k ? " on" : "") +
        ((((k === "C" && J.cols < 3) || (k === "D" && J.cols < 4)) &&
          (J.style === "segmented" || J.style === "pin")) ||
        (k === "S" && J.style !== "pin")
          ? " dim"
          : "");
      b.type = "button";
      const i = document.createElement("i");
      i.style.background = colorOf(k);
      b.append(i, document.createTextNode(lab));
      b.addEventListener("click", () => {
        state.target = k;
        setCustomUI(colorOf(k));
        buildTargets();
      });
      box.append(b);
    });
  }
  function toHex(c) {
    return /^#[0-9a-f]{6}$/i.test(c) ? c : "#cccccc";
  }
  function setCustomUI(c) {
    c = toHex(c);
    $("#picker").value = c;
    $("#hex").value = c.toUpperCase();
    $("#hex").classList.remove("bad");
  }
  function normHex(s) {
    s = String(s).trim().replace(/^#?/, "#");
    if (/^#[0-9a-f]{3}$/i.test(s))
      s = "#" + [...s.slice(1)].map((ch) => ch + ch).join("");
    return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : null;
  }
  function applyColor(c, fromHex) {
    const t = state.target;
    if (t === "L") {
      const l = cur();
      if (!l || !l.color) {
        toast("Select a text or heart layer first.");
        return;
      }
      touch("col" + l.id);
      l.color = c;
      buildProps();
    } else if (t === "R") {
      setRecol(c);
    } else if (t === "P") {
      state.brush.color = c;
    } else if (t === "G") {
      touch("colG");
      state.bg = c;
      if (state.transparent) {
        state.transparent = false;
        $("#bgTransparent").checked = false;
        toast("Transparent PNG turned off so the background colour shows.");
      }
    } else {
      touch("col" + t);
      J[KEYS[t]] = c;
      const need = t === "C" ? 3 : t === "D" ? 4 : 0;
      if (
        need &&
        J.cols < need &&
        (J.style === "segmented" || J.style === "pin")
      ) {
        J.cols = need;
        syncJacketUI();
        toast("Jacket now uses " + need + " colours.");
      }
      if (t === "S" && J.style !== "pin")
        toast("Set the jacket Style to Pinstripe to see the stripe colour.");
    }
    if (!fromHex) setCustomUI(c);
    buildTargets();
    paint();
  }
  function buildSwatches() {
    const box = $("#swatches");
    box.innerHTML = "";
    const add = (c, isCustom, idx) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sw" + (isCustom ? " custom" : "");
      b.style.background = c;
      b.title = c;
      b.setAttribute("aria-label", "Colour " + c);
      b.addEventListener("click", (ev) => {
        if (ev.target.classList.contains("x")) return;
        applyColor(c);
      });
      if (isCustom) {
        const x = document.createElement("span");
        x.className = "x";
        x.textContent = "×";
        x.title = "Remove from palette";
        x.addEventListener("click", (ev) => {
          ev.stopPropagation();
          custom.splice(idx, 1);
          saveCustom();
          buildSwatches();
        });
        b.append(x);
      }
      box.append(b);
    };
    PALETTE.forEach((c) => add(c, false));
    custom.forEach((c, i) => add(c, true, i));
  }
  function saveCustom() {
    try {
      localStorage.setItem("rc_palette", JSON.stringify(custom));
    } catch (e) {}
  }
  $("#picker").addEventListener("input", (e) => applyColor(e.target.value));
  $("#hex").addEventListener("input", (e) => {
    const h = normHex(e.target.value);
    e.target.classList.toggle("bad", !h);
    if (h) {
      $("#picker").value = h;
      applyColor(h, true);
    }
  });
  $("#hex").addEventListener("blur", (e) => {
    const h = normHex(e.target.value);
    if (h) setCustomUI(h);
  });
  $("#eyedrop").addEventListener("click", () => setTool("pick"));
  $("#addSwatch").addEventListener("click", () => {
    const c = normHex($("#hex").value) || $("#picker").value;
    if (!custom.includes(c) && !PALETTE.includes(c)) {
      custom.push(c);
      saveCustom();
      buildSwatches();
      toast("Added to your palette.");
    } else toast("That colour is already in your palette.");
  });

  /* ---------- UI: layers list ---------- */
  const ICON = {
    eyeoff:
      '<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/><path d="M3 3l18 18"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg>',
  };
  function buildLayers() {
    const ul = $("#layers");
    ul.innerHTML = "";
    if (!state.layers.length) {
      const li = document.createElement("li");
      li.className = "empty";
      li.textContent = "No layers yet. Add text, a heart or drop in images.";
      ul.append(li);
      buildTargets();
      return;
    }
    for (let i = state.layers.length - 1; i >= 0; i--) {
      const l = state.layers[i],
        li = document.createElement("li");
      li.className =
        "layer" + (l.id === state.sel ? " on" : "") + (l.visible ? "" : " hid");
      const eye = document.createElement("button");
      eye.className = "ico";
      eye.title = l.visible ? "Hide layer" : "Show layer";
      eye.innerHTML = ICON.eye;
      eye.addEventListener("click", () => {
        touch("vis" + Math.random());
        l.visible = !l.visible;
        buildLayers();
        paint();
      });
      const isTxt = l.type === "text" || l.type === "arc";
      let nm;
      if (isTxt && l.id === state.sel) {
        nm = document.createElement("textarea");
        nm.className = "nm-edit";
        nm.rows = 1;
        nm.maxLength = 240;
        nm.value = l.text;
        nm.dataset.k = "text";
        nm.spellcheck = false;
        nm.setAttribute("aria-label", "Layer text");
        const fit = () => {
          nm.style.height = "auto";
          nm.style.height = nm.scrollHeight + "px";
        };
        nm.addEventListener("input", fit);
        setTimeout(fit, 0);
      } else {
        nm = document.createElement("button");
        nm.className = "nm";
        nm.textContent = isTxt
          ? l.text.split("\n")[0] || "(empty text)"
          : l.name || l.type;
        nm.title = isTxt
          ? "Click to select"
          : "Click to select, double-click to rename";
        nm.addEventListener("click", () => {
          if (state.sel !== l.id) {
            state.sel = l.id;
            refreshAll();
          }
        });
        if (!isTxt) nm.addEventListener("dblclick", () => renameLayer(l, nm));
      }
      const acts = document.createElement("div");
      acts.className = "acts";
      const mk = (h, t, fn) => {
        const b = document.createElement("button");
        b.className = "ico";
        b.innerHTML = h;
        b.title = t;
        b.addEventListener("click", fn);
        acts.append(b);
      };
      mk(ICON.up, "Bring forward", () => {
        if (i < state.layers.length - 1) {
          touch("mv" + Math.random());
          [state.layers[i], state.layers[i + 1]] = [
            state.layers[i + 1],
            state.layers[i],
          ];
          refreshAll();
        }
      });
      mk(ICON.down, "Send backward", () => {
        if (i > 0) {
          touch("mv" + Math.random());
          [state.layers[i], state.layers[i - 1]] = [
            state.layers[i - 1],
            state.layers[i],
          ];
          refreshAll();
        }
      });
      mk(ICON.del, "Delete layer", () => deleteLayer(l.id));
      li.append(eye, nm, acts);
      if (l.id === state.sel) {
        const pr = document.createElement("div");
        pr.className = "props";
        pr.innerHTML = propsHTML(l);
        li.append(pr);
      }
      ul.append(li);
    }
    buildTargets();
  }
  function renameLayer(l, btn) {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.value = l.name;
    inp.className = "nm-edit";
    inp.setAttribute("aria-label", "Layer name");
    btn.replaceWith(inp);
    inp.focus();
    inp.select();
    let fin = false;
    const done = (ok) => {
      if (fin) return;
      fin = true;
      if (ok && inp.value.trim() && inp.value.trim() !== l.name) {
        touch("rn" + l.id);
        l.name = inp.value.trim();
      }
      buildLayers();
    };
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") done(true);
      if (e.key === "Escape") done(false);
    });
    inp.addEventListener("blur", () => done(true));
  }
  function deleteLayer(id) {
    const i = state.layers.findIndex((l) => l.id === id);
    if (i < 0) return;
    touch("del" + Math.random());
    state.layers.splice(i, 1);
    if (state.sel === id) state.sel = null;
    refreshAll();
  }
  $("#dupLayer").addEventListener("click", () => {
    if (state.layers.length >= 20) {
      toast("A design supports up to 20 layers.");
      return;
    }
    const l = cur();
    if (!l) {
      toast("Select a layer to duplicate.");
      return;
    }
    touch("dup" + Math.random());
    const n = {
      ...l,
      id: uid++,
      name: l.name + " copy",
      x: l.x + 30,
      y: l.y + 30,
    };
    state.layers.splice(state.layers.indexOf(l) + 1, 0, n);
    state.sel = n.id;
    refreshAll();
  });

  /* ---------- UI: properties ---------- */
  const esc = (s) =>
    String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  const rng = (l, k, lab, min, max, step, fmt) =>
    `<div class="field"><label>${lab} <span class="val">${fmt ? fmt(l[k]) : l[k]}</span></label><input aria-label="${lab}" type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${l[k]}"></div>`;
  const fontSel = (l) =>
    `<div class="field"><label>Font</label><select aria-label="Font" data-k="font">${FONTS.map((f) => `<option value="${f[0]}"${l.font === f[0] ? " selected" : ""}>${f[1] || f[0]}</option>`).join("")}</select></div>`;
  const chk = (l, k, lab) =>
    `<label><input type="checkbox" data-k="${k}"${l[k] ? " checked" : ""}> ${lab}</label>`;
  function propsHTML(l) {
    let h = "";
    if (l.type === "text")
      h +=
        fontSel(l) +
        rng(l, "size", "Size", 20, 320, 1) +
        rng(l, "spacing", "Letter spacing", -4, 40, 1) +
        `<div class="checks">${chk(l, "bold", "Bold")}${chk(l, "italic", "Italic")}${chk(l, "caps", "CAPITALS")}</div>` +
        rng(l, "rot", "Rotation", -180, 180, 1, (v) => v + "°");
    if (l.type === "arc")
      h +=
        `<div class="field"><label>Curve around the</label><select aria-label="Curve around the" data-k="side"><option value="top"${l.side === "top" ? " selected" : ""}>Top</option><option value="bottom"${l.side === "bottom" ? " selected" : ""}>Bottom</option></select></div>` +
        fontSel(l) +
        rng(l, "size", "Size", 20, 200, 1) +
        rng(l, "spacing", "Letter spacing", -4, 40, 1) +
        rng(
          l,
          "radiusF",
          "Distance from edge (smaller = closer to centre)",
          0.3,
          1,
          0.01,
          (v) => Math.round(v * 100) + "%",
        ) +
        rng(l, "angle", "Slide around the circle", -90, 90, 1, (v) => v + "°") +
        `<div class="checks">${chk(l, "bold", "Bold")}${chk(l, "italic", "Italic")}${chk(l, "caps", "CAPITALS")}</div>`;
    if (["heart", "circle", "star"].includes(l.type))
      h +=
        rng(l, "size", "Size", 20, 500, 1) +
        rng(l, "rot", "Rotation", -180, 180, 1, (v) => v + "°");
    if (l.type === "image")
      h +=
        rng(
          l,
          "scale",
          "Size",
          0.01,
          3,
          0.01,
          (v) => Math.round(v * 100) + "%",
        ) +
        rng(l, "rot", "Rotation", -180, 180, 1, (v) => v + "°") +
        `<div class="pair"><button class="btn small" type="button" data-act="white">Remove white</button><button class="btn small" type="button" data-act="fit">Fit to face</button></div><button class="btn small" type="button" data-act="tint" style="margin-top:8px;width:100%" title="Turn every visible pixel into the Image recolour colour">Tint whole image</button><div class="sub">Pick a colour with the Image recolour target, then use the Recolour tool to swap one colour, or tint the whole image. Remove white uses the tolerance from the Remove colour tool.</div>`;
    h += `<div class="checks">${chk(l, "locked", "Lock position")}</div>`;
    h += rng(
      l,
      "opacity",
      "Opacity",
      0.05,
      1,
      0.05,
      (v) => Math.round(v * 100) + "%",
    );
    h +=
      l.type === "paint"
        ? `<div class="checks">${chk(l, "jacketOnly", "Only show paint on the jacket")}</div><button class="btn small" type="button" data-act="clearpaint">Clear all paint</button>`
        : `<div class="checks">${chk(l, "clip", "Keep inside the white circle")}</div><button class="btn small" type="button" data-act="centre">Centre on face</button>`;
    return h;
  }
  function buildProps() {
    buildLayers();
  }
  $("#layers").addEventListener("input", (e) => {
    const t = e.target,
      k = t.dataset.k,
      l = cur();
    if (!k || !l) return;
    touch("p" + k + l.id);
    l[k] =
      t.type === "checkbox"
        ? t.checked
        : t.type === "range"
          ? +t.value
          : t.value;
    const v = t.type === "range" ? t.parentElement.querySelector(".val") : null;
    if (v) {
      const m = {
        opacity: (x) => Math.round(x * 100) + "%",
        scale: (x) => Math.round(x * 100) + "%",
        radiusF: (x) => Math.round(x * 100) + "%",
        rot: (x) => x + "°",
        angle: (x) => x + "°",
      };
      v.textContent = (m[k] || ((x) => x))(l[k]);
    }
    paint();
  });
  $("#layers").addEventListener("click", (e) => {
    const a = e.target.dataset.act,
      l = cur();
    if (!a || !l) return;
    if (a === "centre") {
      touch("c" + Math.random());
      l.x = FACE.cx;
      l.y = FACE.cy;
      paint();
    }
    if (a === "white") removeColor(l, [255, 255, 255], state.tol);
    if (a === "tint") tintAll(l);
    if (a === "clearpaint") clearPaint(l);
    if (a === "fit") {
      touch("f" + Math.random());
      l.scale = (geom().rIn * 2 * 0.72) / Math.max(l.img.width, l.img.height);
      l.x = FACE.cx;
      l.y = FACE.cy;
      buildProps();
      paint();
    }
  });

  /* ---------- misc UI ---------- */
  function refreshAll() {
    $("#zoom").value = Math.round(state.zoom * 100);
    $("#vZoom").textContent = Math.round(state.zoom * 100) + "%";
    buildLayers();
    syncJacketUI();
    syncUndo();
    refreshMagic();
    $("#bgTransparent").checked = state.transparent;
    refreshSel();
    paint();
  }
  let toastT;
  function toast(m) {
    const t = $("#toast");
    t.textContent = m;
    t.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("show"), 2600);
  }
  $("#zoom").addEventListener("input", (e) => {
    touch("zoom");
    state.zoom = +e.target.value / 100;
    $("#vZoom").textContent = e.target.value + "%";
    paint();
  });
  $("#boxsize").addEventListener("input", (e) => {
    document.documentElement.style.setProperty("--bs", e.target.value / 100);
    $("#vBox").textContent = e.target.value + "%";
  });
  $("#resetSize").addEventListener("click", () => {
    touch("zoomreset");
    state.zoom = 1;
    $("#boxsize").value = 50;
    document.documentElement.style.setProperty("--bs", 0.5);
    $("#vBox").textContent = "50%";
    refreshAll();
  });
  $("#brushSize").addEventListener("input", (e) => {
    state.brush.size = +e.target.value;
    $("#brushSizeVal").textContent = e.target.value;
    drawOverlay();
  });
  $("#brushErase").addEventListener("input", (e) => {
    state.brush.erase = e.target.checked;
  });
  $("#brushClear").addEventListener("click", () => {
    const l = state.layers.find((v) => v.type === "paint");
    if (!l) {
      toast("There is no paint to clear yet.");
      return;
    }
    clearPaint(l);
  });
  $("#recolCol").addEventListener("input", (e) =>
    setRecol(e.target.value, true),
  );
  $("#recolCol2").addEventListener("input", (e) =>
    setRecol(e.target.value, true),
  );
  $("#eraseSize").addEventListener("input", (e) => {
    state.eraser.size = +e.target.value;
    $("#eraseSizeVal").textContent = e.target.value;
    drawOverlay();
  });
  $("#magicRecolor").addEventListener("click", () => {
    if (!state.mask) {
      toast("Click a part of an image first.");
      return;
    }
    applyMaskRecolor();
  });
  $("#magicSplit").addEventListener("click", splitMask);
  $("#magicDelete").addEventListener("click", deleteMask);
  $("#magicClear").addEventListener("click", () => {
    state.mask = null;
    refreshMagic();
    drawOverlay();
  });
  $("#maskFill").addEventListener("click", fillMask);
  $("#maskGrow").addEventListener("click", () => growMask(1));
  $("#maskShrink").addEventListener("click", () => growMask(-1));
  $("#maskInvert").addEventListener("click", invertMask);
  $("#maskKeep").addEventListener("click", keepMask);
  $("#maskCopy").addEventListener("click", copyMask);
  $("#tintAll").addEventListener("click", () => {
    const l = cur();
    if (!l || l.type !== "image") {
      toast("Click an image layer in the Layers list first.");
      return;
    }
    tintAll(l);
  });
  $("#undo").addEventListener("click", undo);
  $("#redo").addEventListener("click", redoF);
  $("#caption").addEventListener("input", (e) => {
    $("#presentCap").textContent = e.target.value;
    paint();
  });
  $("#present").addEventListener("click", () => {
    const on = document.body.classList.toggle("present");
    $("#present").textContent = on ? "Back to editing" : "Present";
    if (on) {
      state.selection = null;
    }
    paint();
  });
  function updateExpInfo() {
    bridge.exportInfo(
      state,
      $("#expRes").value,
      $("#expCrop").checked,
      $("#expInfo"),
    );
  }
  ["expFmt", "expRes", "expCrop"].forEach((id) =>
    $("#" + id).addEventListener("input", updateExpInfo),
  );
  $("#export").addEventListener("click", () =>
    bridge.export(
      state,
      $("#expFmt").value,
      $("#expRes").value,
      $("#expCrop").checked,
    ),
  );
  $("#expFmt").addEventListener("input", () => {
    $("#export").textContent =
      $("#expFmt").value === "jpeg" ? "Download JPEG" : "Download PNG";
  });
  function syncEye() {
    updateExpInfo();
    const b = $("#jEye");
    if (!b) return;
    const off = state.jacket.show === false;
    b.classList.toggle("off", off);
    b.innerHTML = off ? ICON.eyeoff : ICON.eye;
    b.title = off
      ? "Show the candy"
      : "Hide the candy so you can work on a blank page";
  }
  $("#jEye").addEventListener("click", (e) => {
    e.stopPropagation();
    touch("jvis" + Math.random());
    state.jacket.show = state.jacket.show === false;
    syncEye();
    paint();
  });
  $("#saveProj").addEventListener("click", () => bridge.saveProject());
  $("#openProj").addEventListener("click", () => $("#projIn").click());
  $("#projIn").addEventListener("change", (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (file) bridge.openProject(file);
  });
  $("#saveLibrary").addEventListener("click", () => bridge.save(false));
  $("#saveCopy").addEventListener("click", () => bridge.save(true));
  $("#useOrder").addEventListener("click", () => bridge.apply());
  $("#closeStudio").addEventListener("click", () => bridge.close());
  $("#productionNotes").addEventListener("input", (e) => {
    touch("notes");
    state.productionNotes = e.target.value;
    paint();
  });
  $("#proofPdf").addEventListener("click", () => bridge.proof("proof"));
  $("#exportSvg").addEventListener("click", () => bridge.proof("svg"));
  $("#exportPdf").addEventListener("click", () => bridge.proof("pdf"));
  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase(),
      typing = tag === "input" || tag === "textarea" || tag === "select";
    if (!typing && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redoF();
      else undo();
      return;
    }
    if (e.key === "Escape" && document.body.classList.contains("present")) {
      $("#present").click();
      return;
    }
    if (typing) return;
    const l = cur();
    if (!l || l.locked) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      deleteLayer(l.id);
    }
    const d = e.shiftKey ? 10 : 2;
    let dx = 0,
      dy = 0;
    if (e.key === "ArrowLeft") dx = -d;
    if (e.key === "ArrowRight") dx = d;
    if (e.key === "ArrowUp") dy = -d;
    if (e.key === "ArrowDown") dy = d;
    if (dx || dy) {
      e.preventDefault();
      touch("nudge" + l.id);
      l.x += dx;
      l.y += dy;
      paint();
    }
  });
  let dragDepth = 0;
  addEventListener("dragenter", (e) => {
    if ([...e.dataTransfer.types].includes("Files")) {
      dragDepth++;
      $("#drop").classList.add("show");
    }
  });
  addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) $("#drop").classList.remove("show");
  });
  addEventListener("dragover", (e) => e.preventDefault());
  addEventListener("drop", (e) => {
    e.preventDefault();
    dragDepth = 0;
    $("#drop").classList.remove("show");
    [...e.dataTransfer.files].forEach(addImageFile);
  });
  addEventListener("paste", (e) => {
    const fs = [...(e.clipboardData ? e.clipboardData.files : [])].filter((f) =>
      f.type.startsWith("image/"),
    );
    if (fs.length) {
      fs.forEach(addImageFile);
    }
  });

  /* ---------- collapsible side sections ---------- */
  (() => {
    let saved = {};
    try {
      saved = JSON.parse(localStorage.getItem("rc_collapsed") || "{}");
    } catch (e) {}
    document.querySelectorAll(".side section").forEach((sec) => {
      const h = sec.querySelector(":scope>h2");
      if (!h) return;
      const key = h.firstChild.textContent.trim();
      const set = (c) => {
        sec.classList.toggle("collapsed", c);
        h.setAttribute("aria-expanded", String(!c));
        saved[key] = c;
        try {
          localStorage.setItem("rc_collapsed", JSON.stringify(saved));
        } catch (e) {}
      };
      h.tabIndex = 0;
      h.setAttribute("role", "button");
      sec.classList.toggle("collapsed", !!saved[key]);
      h.setAttribute("aria-expanded", String(!saved[key]));
      h.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        set(!sec.classList.contains("collapsed"));
      });
      h.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === h) {
          e.preventDefault();
          set(!sec.classList.contains("collapsed"));
        }
      });
    });
  })();
  async function load(design) {
    const loaded = await bridge.load(design);
    await Promise.all(
      FONTS.map((f) =>
        document.fonts
          .load("400 40px " + stack(f[0]).split(",")[0])
          .catch(() => 0),
      ),
    );
    Object.assign(state.jacket, loaded.jacket);
    state.bg = loaded.bg;
    state.transparent = loaded.transparent;
    state.zoom = loaded.zoom;
    state.layers = loaded.layers;
    state.sel = loaded.layers[0]?.id || null;
    uid = loaded.nextId;
    state.productionNotes = design.productionNotes;
    $("#productionNotes").value = design.productionNotes;
    $("#caption").value = design.name;
    $("#presentCap").textContent = design.name;
    hist = [];
    redo = [];
    lastTag = "";
    buildSwatches();
    setTool("move");
    refreshAll();
  }
  const interval = window.setInterval(() => {
    if (state.mask && state.mask.path && !drag) drawOverlay();
  }, 100);
  return {
    load,
    state,
    paint,
    toast,
    element: $("#canonical"),
    destroy() {
      window.clearInterval(interval);
      timers.forEach(clearTimeout);
    },
  };
}
