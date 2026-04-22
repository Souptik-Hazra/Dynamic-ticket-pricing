import React, { useMemo } from 'react';

// ── Default section colors (premium → value) ──────────────────────────────
const DEFAULT_COLORS = [
  '#FFD700', // Gold
  '#E040FB', // Purple/Pink
  '#00E5FF', // Cyan
  '#76FF03', // Lime
  '#FF6D00', // Orange
  '#448AFF', // Blue
  '#FF1744', // Red
  '#00E676', // Green
  '#D500F9', // Violet
  '#FFEA00', // Yellow
];

// ── SVG Geometry generators (preserved from original) ────────────────────
function generateStadiumSections(categories, stagePos) {
  const cx = 300, cy = 200;
  const fieldRx = 100, fieldRy = 60;
  const n = categories.length;
  if (n === 0) return { sections: [], stage: null };
  const sections = [];
  const startAngle = stagePos === 'top' ? Math.PI : 0;
  const totalAngle = 2 * Math.PI;
  const gap = 0.04;
  categories.forEach((cat, i) => {
    const a1 = startAngle + (totalAngle / n) * i + gap / 2;
    const a2 = startAngle + (totalAngle / n) * (i + 1) - gap / 2;
    const innerR = { x: fieldRx + 25, y: fieldRy + 20 };
    const outerR = { x: fieldRx + 90, y: fieldRy + 75 };
    const ix1 = cx + innerR.x * Math.cos(a1);
    const iy1 = cy + innerR.y * Math.sin(a1);
    const ix2 = cx + innerR.x * Math.cos(a2);
    const iy2 = cy + innerR.y * Math.sin(a2);
    const ox1 = cx + outerR.x * Math.cos(a1);
    const oy1 = cy + outerR.y * Math.sin(a1);
    const ox2 = cx + outerR.x * Math.cos(a2);
    const oy2 = cy + outerR.y * Math.sin(a2);
    const largeArc = (a2 - a1) > Math.PI ? 1 : 0;
    const path = [`M ${ix1} ${iy1}`, `A ${innerR.x} ${innerR.y} 0 ${largeArc} 1 ${ix2} ${iy2}`, `L ${ox2} ${oy2}`, `A ${outerR.x} ${outerR.y} 0 ${largeArc} 0 ${ox1} ${oy1}`, 'Z'].join(' ');
    const midA = (a1 + a2) / 2;
    const labelR = { x: (innerR.x + outerR.x) / 2, y: (innerR.y + outerR.y) / 2 };
    sections.push({ path, labelX: cx + labelR.x * Math.cos(midA), labelY: cy + labelR.y * Math.sin(midA), category: cat, index: i });
  });
  return { sections, stage: { type: 'ellipse', cx, cy, rx: fieldRx, ry: fieldRy, label: '⚽ FIELD' } };
}

function generateTheaterSections(categories, stagePos) {
  const w = 600, margin = 30;
  const stageH = 45;
  const n = categories.length;
  if (n === 0) return { sections: [], stage: null };
  const usableH = 400 - stageH - margin * 2;
  const sectionH = Math.min(70, (usableH - (n - 1) * 8) / n);
  const sections = [];
  categories.forEach((cat, i) => {
    const y = stageH + margin + 15 + i * (sectionH + 8);
    const taperAmount = i * 12;
    const x1 = margin + taperAmount;
    const x2 = w - margin - taperAmount;
    const path = [`M ${x1} ${y}`, `L ${x2} ${y}`, `L ${x2 + 6} ${y + sectionH}`, `L ${x1 - 6} ${y + sectionH}`, 'Z'].join(' ');
    sections.push({ path, labelX: w / 2, labelY: y + sectionH / 2, category: cat, index: i });
  });
  let stageY = margin;
  if (stagePos === 'bottom') stageY = 400 - margin - stageH;
  else if (stagePos === 'center') stageY = (400 - stageH) / 2;
  return { sections, stage: { type: 'rect', x: margin + 30, y: stageY, width: w - margin * 2 - 60, height: stageH, label: '🎭 STAGE' } };
}

function generateArenaSections(categories, stagePos) {
  const w = 600, h = 400;
  const stageW = 200, stageH = 60;
  const n = categories.length;
  if (n === 0) return { sections: [], stage: null };
  const sections = [];
  const stageX = (w - stageW) / 2;
  let stageY = 20;
  if (stagePos === 'bottom') stageY = h - stageH - 20;
  else if (stagePos === 'center') stageY = (h - stageH) / 2;
  const sideCount = Math.floor(n / 3);
  const centerCount = n - sideCount * 2;
  const centerY = stageY + stageH + 15;
  const centerH = Math.min(60, 180 / Math.max(centerCount, 1));
  for (let i = 0; i < centerCount; i++) {
    const y = centerY + i * (centerH + 6);
    const taper = i * 15;
    sections.push({ path: `M ${stageX - 20 - taper} ${y} L ${stageX + stageW + 20 + taper} ${y} L ${stageX + stageW + 20 + taper} ${y + centerH} L ${stageX - 20 - taper} ${y + centerH} Z`, labelX: w / 2, labelY: y + centerH / 2, category: categories[i], index: i });
  }
  const sideTop = stageY + 10;
  const sideH = (h - sideTop - 40) / Math.max(sideCount, 1);
  for (let i = 0; i < sideCount; i++) {
    const y = sideTop + i * sideH;
    const catIdx = centerCount + i;
    sections.push({ path: `M 20 ${y} L ${stageX - 35} ${y} L ${stageX - 35} ${y + sideH - 5} L 20 ${y + sideH - 5} Z`, labelX: (20 + stageX - 35) / 2, labelY: y + (sideH - 5) / 2, category: categories[catIdx], index: catIdx });
    const catIdxR = centerCount + sideCount + i;
    if (catIdxR < n) sections.push({ path: `M ${stageX + stageW + 35} ${y} L ${w - 20} ${y} L ${w - 20} ${y + sideH - 5} L ${stageX + stageW + 35} ${y + sideH - 5} Z`, labelX: (stageX + stageW + 35 + w - 20) / 2, labelY: y + (sideH - 5) / 2, category: categories[catIdxR], index: catIdxR });
  }
  return { sections, stage: { type: 'rect', x: stageX, y: stageY, width: stageW, height: stageH, label: '🎤 STAGE' } };
}

function generateRectangleSections(categories, stagePos) {
  const w = 600, h = 400;
  const margin = 30;
  const stageH = 40;
  const n = categories.length;
  if (n === 0) return { sections: [], stage: null };
  const sections = [];
  const cols = n <= 3 ? n : Math.min(3, Math.ceil(n / 2));
  const rows = Math.ceil(n / cols);
  const gap = 8;
  const areaW = w - margin * 2;
  const areaH = h - margin * 2 - stageH - 20;
  const secW = (areaW - (cols - 1) * gap) / cols;
  const secH = (areaH - (rows - 1) * gap) / rows;
  categories.forEach((cat, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = margin + col * (secW + gap);
    const y = margin + stageH + 20 + row * (secH + gap);
    sections.push({ path: `M ${x} ${y} L ${x + secW} ${y} L ${x + secW} ${y + secH} L ${x} ${y + secH} Z`, labelX: x + secW / 2, labelY: y + secH / 2, category: cat, index: i });
  });
  let stageY = margin;
  if (stagePos === 'bottom') stageY = 400 - margin - stageH;
  else if (stagePos === 'center') stageY = (400 - stageH) / 2;
  return { sections, stage: { type: 'rect', x: margin + 60, y: stageY, width: areaW - 120, height: stageH, label: '🏢 STAGE / PODIUM' } };
}

function generateFestivalSections(categories, stagePos) {
  const cx = 300, cy = 50;
  const n = categories.length;
  if (n === 0) return { sections: [], stage: null };
  const sections = [];
  const startR = 70;
  const bandW = Math.min(65, (350 - startR) / n);
  categories.forEach((cat, i) => {
    const rInner = startR + i * (bandW + 4);
    const rOuter = rInner + bandW;
    const startA = -Math.PI * 0.85;
    const endA = -Math.PI * 0.15;
    const ix1 = cx + rInner * Math.cos(startA);
    const iy1 = cy - rInner * Math.sin(startA);
    const ix2 = cx + rInner * Math.cos(endA);
    const iy2 = cy - rInner * Math.sin(endA);
    const ox1 = cx + rOuter * Math.cos(startA);
    const oy1 = cy - rOuter * Math.sin(startA);
    const ox2 = cx + rOuter * Math.cos(endA);
    const oy2 = cy - rOuter * Math.sin(endA);
    const path = [`M ${ix1} ${iy1}`, `A ${rInner} ${rInner} 0 0 0 ${ix2} ${iy2}`, `L ${ox2} ${oy2}`, `A ${rOuter} ${rOuter} 0 0 1 ${ox1} ${oy1}`, 'Z'].join(' ');
    const midA = (startA + endA) / 2;
    const midR = (rInner + rOuter) / 2;
    sections.push({ path, labelX: cx + midR * Math.cos(midA), labelY: cy - midR * Math.sin(midA), category: cat, index: i });
  });
  let stageY = 15;
  if (stagePos === 'bottom') stageY = 420 - 50;
  else if (stagePos === 'center') stageY = 180;
  return { sections, stage: { type: 'rect', x: cx - 60, y: stageY, width: 120, height: 35, label: '🎪 STAGE' } };
}

function generatePremiumConcertSections(categories, stagePos) {
  const cx = 300, cy = 150, n = categories.length;
  if (n === 0) return { sections: [], stage: null };
  const sections = [];
  const floorCount = Math.max(1, Math.ceil(n * 0.5));
  const ringCount = n - floorCount;
  const cols = Math.ceil(Math.sqrt(floorCount * 1.5));
  const rows = Math.ceil(floorCount / cols);
  const gap = 8, floorW = 320, floorH = 140, boxW = (floorW - (cols - 1) * gap) / cols, boxH = (floorH - (rows - 1) * gap) / rows, startY = 90;
  for (let i = 0; i < floorCount; i++) {
    const r = Math.floor(i / cols), c = i % cols, curCols = (r === rows - 1 && floorCount % cols !== 0) ? floorCount % cols : cols;
    const startX = cx - (curCols * boxW + (curCols - 1) * gap) / 2, x = startX + c * (boxW + gap), y = startY + r * (boxH + gap);
    sections.push({ path: `M ${x} ${y} L ${x + boxW} ${y} L ${x + boxW} ${y + boxH} L ${x} ${y + boxH} Z`, labelX: x + boxW / 2, labelY: y + boxH / 2, category: categories[i], index: i });
  }
  if (ringCount > 0) {
    const r1 = 160, r2 = 200, r3 = 210, r4 = 255, ring1C = Math.ceil(ringCount / 2), ring2C = ringCount - ring1C;
    const draw = (rIn, rOut, count, offset) => {
      for (let i = 0; i < count; i++) {
        const a1 = Math.PI - 0.2 + (0.2 - (Math.PI - 0.2)) * (i / count), a2 = Math.PI - 0.2 + (0.2 - (Math.PI - 0.2)) * ((i + 1) / count) - 0.03;
        const path = `M ${cx + rIn * Math.cos(a1)} ${cy + rIn * Math.sin(a1)} A ${rIn} ${rIn} 0 0 1 ${cx + rIn * Math.cos(a2)} ${cy + rIn * Math.sin(a2)} L ${cx + rOut * Math.cos(a2)} ${cy + rOut * Math.sin(a2)} A ${rOut} ${rOut} 0 0 0 ${cx + rOut * Math.cos(a1)} ${cy + rOut * Math.sin(a1)} Z`;
        sections.push({ path, labelX: cx + (rIn + rOut) / 2 * Math.cos((a1 + a2) / 2), labelY: cy + (rIn + rOut) / 2 * Math.sin((a1 + a2) / 2), category: categories[offset + i], index: offset + i });
      }
    };
    if (ring1C > 0) draw(r1, r2, ring1C, floorCount);
    if (ring2C > 0) draw(r3, r4, ring2C, floorCount + ring1C);
  }
  return { sections, stage: { type: 'rect', x: cx - 120, y: 20, width: 240, height: 50, label: '🎸 PREMIUM STAGE' } };
}

const GENERATORS = { stadium: generateStadiumSections, theater: generateTheaterSections, arena: generateArenaSections, rectangle: generateRectangleSections, festival: generateFestivalSections, premium_concert: generatePremiumConcertSections };

function VenueMap({
  layoutType = 'none',
  stagePosition = 'bottom',
  categories = [],
  selectedCategory = null,
  onSelectCategory = null,
  dynamicPrices = {},
  showPrices = false,
  interactive = true,
  compact = false,
}) {
  const { sections, stage } = useMemo(() => {
    const gen = GENERATORS[layoutType];
    if (!gen || categories.length === 0) return { sections: [], stage: null };
    return gen(categories, stagePosition);
  }, [layoutType, stagePosition, categories]);

  if (layoutType === 'none' || !GENERATORS[layoutType] || categories.length === 0) return null;

  const svgW = 600, svgH = layoutType === 'festival' ? 420 : 400;

  return (
    <div style={{ width: '100%', maxWidth: compact ? '500px' : '650px', margin: '0 auto' }}>
      <style>{`
        .vmap-svg { width: 100%; height: auto; background: linear-gradient(135deg, #050914 0%, #10162f 100%); border-radius: 20px; border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 10px 40px rgba(0,0,0,0.5); overflow: visible; }
        .vmap-stage-shape { fill: rgba(255, 255, 255, 0.05); stroke: rgba(255, 255, 255, 0.2); stroke-width: 2; stroke-dasharray: 8 4; }
        .vmap-stage-field { fill: rgba(46, 204, 113, 0.1); stroke: rgba(46, 204, 113, 0.4); stroke-dasharray: none; }
        .vmap-stage-label { fill: #fff; font-size: 14px; font-weight: 800; text-anchor: middle; pointer-events: none; letter-spacing: 2px; opacity: 0.7; }
        .vmap-section-path { opacity: 0.6; stroke: rgba(0, 0, 0, 0.2); stroke-width: 1; transition: all 0.3s ease; }
        .vmap-section-interactive { cursor: pointer; }
        .vmap-section-interactive:hover .vmap-section-path { opacity: 0.9; stroke: #fff; stroke-width: 2; transform: scale(1.02); transform-origin: center; }
        .vmap-section-selected .vmap-section-path { opacity: 1; stroke: #fff; stroke-width: 3; filter: drop-shadow(0 0 10px rgba(255,255,255,0.4)); }
        .vmap-section-sold-out { opacity: 0.2; cursor: not-allowed; pointer-events: none; }
        .vmap-section-label { fill: #000; font-size: 11px; font-weight: 800; text-anchor: middle; pointer-events: none; letter-spacing: 1px; }
        .vmap-section-subtext { fill: rgba(0, 0, 0, 0.7); font-size: 9px; font-weight: 700; text-anchor: middle; pointer-events: none; }
        .vmap-legend { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 1.5rem; }
        .vmap-legend-item { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 20px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); cursor: pointer; transition: all 0.2s; font-size: 11px; }
        .vmap-legend-item:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); }
        .vmap-legend-selected { background: rgba(255,255,255,0.12); border-color: #fff; box-shadow: 0 0 10px rgba(255,255,255,0.1); }
        .vmap-legend-color { width: 12px; height: 12px; border-radius: 3px; }
        .vmap-legend-name { font-weight: 800; color: var(--text-main); }
        .vmap-legend-seats { color: var(--text-dim); font-size: 10px; }
      `}</style>

      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="vmap-svg">
        {stage && (
          <g>
            {stage.type === 'ellipse' ? (
              <ellipse cx={stage.cx} cy={stage.cy} rx={stage.rx} ry={stage.ry} className="vmap-stage-shape vmap-stage-field" />
            ) : (
              <rect x={stage.x} y={stage.y} width={stage.width} height={stage.height} rx="8" ry="8" className="vmap-stage-shape" />
            )}
            <text x={(stage.cx || stage.x + stage.width / 2)} y={(stage.cy || stage.y + stage.height / 2) + 5} className="vmap-stage-label">{stage.label}</text>
          </g>
        )}

        {sections.map((sec, idx) => {
          const cat = sec.category, isSelected = selectedCategory?.name === cat.name, isSoldOut = (cat.availableSeats ?? cat.seats) <= 0;
          return (
            <g key={idx} className={`vmap-section ${isSelected ? 'vmap-section-selected' : ''} ${isSoldOut ? 'vmap-section-sold-out' : ''} ${interactive && !isSoldOut ? 'vmap-section-interactive' : ''}`} onClick={() => !isSoldOut && onSelectCategory?.(cat)}>
              <path d={sec.path} fill={cat.color || DEFAULT_COLORS[sec.index % DEFAULT_COLORS.length]} className="vmap-section-path" />
              <text x={sec.labelX} y={sec.labelY - (showPrices ? 6 : 2)} className="vmap-section-label">{(cat.name || '').toUpperCase()}</text>
              <text x={sec.labelX} y={sec.labelY + 10} className="vmap-section-subtext">
                {isSoldOut ? 'SOLD OUT' : showPrices ? `₹${Math.round(dynamicPrices[cat.name] || cat.price)}` : `${cat.availableSeats ?? cat.seats} SEATS`}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="vmap-legend">
        {categories.map((cat, i) => (
          <div key={i} className={`vmap-legend-item ${selectedCategory?.name === cat.name ? 'vmap-legend-selected' : ''}`} onClick={() => interactive && (cat.availableSeats ?? cat.seats) > 0 && onSelectCategory?.(cat)}>
            <div className="vmap-legend-color" style={{ background: cat.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length] }} />
            <span className="vmap-legend-name">{(cat.name || '').toUpperCase()}</span>
            <span className="vmap-legend-seats">{(cat.availableSeats ?? cat.seats) <= 0 ? 'SOLD OUT' : `${cat.availableSeats ?? cat.seats}/${cat.seats}`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default VenueMap;
