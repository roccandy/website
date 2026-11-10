/** Supplied admin UI markup/styles, isolated from the admin shell. No executable HTML scripts. */
export const studioExperienceTemplate = String.raw`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
/* Layout: slim tool rail | big canvas stage | settings column (jacket, colours, layers, selected layer) */
:root{
  --bg:#f1f0f6; --panel:#ffffff; --ink:#24202f; --muted:#6d6880; --line:#e1deec;
  --accent:#d6336c; --accent-ink:#ffffff; --plum:#4b1f8c; --stage:#e7e4f0; --soft:#f6f4fb;
  --font-ui:"DM Sans","Helvetica Neue",Arial,sans-serif;
  --font-display:"Bricolage Grotesque","DM Sans",Arial,sans-serif;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --bg:#17141f; --panel:#221e2d; --ink:#efecf7; --muted:#a39db6; --line:#383247; --accent:#f06595; --accent-ink:#1b0f16; --plum:#b79cf0; --stage:#2b2638; --soft:#2a2537; color-scheme:dark;}}
:root[data-theme="dark"]{
  --bg:#17141f; --panel:#221e2d; --ink:#efecf7; --muted:#a39db6; --line:#383247; --accent:#f06595; --accent-ink:#1b0f16; --plum:#b79cf0; --stage:#2b2638; --soft:#2a2537; color-scheme:dark;}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.4 var(--font-ui);}
button,select,input,textarea{font:inherit;color:inherit}
button{cursor:pointer}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}

.app{height:100%;display:grid;grid-template-columns:76px minmax(0,1fr) 340px;grid-template-rows:auto 1fr;}
header.top{grid-column:1/-1;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:10px 16px;background:var(--panel);border-bottom:1px solid var(--line)}
.brand{font:700 20px var(--font-display);letter-spacing:-.01em;margin-right:auto;display:flex;align-items:baseline;gap:10px}
.brand small{font:500 12px var(--font-ui);color:var(--muted);letter-spacing:.02em}
.btn{border:1px solid var(--line);background:var(--panel);border-radius:8px;padding:7px 12px;font-weight:500}
.btn:hover{background:var(--soft)}
.btn.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent);font-weight:700}
.btn.primary:hover{filter:brightness(1.07)}
.btn.small{padding:4px 9px;font-size:12px}
.btn:disabled{opacity:.4;cursor:default}
.caption-in{border:1px solid var(--line);background:var(--soft);border-radius:8px;padding:7px 10px;width:210px}

.rail{background:var(--panel);border-right:1px solid var(--line);padding:10px 8px;display:flex;flex-direction:column;gap:4px;overflow:auto}
.rail hr{border:0;border-top:1px solid var(--line);margin:6px 4px;width:calc(100% - 8px)}
.tool{display:flex;flex-direction:column;align-items:center;gap:3px;padding:8px 2px;border:1px solid transparent;border-radius:10px;background:none;font-size:11px;color:var(--muted);font-weight:500}
.tool svg{width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.tool:hover{background:var(--soft);color:var(--ink)}
.tool.on{background:var(--ink);color:var(--bg)}
.rail .label{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);text-align:center;margin:4px 0 2px}

.stage-wrap{display:flex;flex-direction:column;min-width:0;min-height:0}
.optbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 16px;min-height:46px;color:var(--muted);font-size:13px}
.optbar .hint{margin-right:auto}
.optbar label{display:flex;align-items:center;gap:8px;color:var(--ink)}
.stage{flex:1;min-height:0;background:var(--stage);margin:0 16px 16px;border-radius:14px;display:grid;place-items:center;padding:14px;overflow:auto;border:1px solid var(--line)}
[hidden]{display:none!important}
.stage>div{width:100%;display:flex;flex-direction:column;align-items:center}
.canvas-box{position:relative;width:calc(100%*var(--bs,.5));max-width:calc(var(--bs,.5)*(100vh - 200px)*4/3);aspect-ratio:4/3;box-shadow:0 10px 40px rgba(40,20,80,.16);border-radius:6px;overflow:hidden;background:#fff}
.canvas-box canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#ov{touch-action:none}
.present-cap{display:none;text-align:center;font:600 22px var(--font-display);margin-top:12px}

.side{background:var(--panel);border-left:1px solid var(--line);overflow:auto;padding:12px 14px 40px;display:flex;flex-direction:column;gap:18px}
.side h2{font:700 12px var(--font-ui);letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 8px;display:flex;align-items:center;justify-content:flex-start;gap:8px;cursor:pointer;user-select:none}
.side h2 .btn{margin-left:auto;cursor:pointer}
.side h2 .eyeh{margin-left:auto;border:0;background:none;padding:2px;border-radius:6px;color:inherit;cursor:pointer;display:grid;place-items:center}.side h2 .eyeh svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.side h2 .eyeh:hover{background:var(--soft)}.side h2 .eyeh.off{opacity:.55}
.side h2::before{content:'';width:7px;height:7px;border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg) translate(-2px,-2px);transition:transform .15s;flex:none}
.side section.collapsed>h2{margin-bottom:0}
.side section.collapsed>h2::before{transform:rotate(-45deg)}
.side section.collapsed>*:not(h2){display:none}
.field{display:flex;flex-direction:column;gap:4px;margin-bottom:10px}
.field>label,.field>.lab{font-size:12px;color:var(--muted);display:flex;justify-content:space-between}
.field .val{color:var(--ink);font-variant-numeric:tabular-nums}
.field select,.field input[type=text],.field textarea,.field input[type=number]{width:100%;border:1px solid var(--line);background:var(--soft);border-radius:8px;padding:7px 9px}
.field textarea{resize:vertical;min-height:54px}
.field input[type=range]{width:100%;accent-color:var(--accent)}
.checks{display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px}
.checks label{display:flex;gap:6px;align-items:center}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:10px}

.targets{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}
.target{display:flex;align-items:center;gap:8px;border:1.5px solid var(--line);background:var(--panel);border-radius:9px;padding:6px 8px;font-size:12px;text-align:left}
.target i{width:20px;height:20px;border-radius:50%;border:1px solid rgba(0,0,0,.25);flex:none}
.target.on{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 25%,transparent)}
.swatches{display:grid;grid-template-columns:repeat(8,1fr);gap:6px}
.sw{position:relative;aspect-ratio:1;border-radius:50%;border:1px solid rgba(0,0,0,.22);padding:0}
.sw:hover{transform:scale(1.12)}
.sw .x{position:absolute;top:-5px;right:-5px;width:14px;height:14px;border-radius:50%;background:var(--ink);color:var(--bg);font-size:10px;line-height:14px;text-align:center;display:none}
.sw.custom:hover .x{display:block}
.adder{display:flex;gap:8px;align-items:center;margin-top:10px}
.adder input[type=color]{width:42px;height:32px;padding:0;border:1px solid var(--line);border-radius:8px;background:none}
.sub{font-size:11px;color:var(--muted);margin:10px 0 6px}

.layers{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.layer{display:grid;grid-template-columns:28px 1fr auto;align-items:center;gap:6px;border:1.5px solid var(--line);border-radius:9px;padding:4px 6px;background:var(--panel)}
.layer.on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 8%,var(--panel))}
.layer .nm{border:0;background:none;text-align:left;padding:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.layer .ico{border:0;background:none;padding:2px;opacity:.85;border-radius:6px}
.layer .ico:hover{background:var(--soft);opacity:1}
.layer.hid .nm{opacity:.45;text-decoration:line-through}
.layer .acts{display:flex}
.layer svg{width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.empty{color:var(--muted);font-size:13px;padding:6px 0}
.toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:9px 16px;border-radius:10px;font-weight:500;opacity:0;pointer-events:none;transition:opacity .2s;z-index:50;max-width:90vw}
.toast.show{opacity:1}
.drop{position:fixed;inset:0;background:color-mix(in srgb,var(--accent) 16%,transparent);border:4px dashed var(--accent);display:none;place-items:center;font:700 26px var(--font-display);z-index:40;pointer-events:none}
.drop.show{display:grid}

body.present{--bs:.9}
body.present .rail,body.present .side,body.present .optbar,body.present header.top .hide-present{display:none}
body.present .app{grid-template-columns:minmax(0,1fr)}
body.present .present-cap{display:block}
body.present #ov{display:none}
body.present .stage{margin:16px;background:var(--bg);border-color:transparent;align-content:center}

@media (max-width:980px){
  html,body{height:auto}
  .app{height:auto;grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto auto auto}
  .rail{flex-direction:row;flex-wrap:wrap;border-right:0;border-bottom:1px solid var(--line);order:1}
  .rail hr,.rail .label{display:none}
  .tool{flex:1 0 64px}
  .stage-wrap{order:2}
  .side{order:3;border-left:0;border-top:1px solid var(--line);overflow:visible}
  .stage{margin:0 12px 12px}
  .canvas-box{width:100%;max-width:100%}
}
.hexrow{display:flex;gap:8px;align-items:center}
.hexrow input[type=text]{flex:1;min-width:0;border:1px solid var(--line);background:var(--soft);border-radius:8px;padding:7px 9px;font-family:ui-monospace,Menlo,Consolas,monospace;text-transform:uppercase}
.hexrow input.bad{border-color:#e03131}
.hexrow input[type=color]{width:40px;height:34px;padding:0;border:1px solid var(--line);border-radius:8px;background:none;flex:none}
.target.dim{opacity:.5}
.note{font-size:11px;color:var(--muted);margin:2px 0 0}
@media (min-width:981px){
  html,body{overflow:hidden}
  .app{width:125%;height:125%;transform:scale(.8);transform-origin:0 0}
  .canvas-box{max-width:calc(var(--bs,.5)*(125vh - 190px)*4/3)}
}
.optgroup{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.optgroup input[type=color]{width:36px;height:28px;padding:0;border:1px solid var(--line);border-radius:6px;background:none}
.layer .props{grid-column:1/-1;margin-top:6px;padding:10px 2px 2px;border-top:1px solid var(--line)}
.layer .nm-edit{width:100%;min-width:0;resize:none;border:1px solid var(--line);background:var(--soft);border-radius:6px;padding:5px 7px;font:inherit;overflow:hidden;min-height:30px}
.props .field:last-child{margin-bottom:0}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}

#canonical{position:absolute;inset:0;pointer-events:none} #canonical [role=alert]{position:absolute;bottom:0;left:0;right:0;margin:0;padding:8px;background:#fff1f2;color:#9f1239;font-size:12px} body.present .status{display:none} #main{visibility:hidden} .integration{display:flex;gap:6px;flex-wrap:wrap} .status{grid-column:1/-1;padding:8px 16px;background:var(--soft)} .status:empty{display:none} .app[aria-busy=true]{pointer-events:none;opacity:.65} .app{min-height:100vh} .canvas-box{aspect-ratio:1772/1300} body.present .integration{display:none} @media(min-width:981px){.app{height:125vh;width:125%;grid-template-rows:auto auto minmax(0,1fr)}header.top{grid-row:1}.status{grid-row:2}.rail,.stage-wrap,.side{grid-row:3}.canvas-box{max-width:calc(var(--bs,.5)*(125vh - 190px)*1772/1300)}}</style><link rel="stylesheet" href="/design-fonts/studio.css"></head><body>
<div class="app">
  <header class="top">
    <div class="brand">Roc Candy Mockup Studio <small class="hide-present">drop in a logo, pick colours, show the client</small></div>
    <input id="caption" class="caption-in" type="text" placeholder="Client / order name" aria-label="Client or order name shown in presentation mode">
    <button class="btn hide-present" id="undo" title="Undo (Ctrl/Cmd+Z)">Undo</button>
    <button class="btn hide-present" id="redo" title="Redo (Shift+Ctrl/Cmd+Z)">Redo</button>
    <button class="btn hide-present" id="saveProj" title="Save the whole design so you can reopen it later">Save design</button>
    <button class="btn hide-present" id="openProj">Open design</button>
    <button class="btn" id="present" title="Hide all tools and show only the candy">Present</button>
    <button class="btn primary hide-present" id="export">Download PNG</button>
  <div class="integration hide-present"><button class="btn" id="saveLibrary">Save to library</button><button class="btn" id="saveCopy">Save copy</button><button class="btn primary" id="useOrder">Save &amp; use in order</button><button class="btn" id="closeStudio">Close</button></div></header><div id="integrationStatus" class="status" role="status"></div>

  <nav class="rail" aria-label="Tools">
    <div class="label">Tools</div>
    <button class="tool on" data-tool="move" title="Move: click a layer and drag it around the candy"><svg viewBox="0 0 24 24"><path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>Move</button>
    <button class="tool" data-tool="rect" title="Rectangle select: box around part of an image to isolate it"><svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" stroke-dasharray="3 3"/></svg>Box select</button>
    <button class="tool" data-tool="lasso" title="Lasso select: draw freehand around part of an image to isolate it"><svg viewBox="0 0 24 24"><path d="M12 5c-5 0-8 2-8 5s3 5 8 5 8-2 8-5-3-5-8-5z" stroke-dasharray="3 3"/><path d="M9 15c-1 2 0 4 3 5"/></svg>Lasso</button>
    <button class="tool" data-tool="wand" title="Remove colour: click a colour in an image to make it see-through"><svg viewBox="0 0 24 24"><path d="M12 3c3 4 6 7 6 10a6 6 0 0 1-12 0c0-3 3-6 6-10z"/></svg>Remove colour</button>
    <button class="tool" data-tool="pick" title="Eyedropper: click any colour on your design to copy it into Custom Colour"><svg viewBox="0 0 24 24"><path d="M14 6l4 4M4 20l1-4 9.5-9.5 3 3L8 19l-4 1z"/><path d="M15.5 4.5a2.1 2.1 0 0 1 3 0l1 1a2.1 2.1 0 0 1 0 3l-1.5 1.5-4-4z"/></svg>Eyedropper</button>
    <button class="tool" data-tool="brush" title="Paint brush: touch up or recolour parts of the jacket, pinstripes included"><svg viewBox="0 0 24 24"><path d="M18 3l3 3-9 9-3-3z"/><path d="M9 12c-3 0-4 2-4 4 0 2-1 3-2 4 3 1 8 0 8-4"/></svg>Paint brush</button>
    <button class="tool" data-tool="recolor" title="Recolour: click a colour in a dropped-in image and swap it for another"><svg viewBox="0 0 24 24"><path d="M4 8h12l-3-3M20 16H8l3 3"/></svg>Recolour image</button>
    <button class="tool" data-tool="erase" title="Eraser: rub out part of an image, like text you do not want"><svg viewBox="0 0 24 24"><path d="M8 20h12M5 15l9-9a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3l-8 8H8z"/><path d="M9 11l5 5"/></svg>Eraser</button>
    <button class="tool" data-tool="magic" title="Magic select: click one coloured part of a logo (like the gold H) to select just that part"><svg viewBox="0 0 24 24"><path d="M5 19L15 9M13 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM18 12l.7 1.3L20 14l-1.3.7L18 16l-.7-1.3L16 14l1.3-.7z"/></svg>Magic select</button>
    <hr>
    <div class="label">Add</div>
    <button class="tool" data-add="text" title="Add straight text"><svg viewBox="0 0 24 24"><path d="M5 6h14M12 6v13M9 19h6"/></svg>Text</button>
    <button class="tool" data-add="arctop" title="Add text that curves around the top"><svg viewBox="0 0 24 24"><path d="M4 16a8 8 0 0 1 16 0"/><path d="M9 11l3-3 3 3"/></svg>Curve top</button>
    <button class="tool" data-add="arcbottom" title="Add text that curves around the bottom"><svg viewBox="0 0 24 24"><path d="M4 8a8 8 0 0 0 16 0"/><path d="M9 13l3 3 3-3"/></svg>Curve bottom</button>
    <button class="tool" data-add="heart" title="Add a heart"><svg viewBox="0 0 24 24"><path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z"/></svg>Heart</button>
    <button class="tool" data-add="image" title="Add one or more images (or just drop them onto the page)"><svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4 4 3 3-2 4 3"/></svg>Images</button>
  <button class="tool" data-add="circle">Circle</button><button class="tool" data-add="star">Star</button></nav>

  <main class="stage-wrap">
    <div class="optbar" id="optbar">
      <span class="hint" id="hint"></span>
      <label id="tolWrap" hidden>Tolerance <input type="range" id="tol" min="5" max="120" value="40"><span id="tolVal">40</span></label>
      <span class="optgroup" id="brushOpts" hidden>
        <label for="brushSize">Brush size <input type="range" id="brushSize" min="4" max="120" value="28"><span id="brushSizeVal">28</span></label>
        <label><input type="checkbox" id="brushErase"> Eraser</label>
        <button class="btn small" id="brushClear" type="button">Clear all paint</button>
      </span>
      <span class="optgroup" id="recolOpts" hidden>
        <label for="recolCol">Replace with <input type="color" id="recolCol" value="#d6336c"></label>
        <button class="btn small" id="tintAll" type="button" title="Turn every visible pixel of the selected image into this colour">Tint whole image</button>
      </span>
      <span class="optgroup" id="eraseOpts" hidden>
        <label for="eraseSize">Eraser size <input type="range" id="eraseSize" min="4" max="200" value="30"><span id="eraseSizeVal">30</span></label>
      </span>
      <span class="optgroup" id="magicOpts" hidden>
        <label><input type="checkbox" id="magicContig" checked> Only touching pixels</label>
      </span>
      <span class="optgroup" id="maskActs" hidden>
        <label for="recolCol2">Colour <input type="color" id="recolCol2" value="#d6336c"></label>
        <button class="btn small" id="magicRecolor" type="button" title="Change the colour of the selected part and keep its soft edges">Recolour</button>
        <button class="btn small" id="maskFill" type="button" title="Paint the selected area solid with the colour, covering whatever is under it">Fill</button>
        <span class="optgroup" style="gap:6px">
          <label for="growAmt">Grow / shrink <input type="number" id="growAmt" min="1" max="60" value="1" style="width:58px;border:1px solid var(--line);background:var(--soft);border-radius:6px;padding:4px 6px"> px</label>
          <button class="btn small" id="maskShrink" type="button" title="Make the selection thinner by this many pixels">Shrink −</button>
          <button class="btn small" id="maskGrow" type="button" title="Make the selection bigger by this many pixels">Grow +</button>
        </span>
        <button class="btn small" id="maskInvert" type="button" title="Select everything except the current selection">Inverse</button>
        <button class="btn small" id="magicDelete" type="button" title="Rub out the selected area">Delete</button>
        <button class="btn small" id="maskKeep" type="button" title="Keep only the selected area and trim the image to it">Keep only</button>
        <button class="btn small" id="maskCopy" type="button" title="Copy the selected area onto its own layer (the original stays)">Copy to new layer</button>
        <button class="btn small" id="magicSplit" type="button" title="Move the selected area onto its own layer">Split to new layer</button>
        <button class="btn small" id="magicClear" type="button">Deselect</button>
      </span>
      <span id="selActions" hidden style="display:none;gap:6px">
        <button class="btn small" data-sel="keep" title="Throw away everything outside the selection">Keep selection only</button>
        <button class="btn small" data-sel="cut" title="Erase the selected area">Cut out selection</button>
        <button class="btn small" data-sel="copy" title="Copy the selected area onto its own new layer">New layer from selection</button>
        <button class="btn small" data-sel="recolor" title="Turn the selected area into the Image recolour colour">Recolour selection</button>
        <button class="btn small" data-sel="clear">Deselect</button>
      </span>
    </div>
    <div class="stage">
      <div>
        <div class="canvas-box" id="box"><canvas id="main"></canvas><div id="canonical"></div><canvas id="ov"></canvas></div>
        <div class="present-cap" id="presentCap"></div>
      </div>
    </div>
  </main>

  <aside class="side" aria-label="Design settings">
    <section>
      <h2>Whole design <button class="btn small" id="resetSize" type="button">Reset</button></h2>
      <div class="field"><label for="zoom">Design size <span class="val" id="vZoom">100%</span></label><input type="range" id="zoom" min="40" max="130" step="1" value="100"></div>
      <div class="field"><label for="boxsize">Canvas box size <span class="val" id="vBox">50%</span></label><input type="range" id="boxsize" min="25" max="100" step="1" value="50"></div>
    </section>
    <section>
      <h2>Export</h2>
      <div class="field"><label for="expFmt">File type</label><select id="expFmt"><option value="png">PNG</option><option value="jpeg">JPEG (high quality)</option></select></div>
      <div class="field"><label for="expRes">Resolution</label><select id="expRes"><option value="auto">Match my images (keeps label resolution)</option><option value="2">2x (standard)</option><option value="4">4x</option><option value="6">6x</option></select></div>
      <div class="checks"><label><input type="checkbox" id="expCrop"> Crop to image layers (no extra space)</label></div>
      <div class="hint" id="expInfo"></div>
    </section>
    <section>
      <h2>Jacket <button class="ico eyeh" id="jEye" type="button" title="Hide the candy so you can work on a blank page"></button></h2>
      <div class="field"><label for="jStyle">Style</label>
        <select id="jStyle"><option value="segmented">Segmented (two colours)</option><option value="solid">Solid</option><option value="legacy">Original saved jacket</option><option value="pin">Pinstripe</option><option value="rainbow">Rainbow</option></select></div>
      <div class="field" id="rowSeg"><label for="jSeg">Segments</label>
        <select id="jSeg"><option>2</option><option>4</option><option>6</option><option selected>8</option><option>12</option><option>16</option></select></div>
      <div class="field" id="rowGap"><label for="jGap">Pinstripe gap <span class="val" id="vGap"></span></label><input type="range" id="jGap" min="0.05" max="0.7" step="0.01"></div>
      <div class="field" id="rowCols"><label for="jCols">Colours used in jacket</label>
        <select id="jCols"><option value="1">1 (A only)</option><option value="2">2 (A, B)</option><option value="3">3 (A, B, C)</option><option value="4">4 (A, B, C, D)</option></select>
        <div class="note" id="colsHint"></div></div>
      <div class="field"><label for="jRing">Jacket ring thickness <span class="val" id="vRing"></span></label><input type="range" id="jRing" min="0.08" max="0.35" step="0.01"></div>
      <div class="field"><label for="jShade">Shading <span class="val" id="vShade"></span></label><input type="range" id="jShade" min="0" max="1" step="0.05"></div>
      <div class="checks"><label><input type="checkbox" id="jShadow"> Shadow</label><label><input type="checkbox" id="bgTransparent"> Transparent PNG</label></div>
    </section>

    <section>
      <h2>Colours</h2>
      <div class="sub" style="margin-top:0">Pick what to colour, then click a swatch:</div>
      <div class="targets" id="targets"></div>
      <div class="swatches" id="swatches"></div>
      <div class="sub">Type a hex code, use the picker, or pick from your design:</div>
      <div class="hexrow"><input type="text" id="hex" value="#D6336C" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Hex colour code"><input type="color" id="picker" value="#d6336c" aria-label="Colour picker"><button class="btn small" id="eyedrop" type="button" title="Click any colour on your design">Eyedropper</button></div>
      <div class="adder" style="margin-top:8px"><button class="btn small" id="addSwatch" type="button" title="Save this colour in your palette">Custom Colour</button></div>
    </section>

    <section>
      <h2>Layers <button class="btn small" id="dupLayer">Duplicate</button></h2>
      <div class="note" style="margin:0 0 8px">Click a layer to select it. Its settings open right underneath.</div>
      <ul class="layers" id="layers"></ul>
    </section>
  <section><h2>Production &amp; proofs</h2><label for="productionNotes">Production notes (internal only)</label><textarea id="productionNotes" rows="3" style="width:100%"></textarea><div class="pair"><button class="btn small" id="proofPdf">Customer proof</button><button class="btn small" id="exportSvg">Export SVG</button><button class="btn small" id="exportPdf">Export PDF</button></div><details><summary>Production specification</summary><div id="productionSpec"></div></details></section></aside>
</div>

<input type="file" id="fileIn" accept="image/png,image/jpeg,image/webp" multiple hidden>
<input type="file" id="projIn" accept=".json,application/json" hidden>
<div class="toast" id="toast" role="status"></div>
<div class="drop" id="drop">Drop images to add them as layers</div>

</body></html>`;
