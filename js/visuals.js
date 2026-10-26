/** Dependency-free concept views. These are schematics, not imported CAD models. */
const TAU = Math.PI * 2;
const C = {
  faint: 'rgba(151,176,183,.10)',
  guide: 'rgba(151,176,183,.23)',
  muted: '#7e989f',
  text: '#dce8e9',
  accent: '#9bd7c6'
};

function surface(canvas, paint) {
  const ctx = canvas.getContext('2d');
  let active = true;
  let width = 0;
  let height = 0;
  let frame = 0;
  function render() {
    if (active && width && height) paint(ctx, width, height);
  }
  function resize() {
    if (!active) return;
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width || canvas.parentElement?.clientWidth || 480);
    height = Math.max(1, rect.height || 340);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    render();
  }
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  observer?.observe(canvas);
  window.addEventListener('resize', resize);
  frame = requestAnimationFrame(resize);
  return {
    render,
    cleanup() {
      active = false;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener('resize', resize);
    }
  };
}

function polygon(ctx, points) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
}

function line(ctx, x1, y1, x2, y2, color = C.guide, width = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function label(ctx, text, x, y, color = C.muted, align = 'left') {
  ctx.fillStyle = color;
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function coords(rings) {
  const n = Math.max(0, Math.round(rings) - 1);
  const points = [];
  for (let q = -n; q <= n; q++) {
    for (let r = Math.max(-n, -q - n); r <= Math.min(n, -q + n); r++) {
      points.push({q, r, ring: Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r))});
    }
  }
  return points;
}

/** Render the same flat-top axial geometry used by the sizing equations. */
export function mountAperture(canvas, geometry) {
  const rings = Math.max(1, Math.min(100, Math.round(geometry.rings || 1)));
  const cells = coords(rings);
  const root3 = Math.sqrt(3);
  const vertices = cells.flatMap(({q, r}) => Array.from({length: 6}, (_, i) => [
    1.5 * q + Math.cos(i * Math.PI / 3),
    root3 * (r + q / 2) + Math.sin(i * Math.PI / 3)
  ]));
  const maxX = vertices.reduce((max,p)=>Math.max(max,Math.abs(p[0])),0);
  const maxY = vertices.reduce((max,p)=>Math.max(max,Math.abs(p[1])),0);
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${cells.length} hexagonal mirror segments in ${rings} rings. Each segment is ${geometry.flatToFlatM ?? 'TBD'} metres flat to flat.`);
  const api = surface(canvas, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    const cx = width / 2;
    const cy = height / 2 - 12;
    const size = Math.min((width - 64) / (2 * maxX), (height - 100) / (2 * maxY));
    if (size <= 0) return;
    const reach = Math.min(width / 2 - 28, height / 2 - 35);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach * 1.15);
    glow.addColorStop(0, 'rgba(143,191,190,.09)');
    glow.addColorStop(1, 'rgba(143,191,190,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    [0.42, 0.7, 0.98].forEach(f => {
      ctx.beginPath();
      ctx.arc(cx, cy, reach * f, 0, TAU);
      ctx.strokeStyle = C.faint;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    ctx.setLineDash([3, 5]);
    line(ctx, cx, 22, cx, height - 35, C.faint);
    line(ctx, 25, cy, width - 25, cy, C.faint);
    ctx.setLineDash([]);
    cells.forEach(({q, r, ring}) => {
      const x = cx + 1.5 * size * q;
      const y = cy + root3 * size * (r + q / 2);
      const inset = Math.max(size * .90, size - 1.5);
      const points = Array.from({length: 6}, (_, i) => [x + inset * Math.cos(i * Math.PI / 3), y + inset * Math.sin(i * Math.PI / 3)]);
      const t = ring / Math.max(1, rings - 1);
      const hi = Math.round(224 - t * 17);
      const low = Math.round(111 - t * 7);
      const gradient = ctx.createLinearGradient(x - size * .6, y - size * .8, x + size * .7, y + size * .9);
      gradient.addColorStop(0, `rgb(${hi},${hi + 7},${hi + 9})`);
      gradient.addColorStop(.45, `rgb(${hi - 35},${hi - 27},${hi - 25})`);
      gradient.addColorStop(1, `rgb(${low},${low + 15},${low + 20})`);
      polygon(ctx, points);
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.strokeStyle = 'rgba(232,245,244,.40)';
      ctx.lineWidth = .7;
      ctx.stroke();
      // A very fine center mark identifies an independent segment spacecraft.
      if (size > 15) {
        ctx.fillStyle = 'rgba(245,255,255,.48)';
        ctx.beginPath();
        ctx.arc(x, y, .9, 0, TAU);
        ctx.fill();
      }
    });
    const rulerY = Math.min(height - 31, cy + maxY * size + 22);
    const left = cx - maxX * size;
    const right = cx + maxX * size;
    line(ctx, left, rulerY, right, rulerY, 'rgba(155,215,198,.48)');
    line(ctx, left, rulerY - 4, left, rulerY + 4, C.accent);
    line(ctx, right, rulerY - 4, right, rulerY + 4, C.accent);
    const span = Number.isFinite(geometry.flatToFlatM) ? 2 * maxX * geometry.flatToFlatM / root3 : null;
    label(ctx, span === null ? 'SPAN TBD' : `${span.toLocaleString(undefined, {maximumFractionDigits: 2})} m horizontal span`, cx, rulerY + 17, C.muted, 'center');
    label(ctx, 'APERTURE / PLAN VIEW', 20, 20);
    label(ctx, `${cells.length} SEGMENTS`, width - 20, 20, C.accent, 'right');
  });
  return () => api.cleanup();
}

function hex(z, radius = 1) {
  return Array.from({length: 6}, (_, i) => [radius * Math.cos(i * Math.PI / 3), radius * Math.sin(i * Math.PI / 3), z]);
}

/** Drag to orbit; scroll or +/- to zoom; arrow keys to orbit; Home to reset. */
export function mountModel(canvas, {kind = 'structure', geometry = {}, materialLabel = 'TBD'} = {}) {
  let tilt = .94;
  let spin = -.38;
  let zoom = 1;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const isPayload = kind === 'payload';
  canvas.tabIndex = 0;
  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'grab';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', `${isPayload ? 'Mirror substrate and coating' : 'Hexagonal spacecraft structure'} concept schematic. Drag to rotate, scroll to zoom, or use arrow keys and plus or minus. Home resets the view. Material: ${materialLabel}.`);
  const api = surface(canvas, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    const scale = Math.min(width * .30, height * .35) * zoom;
    const cx = width / 2;
    const cy = height / 2 + 5;
    const transform = ([x, y, z]) => {
      const x1 = x * Math.cos(spin) - y * Math.sin(spin);
      const y1 = x * Math.sin(spin) + y * Math.cos(spin);
      const y2 = y1 * Math.cos(tilt) - z * Math.sin(tilt);
      const depth = y1 * Math.sin(tilt) + z * Math.cos(tilt);
      return {x: cx + x1 * scale, y: cy + y2 * scale, depth};
    };
    const point = p => {const t = transform(p); return [t.x, t.y];};
    const glow = ctx.createRadialGradient(cx, cy, 5, cx, cy, Math.min(width, height) * .52);
    glow.addColorStop(0, 'rgba(128,174,181,.10)');
    glow.addColorStop(1, 'rgba(128,174,181,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    // Reference plane is drawn in the same world coordinate frame.
    const planeZ = isPayload ? -.3 : -.50;
    for (let i = -3; i <= 3; i++) {
      const a = point([i * .5, -1.5, planeZ]);
      const b = point([i * .5, 1.5, planeZ]);
      const c = point([-1.5, i * .5, planeZ]);
      const d = point([1.5, i * .5, planeZ]);
      line(ctx, ...a, ...b, C.faint);
      line(ctx, ...c, ...d, C.faint);
    }
    const faces = [];
    function face(points, fill, stroke = 'rgba(199,221,225,.55)') {
      faces.push({points, fill, stroke, depth: points.reduce((sum, p) => sum + transform(p).depth, 0) / points.length});
    }
    const bottomZ = isPayload ? -.16 : -.38;
    const topZ = isPayload ? .16 : .28;
    const bottom = hex(bottomZ);
    const top = hex(topZ);
    if (isPayload) {
      face(bottom, '#485b65');
      for (let i = 0; i < 6; i++) {
        const j = (i + 1) % 6;
        face([bottom[i], bottom[j], top[j], top[i]], ['#718791', '#566e7a', '#405762', '#718791', '#536d78', '#7f96a0'][i]);
      }
      face(top, '#a8bdc4');
      face(hex(.175, .985), '#cad9dc', 'rgba(240,251,253,.8)');
    } else {
      face(bottom, 'rgba(39,59,69,.84)');
      // Thin side members leave the internal frame legible.
      for (let i = 0; i < 6; i++) {
        const j = (i + 1) % 6;
        face([bottom[i], bottom[j], [bottom[j][0], bottom[j][1], bottomZ + .07], [bottom[i][0], bottom[i][1], bottomZ + .07]], '#566d78');
      }
      face(top, 'rgba(125,153,163,.16)', 'rgba(205,227,230,.75)');
    }
    // Smaller depth appears behind the larger depth after this camera transform.
    faces.sort((a, b) => a.depth - b.depth).forEach(f => {
      polygon(ctx, f.points.map(point));
      ctx.fillStyle = f.fill;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = f.stroke;
      ctx.stroke();
    });
    if (!isPayload) {
      for (let i = 0; i < 6; i++) {
        const j = (i + 1) % 6;
        line(ctx, ...point(bottom[i]), ...point(top[i]), 'rgba(196,219,223,.80)', 2.5);
        line(ctx, ...point(bottom[i]), ...point(top[j]), 'rgba(155,215,198,.48)', 1.2);
      }
      const inner = hex(bottomZ + .08, .52);
      polygon(ctx, inner.map(point));
      ctx.fillStyle = '#324a57';
      ctx.fill();
      ctx.strokeStyle = '#7d9eaa';
      ctx.stroke();
      inner.forEach(p => {
        const [x, y] = point(p);
        ctx.fillStyle = C.accent;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, TAU);
        ctx.fill();
      });
    } else {
      // Etched construction marks distinguish the optical face.
      const center = point([0, 0, .18]);
      line(ctx, center[0] - 4, center[1], center[0] + 4, center[1], 'rgba(77,112,123,.5)');
      line(ctx, center[0], center[1] - 4, center[0], center[1] + 4, 'rgba(77,112,123,.5)');
    }
    const axisOrigin = [width - 52, height - 45];
    const axisVectors = [[.28, 0, 0], [0, .28, 0], [0, 0, .28]];
    const axisColors = ['#b1c7ce', '#93c9b8', '#91a9d0'];
    const origin = transform([0, 0, 0]);
    axisVectors.forEach((vector, i) => {
      const p = transform(vector);
      const x = axisOrigin[0] + (p.x - origin.x) / zoom * .7;
      const y = axisOrigin[1] + (p.y - origin.y) / zoom * .7;
      line(ctx, ...axisOrigin, x, y, axisColors[i], 1.4);
      label(ctx, ['X', 'Y', 'Z'][i], x + 5, y, axisColors[i]);
    });
    label(ctx, isPayload ? 'MIRROR / LAYER SCHEMATIC' : 'SEGMENT / FRAME SCHEMATIC', 18, 20);
    label(ctx, `${Math.round(zoom * 100)}%`, width - 18, 20, C.accent, 'right');
    label(ctx, 'DRAG TO ROTATE · SCROLL TO ZOOM', 18, height - 19);
  });
  function down(event) {
    if (event.button !== undefined && event.button !== 0) return;
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.style.cursor = 'grabbing';
    canvas.setPointerCapture?.(event.pointerId);
    canvas.focus({preventScroll: true});
  }
  function move(event) {
    if (!dragging) return;
    spin += (event.clientX - lastX) * .008;
    tilt = Math.max(.12, Math.min(Math.PI - .12, tilt + (event.clientY - lastY) * .008));
    lastX = event.clientX;
    lastY = event.clientY;
    api.render();
  }
  function up(event) {
    dragging = false;
    canvas.style.cursor = 'grab';
    if (event.pointerId !== undefined && canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  function wheel(event) {
    event.preventDefault();
    zoom = Math.max(.55, Math.min(1.8, zoom * Math.exp(-event.deltaY * .001)));
    api.render();
  }
  function key(event) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') spin -= .12;
    if (event.key === 'ArrowRight') spin += .12;
    if (event.key === 'ArrowUp') tilt -= .12;
    if (event.key === 'ArrowDown') tilt += .12;
    if (event.key === '+' || event.key === '=') zoom *= 1.1;
    if (event.key === '-' || event.key === '_') zoom /= 1.1;
    if (event.key === 'Home') {tilt = .94; spin = -.38; zoom = 1;}
    tilt = Math.max(.12, Math.min(Math.PI - .12, tilt));
    zoom = Math.max(.55, Math.min(1.8, zoom));
    api.render();
  }
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('lostpointercapture', up);
  canvas.addEventListener('wheel', wheel, {passive: false});
  canvas.addEventListener('keydown', key);
  return () => {
    api.cleanup();
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
    canvas.removeEventListener('lostpointercapture', up);
    canvas.removeEventListener('wheel', wheel);
    canvas.removeEventListener('keydown', key);
  };
}
