/* Flower color scoring tool — Stone Lab
 *
 * Settings for this deployment. These are the lines to check if you replace this file.
 */
const PASSWORD   = 'newberryi';
const ENDPOINT   = 'https://script.google.com/macros/s/AKfycbxejFlRf58Ih80DKgX_0UvU_norR2sh1UMEJvQsbWk9c6qDjJNSpUJ446RZ_eocWSa2Xg/exec';
const IMAGE_DIR  = '/penstemon_color_images/images/';   // separate repo, same domain

/* ------------------------------------------------------------------ */

const DETAIL_MAX   = 900;   // px, longest side of the clickable canvas
const OVERVIEW_MAX = 240;   // px, longest side of the small navigation image

// Glare is a reflection of the light source, so it is near-white: ALL channels high.
// Testing a single channel would flag every saturated pink petal, which is not glare.
const GLARE_AT = 225;   // lowest channel at or above this counts as glare
const CLIP_AT  = 255;   // a channel pinned at the maximum; the true colour was out of range

const STORE_PREFIX = 'stonelab_color_v1_';

let manifest = [];
let scorer   = '';
let idx      = 0;           // index into manifest
let done     = {};          // obsID -> true
let rows     = [];          // every row this scorer has produced, for the backup file

let img      = null;        // the loaded Image
let full     = null;        // offscreen canvas at natural size, for reading pixels
let fullCtx  = null;
let region   = null;        // {sx, sy, sw, sh} currently shown in the detail canvas
let clicks   = [];          // [{x, y, r, g, b, clipped}]
let lighting = '';
let reject   = '';

const $ = (id) => document.getElementById(id);

/* ---------------------- gate ---------------------- */

$('gate-go').addEventListener('click', tryStart);
$('gate-pw').addEventListener('keydown', (e) => { if (e.key === 'Enter') tryStart(); });

function tryStart() {
  const who = $('gate-scorer').value;
  const pw  = $('gate-pw').value;
  if (!who) { $('gate-err').textContent = 'Choose your name first.'; return; }
  if (pw !== PASSWORD) { $('gate-err').textContent = 'That password is not right.'; return; }
  scorer = who;
  $('gate').remove();
  $('scorer-tag').textContent = scorer;
  loadProgress();
  start();
}

/* ---------------------- progress in this browser ---------------------- */

function storeKey() { return STORE_PREFIX + scorer; }

function loadProgress() {
  try {
    const raw = localStorage.getItem(storeKey());
    if (raw) {
      const saved = JSON.parse(raw);
      done = saved.done || {};
      rows = saved.rows || [];
    }
  } catch (err) {
    console.error('Could not read saved progress:', err);
  }
}

function saveProgress() {
  try {
    localStorage.setItem(storeKey(), JSON.stringify({ done: done, rows: rows }));
  } catch (err) {
    console.error('Could not save progress:', err);
  }
}

/* ---------------------- startup ---------------------- */

async function start() {
  try {
    const res = await fetch('manifest.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('manifest.json returned ' + res.status);
    manifest = await res.json();
  } catch (err) {
    document.body.innerHTML =
      '<div class="wrap" style="padding:80px 40px;"><h2>Cannot read the image list</h2>' +
      '<p>manifest.json did not load. It needs to sit in this same folder, and the page has to be ' +
      'opened over https rather than as a file on disk.</p></div>';
    console.error(err);
    return;
  }
  $('main').hidden = false;
  wireControls();
  nextUnscored();
}

function nextUnscored() {
  while (idx < manifest.length && done[manifest[idx].obsID]) idx++;
  if (idx >= manifest.length) {
    $('main').hidden = true;
    $('finished').hidden = false;
    $('progress').textContent = manifest.length + ' / ' + manifest.length;
    return;
  }
  loadImage(manifest[idx]);
}

/* ---------------------- image loading ---------------------- */

function loadImage(entry) {
  clicks = []; lighting = ''; reject = '';
  renderSwatches(); clearChoices(); updateSaveButton();
  $('clipwarn').innerHTML = '';
  $('savestate').textContent = '';

  // count only images in the CURRENT manifest, so the counter reads 1 / 100 at the
  // start of every batch rather than continuing to climb across batches
  const nDone = manifest.filter((m) => done[m.obsID]).length;
  $('progress').textContent = (nDone + 1) + ' / ' + manifest.length;
  $('species').textContent = entry.species || '';
  $('credit').textContent  = entry.creator ? ('photo: ' + entry.creator + (entry.license ? ' · ' + entry.license : '')) : '';

  img = new Image();
  img.onload = () => {
    full = document.createElement('canvas');
    full.width  = img.naturalWidth;
    full.height = img.naturalHeight;
    fullCtx = full.getContext('2d', { willReadFrequently: true });
    fullCtx.drawImage(img, 0, 0);
    region = { sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight };
    drawOverview();
    drawDetail();
  };
  img.onerror = () => {
    $('species').textContent = 'Image would not load: ' + entry.file;
  };
  img.src = IMAGE_DIR + entry.file;
}

/* ---------------------- drawing ---------------------- */

function fit(w, h, max) {
  const s = Math.min(max / w, max / h, 1);
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

function drawDetail() {
  const c = $('detail');
  const d = fit(region.sw, region.sh, DETAIL_MAX);
  c.width = d.w; c.height = d.h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, region.sx, region.sy, region.sw, region.sh, 0, 0, d.w, d.h);
}

function drawOverview(box) {
  const c = $('overview');
  const d = fit(img.naturalWidth, img.naturalHeight, OVERVIEW_MAX);
  c.width = d.w; c.height = d.h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, d.w, d.h);
  // outline the region currently shown in the large canvas
  const k = d.w / img.naturalWidth;
  const r = box || region;
  if (r.sw < img.naturalWidth || r.sh < img.naturalHeight || box) {
    ctx.strokeStyle = '#C8637A';
    ctx.lineWidth = 2;
    ctx.strokeRect(r.sx * k, r.sy * k, r.sw * k, r.sh * k);
  }
}

/* ---------------------- zoom by dragging on the overview ---------------------- */

let dragFrom = null;

function overviewPoint(e) {
  const c = $('overview');
  const rect = c.getBoundingClientRect();
  const k = img.naturalWidth / c.width;               // original px per canvas px
  const cx = (e.clientX - rect.left) * (c.width / rect.width);
  const cy = (e.clientY - rect.top)  * (c.height / rect.height);
  return { x: cx * k, y: cy * k };
}

$('overview').addEventListener('pointerdown', (e) => {
  if (!img) return;
  dragFrom = overviewPoint(e);
  $('overview').setPointerCapture(e.pointerId);
});

$('overview').addEventListener('pointermove', (e) => {
  if (!dragFrom) return;
  const p = overviewPoint(e);
  drawOverview(boxFrom(dragFrom, p));
});

$('overview').addEventListener('pointerup', (e) => {
  if (!dragFrom) return;
  const p = overviewPoint(e);
  const box = boxFrom(dragFrom, p);
  dragFrom = null;
  if (box.sw < 12 || box.sh < 12) { drawOverview(); return; }  // treat a stray tap as no-op
  region = box;
  drawOverview();
  drawDetail();
});

function boxFrom(a, b) {
  const sx = Math.max(0, Math.min(a.x, b.x));
  const sy = Math.max(0, Math.min(a.y, b.y));
  const sw = Math.min(img.naturalWidth  - sx, Math.abs(a.x - b.x));
  const sh = Math.min(img.naturalHeight - sy, Math.abs(a.y - b.y));
  return { sx: Math.round(sx), sy: Math.round(sy), sw: Math.round(sw), sh: Math.round(sh) };
}

$('reset-zoom').addEventListener('click', () => {
  if (!img) return;
  region = { sx: 0, sy: 0, sw: img.naturalWidth, sh: img.naturalHeight };
  drawOverview();
  drawDetail();
});

/* ---------------------- sampling a pixel ---------------------- */

$('detail').addEventListener('click', (e) => {
  if (!img || reject) return;
  const c = $('detail');
  const rect = c.getBoundingClientRect();
  // click position in canvas pixels, then in original image pixels
  const cx = (e.clientX - rect.left) * (c.width / rect.width);
  const cy = (e.clientY - rect.top)  * (c.height / rect.height);
  const px = Math.floor(region.sx + cx * (region.sw / c.width));
  const py = Math.floor(region.sy + cy * (region.sh / c.height));
  if (px < 0 || py < 0 || px >= img.naturalWidth || py >= img.naturalHeight) return;

  const d = fullCtx.getImageData(px, py, 1, 1).data;
  const glare   = Math.min(d[0], d[1], d[2]) >= GLARE_AT;
  const clipped = (d[0] >= CLIP_AT || d[1] >= CLIP_AT || d[2] >= CLIP_AT);
  clicks.push({ x: px, y: py, r: d[0], g: d[1], b: d[2], glare: glare, clipped: clipped });
  renderSwatches();
  updateSaveButton();
});

function renderSwatches() {
  const wrap = $('swatches');
  wrap.innerHTML = clicks.map((p) => {
    const cls = p.glare ? ' glare' : (p.clipped ? ' clipped' : '');
    return '<span class="sw' + cls + '" style="background:rgb(' + p.r + ',' + p.g + ',' + p.b +
           ')" title="' + p.r + ', ' + p.g + ', ' + p.b + '"></span>';
  }).join('');
  $('clickcount').textContent = clicks.length + (clicks.length === 1 ? ' pixel' : ' pixels');

  const nGlare = clicks.filter((p) => p.glare).length;
  const nClip  = clicks.filter((p) => p.clipped && !p.glare).length;
  let msg = '';
  if (nGlare) {
    msg += '<div class="warn">' + nGlare + ' sampled ' + (nGlare === 1 ? 'pixel is' : 'pixels are') +
           ' almost white, outlined in pink above. That is glare rather than petal colour. ' +
           'Undo those and sample somewhere without a shine on it.</div>';
  }
  if (nClip) {
    msg += '<div class="note">' + nClip + ' ' + (nClip === 1 ? 'pixel is' : 'pixels are') +
           ' at the very top of one colour channel. The flower may be more saturated than the ' +
           'camera could record. Nothing to fix, and worth noting if most of this flower looks that way.</div>';
  }
  $('clipwarn').innerHTML = msg;
}

$('undo').addEventListener('click', () => {
  clicks.pop();
  renderSwatches();
  updateSaveButton();
});

/* ---------------------- lighting and reject choices ---------------------- */

function wireControls() {
  $('light-choice').addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    lighting = (lighting === btn.dataset.val) ? '' : btn.dataset.val;
    paintChoice('light-choice', lighting);
    updateSaveButton();
  });

  $('reject-choice').addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    reject = (reject === btn.dataset.val) ? '' : btn.dataset.val;
    if (reject) { clicks = []; renderSwatches(); }
    paintChoice('reject-choice', reject);
    updateSaveButton();
  });

  $('save').addEventListener('click', save);
  $('download').addEventListener('click', download);
  $('download2').addEventListener('click', download);
}

function paintChoice(containerId, value) {
  $(containerId).querySelectorAll('button').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.val === value));
  });
}

function clearChoices() {
  paintChoice('light-choice', '');
  paintChoice('reject-choice', '');
}

function updateSaveButton() {
  // a lighting call is always required; then either a rejection reason or at least one pixel
  const ok = lighting && (reject || clicks.length > 0);
  $('save').disabled = !ok;
  $('save').textContent = reject ? 'Save rejection and next' : 'Save and next';
}

/* ---------------------- saving ---------------------- */

function save() {
  const entry = manifest[idx];
  const stamp = new Date().toISOString();
  const out = [];

  if (reject) {
    out.push({ stamp: stamp, scorer: scorer, obsID: entry.obsID, decision: 'reject',
               reason: reject, lighting: lighting,
               clickX: '', clickY: '', R: '', G: '', B: '' });
  } else {
    clicks.forEach((p) => {
      out.push({ stamp: stamp, scorer: scorer, obsID: entry.obsID, decision: 'accept',
                 reason: '', lighting: lighting,
                 clickX: p.x, clickY: p.y, R: p.r, G: p.g, B: p.b });
    });
  }

  rows = rows.concat(out);
  done[entry.obsID] = true;
  saveProgress();
  post(out);

  idx++;
  nextUnscored();
}

function post(out) {
  // All rows for this image go in ONE request. Apps Script serialises writes badly
  // under concurrent requests, so one POST per pixel would risk losing rows.
  // Apps Script also sends no CORS headers, making this fire-and-forget: the browser
  // sends it but will not let us read the reply. That is why every row is also kept
  // in this browser and downloadable.
  fetch(ENDPOINT, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(out)
  }).catch((err) => console.error('Rows may not have reached the sheet:', err));
  $('savestate').textContent = 'saved · ' + rows.length + ' rows on this computer';
}

/* ---------------------- backup file ---------------------- */

function download() {
  const header = ['timestamp', 'scorer', 'obsID', 'decision', 'reason', 'lighting',
                  'clickX', 'clickY', 'R', 'G', 'B'];
  const lines = [header.join(',')].concat(
    rows.map((r) => [r.stamp, r.scorer, r.obsID, r.decision, '"' + r.reason + '"',
                     r.lighting, r.clickX, r.clickY, r.R, r.G, r.B].join(','))
  );
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'color_' + scorer + '_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}
