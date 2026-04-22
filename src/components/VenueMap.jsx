import React, { useMemo } from 'react';
import './VenueMap.css';

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

// ── Availability color overlay ────────────────────────────────────────────
function getAvailabilityClass(cat) {
  if (!cat) return '';
  const avail = cat.availableSeats ?? cat.seats;
  const total = cat.seats || 1;
  const ratio = avail / total;
  if (avail <= 0) return 'section-sold-out';
  if (ratio <= 0.15) return 'section-critical';
  if (ratio <= 0.4) return 'section-low';
  return 'section-available';
}

// ── SVG Geometry generators ───────────────────────────────────────────────

function generateStadiumSections(categories, stagePos) {
  const cx = 300, cy = 200;
  const fieldRx = 100, fieldRy = 60;
  const n = categories.length;
  if (n === 0) return { sections: [], stage: null };

  const sections = [];
  const startAngle = stagePos === 'top' ? Math.PI : 0;
  const totalAngle = 2 * Math.PI;
  const gap = 0.04; // gap between sections in radians

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
    const path = [
      `M ${ix1} ${iy1}`,
      `A ${innerR.x} ${innerR.y} 0 ${largeArc} 1 ${ix2} ${iy2}`,
      `L ${ox2} ${oy2}`,
      `A ${outerR.x} ${outerR.y} 0 ${largeArc} 0 ${ox1} ${oy1}`,
      'Z'
    ].join(' ');

    const midA = (a1 + a2) / 2;
    const labelR = { x: (innerR.x + outerR.x) / 2, y: (innerR.y + outerR.y) / 2 };
    sections.push({
      path,
      labelX: cx + labelR.x * Math.cos(midA),
      labelY: cy + labelR.y * Math.sin(midA),
      category: cat,
      index: i,
    });
  });

  const stage = {
    type: 'ellipse',
    cx, cy,
    rx: fieldRx, ry: fieldRy,
    label: '⚽ FIELD',
  };

  return { sections, stage };
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
    const topW = x2 - x1;
    const botW = topW + 12;
    const botX1 = (w - botW) / 2;

    const path = [
      `M ${x1} ${y}`,
      `L ${x2} ${y}`,
      `L ${botX1 + botW} ${y + sectionH}`,
      `L ${botX1} ${y + sectionH}`,
      'Z'
    ].join(' ');

    sections.push({
      path,
      labelX: w / 2,
      labelY: y + sectionH / 2,
      category: cat,
      index: i,
    });
  });

  // Position stage according to stagePos
  let stageY = margin;
  if (stagePos === 'bottom') stageY = 400 - margin - stageH;
  else if (stagePos === 'center') stageY = Math.max(margin, (400 - stageH) / 2 - 10);

  const stage = {
    type: 'rect',
    x: margin + 30, y: stageY,
    width: w - margin * 2 - 60, height: stageH,
    label: '🎭 STAGE',
  };

  return { sections, stage };
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
  else if (stagePos === 'center') stageY = Math.max(10, (h - stageH) / 2 - 10);

  // Distribute: left side, center, right side
  const sideCount = Math.floor(n / 3);
  const centerCount = n - sideCount * 2;

  // Center sections (below stage)
  const centerY = stageY + stageH + 15;
  const centerH = Math.min(60, 180 / Math.max(centerCount, 1));
  for (let i = 0; i < centerCount; i++) {
    const y = centerY + i * (centerH + 6);
    const taper = i * 15;
    sections.push({
      path: `M ${stageX - 20 - taper} ${y} L ${stageX + stageW + 20 + taper} ${y} L ${stageX + stageW + 20 + taper} ${y + centerH} L ${stageX - 20 - taper} ${y + centerH} Z`,
      labelX: w / 2,
      labelY: y + centerH / 2,
      category: categories[i],
      index: i,
    });
  }

  // Left sections
  const sideTop = stageY + 10;
  const sideH = (h - sideTop - 40) / Math.max(sideCount, 1);
  for (let i = 0; i < sideCount; i++) {
    const y = sideTop + i * sideH;
    const catIdx = centerCount + i;
    sections.push({
      path: `M 20 ${y} L ${stageX - 35} ${y} L ${stageX - 35} ${y + sideH - 5} L 20 ${y + sideH - 5} Z`,
      labelX: (20 + stageX - 35) / 2,
      labelY: y + (sideH - 5) / 2,
      category: categories[catIdx],
      index: catIdx,
    });
  }

  // Right sections
  for (let i = 0; i < sideCount; i++) {
    const y = sideTop + i * sideH;
    const catIdx = centerCount + sideCount + i;
    if (catIdx >= n) break;
    sections.push({
      path: `M ${stageX + stageW + 35} ${y} L ${w - 20} ${y} L ${w - 20} ${y + sideH - 5} L ${stageX + stageW + 35} ${y + sideH - 5} Z`,
      labelX: (stageX + stageW + 35 + w - 20) / 2,
      labelY: y + (sideH - 5) / 2,
      category: categories[catIdx],
      index: catIdx,
    });
  }

  const stage = {
    type: 'rect',
    x: stageX, y: stageY,
    width: stageW, height: stageH,
    label: '🎤 STAGE',
  };

  return { sections, stage };
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

    sections.push({
      path: `M ${x} ${y} L ${x + secW} ${y} L ${x + secW} ${y + secH} L ${x} ${y + secH} Z`,
      labelX: x + secW / 2,
      labelY: y + secH / 2,
      category: cat,
      index: i,
    });
  });

  let stageY = margin;
  if (stagePos === 'bottom') stageY = 400 - margin - stageH;
  else if (stagePos === 'center') stageY = Math.max(margin, (400 - stageH) / 2 - 10);

  const stage = {
    type: 'rect',
    x: margin + 60, y: stageY,
    width: areaW - 120, height: stageH,
    label: '🏢 STAGE / PODIUM',
  };

  return { sections, stage };
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

    const path = [
      `M ${ix1} ${iy1}`,
      `A ${rInner} ${rInner} 0 0 0 ${ix2} ${iy2}`,
      `L ${ox2} ${oy2}`,
      `A ${rOuter} ${rOuter} 0 0 1 ${ox1} ${oy1}`,
      'Z'
    ].join(' ');

    const midA = (startA + endA) / 2;
    const midR = (rInner + rOuter) / 2;

    sections.push({
      path,
      labelX: cx + midR * Math.cos(midA),
      labelY: cy - midR * Math.sin(midA),
      category: cat,
      index: i,
    });
  });

  // adjust festival stage vertical position
  let stageY = 15;
  if (stagePos === 'bottom') stageY = 420 - 15 - 35;
  else if (stagePos === 'center') stageY = Math.max(15, (420 - 35) / 2 - 10);

  const stage = {
    type: 'rect',
    x: cx - 60, y: stageY,
    width: 120, height: 35,
    label: '🎪 STAGE',
  };

  return { sections, stage };
}

function generatePremiumConcertSections(categories, stagePos) {
  const cx = 300;
  const cy = 150; // Focal point for rings
  const w = 600, h = 420;
  const stageW = 240, stageH = 50;
  const n = categories.length;
  if (n === 0) return { sections: [], stage: null };

  const sections = [];
  
  // Base Distribution
  const floorCount = Math.max(1, Math.ceil(n * 0.5));
  const ringCount = n - floorCount;
  
  // 1. Plot the Ground Floor Grid Matrix
  const cols = Math.ceil(Math.sqrt(floorCount * 1.5));
  const rows = Math.ceil(floorCount / cols);
  
  const gap = 8;
  const floorW = 320;
  const floorH = 140;
  const boxW = (floorW - (cols - 1) * gap) / cols;
  const boxH = (floorH - (rows - 1) * gap) / rows;
  const startY = 90;

  for (let i = 0; i < floorCount; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const curCols = (r === rows - 1 && floorCount % cols !== 0) ? floorCount % cols : cols;
    const startX = cx - (curCols * boxW + (curCols - 1) * gap) / 2;
    
    const x = startX + c * (boxW + gap);
    const y = startY + r * (boxH + gap);
    
    sections.push({
      path: `M ${x} ${y} L ${x + boxW} ${y} L ${x + boxW} ${y + boxH} L ${x} ${y + boxH} Z`,
      labelX: x + boxW / 2,
      labelY: y + boxH / 2,
      category: categories[i],
      index: i,
    });
  }

  // 2. Plot the Outer Tiered Rings
  if (ringCount > 0) {
    const ring1Count = Math.ceil(ringCount / 2);
    const ring2Count = ringCount - ring1Count;
    
    const drawWedge = (rIn, rOut, a1, a2, idxOffset, count, catArrayIdx) => {
      for (let i = 0; i < count; i++) {
        const startRad = a1 + (a2 - a1) * (i / count);
        const endRad = a1 + (a2 - a1) * ((i + 1) / count) - 0.03;
        
        const ix1 = cx + rIn * Math.cos(startRad);
        const iy1 = cy + rIn * Math.sin(startRad);
        const ix2 = cx + rIn * Math.cos(endRad);
        const iy2 = cy + rIn * Math.sin(endRad);
        
        const ox1 = cx + rOut * Math.cos(startRad);
        const oy1 = cy + rOut * Math.sin(startRad);
        const ox2 = cx + rOut * Math.cos(endRad);
        const oy2 = cy + rOut * Math.sin(endRad);
        
        const path = `M ${ix1} ${iy1} A ${rIn} ${rIn} 0 0 1 ${ix2} ${iy2} L ${ox2} ${oy2} A ${rOut} ${rOut} 0 0 0 ${ox1} ${oy1} Z`;
        
        const midR = (rIn + rOut) / 2;
        const midA = (startRad + endRad) / 2;
        
        sections.push({
          path,
          labelX: cx + midR * Math.cos(midA),
          labelY: cy + midR * Math.sin(midA),
          category: categories[catArrayIdx + i],
          index: catArrayIdx + i,
        });
      }
    };
    
    const arcLeft = Math.PI - 0.2;
    const arcRight = 0.2; 
    
    if (ring1Count > 0) drawWedge(160, 200, arcLeft, arcRight, 0, ring1Count, floorCount);
    if (ring2Count > 0) drawWedge(210, 255, arcLeft + 0.1, arcRight - 0.1, 0, ring2Count, floorCount + ring1Count);
  }

  let stageY = 20;
  if (stagePos === 'bottom') stageY = 420 - 20 - stageH;
  else if (stagePos === 'center') stageY = Math.max(20, (420 - stageH) / 2 - 10);

  const stage = {
    type: 'rect',
    x: cx - stageW / 2, y: stageY,
    width: stageW, height: stageH,
    label: '🎸 PREMIUM STAGE',
  };

  return { sections, stage };
}

// ── Layout generator map ──────────────────────────────────────────────────
const GENERATORS = {
  stadium: generateStadiumSections,
  theater: generateTheaterSections,
  arena: generateArenaSections,
  rectangle: generateRectangleSections,
  festival: generateFestivalSections,
  premium_concert: generatePremiumConcertSections,
};

// ── VenueMap Component ────────────────────────────────────────────────────
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

  if (layoutType === 'none' || !GENERATORS[layoutType] || categories.length === 0) {
    return null;
  }

  const svgW = 600;
  const svgH = layoutType === 'festival' ? 420 : 400;

  return (
    <div className={`venue-map-container ${compact ? 'venue-map-compact' : ''}`}>
      <svg
        viewBox={`0 0 ${svgW} ${svgH}`}
        className="venue-map-svg"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background */}
        <defs>
          <filter id="sectionGlow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Stage / Field */}
        {stage && stage.type === 'ellipse' && (
          <g className="venue-stage">
            <ellipse
              cx={stage.cx} cy={stage.cy}
              rx={stage.rx} ry={stage.ry}
              className="stage-shape stage-field"
            />
            <text x={stage.cx} y={stage.cy + 5} className="stage-label">
              {stage.label}
            </text>
          </g>
        )}
        {stage && stage.type === 'rect' && (
          <g className="venue-stage">
            <rect
              x={stage.x} y={stage.y}
              width={stage.width} height={stage.height}
              rx="8" ry="8"
              className="stage-shape"
            />
            <text x={stage.x + stage.width / 2} y={stage.y + stage.height / 2 + 5} className="stage-label">
              {stage.label}
            </text>
          </g>
        )}

        {/* Sections */}
        {sections.map((sec, idx) => {
          const cat = sec.category;
          const color = cat.color || DEFAULT_COLORS[sec.index % DEFAULT_COLORS.length];
          const isSelected = selectedCategory && (
            selectedCategory.name === cat.name || selectedCategory._id === cat._id
          );
          const availClass = getAvailabilityClass(cat);
          const isSoldOut = (cat.availableSeats ?? cat.seats) <= 0;
          const dprice = dynamicPrices[cat.name];
          const displayPrice = dprice || cat.price;

          return (
            <g
              key={idx}
              className={`venue-section ${availClass} ${isSelected ? 'section-selected' : ''} ${interactive && !isSoldOut ? 'section-interactive' : ''}`}
              onClick={() => {
                if (interactive && !isSoldOut && onSelectCategory) {
                  onSelectCategory(cat);
                }
              }}
            >
              <path
                d={sec.path}
                fill={color}
                className="section-path"
                filter={isSelected ? 'url(#sectionGlow)' : undefined}
              />
              {/* Section label */}
              <text x={sec.labelX} y={sec.labelY - (showPrices ? 8 : 2)} className="section-name">
                {(cat.name || '').toUpperCase()}
              </text>
              {showPrices && (
                <text x={sec.labelX} y={sec.labelY + 10} className="section-price">
                  {isSoldOut ? 'SOLD OUT' : `₹${Math.round(displayPrice)}`}
                </text>
              )}
              {!showPrices && (
                <text x={sec.labelX} y={sec.labelY + 12} className="section-seats">
                  {isSoldOut ? 'SOLD OUT' : `${cat.availableSeats ?? cat.seats} seats`}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="venue-map-legend">
        {categories.map((cat, i) => {
          const color = cat.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
          const avail = cat.availableSeats ?? cat.seats;
          return (
            <div
              key={i}
              className={`legend-item ${selectedCategory?.name === cat.name ? 'legend-selected' : ''}`}
              onClick={() => interactive && avail > 0 && onSelectCategory && onSelectCategory(cat)}
            >
              <span className="legend-color" style={{ background: color }} />
              <span className="legend-name">{(cat.name || '').toUpperCase()}</span>
              <span className="legend-seats">
                {avail <= 0 ? 'Sold Out' : `${avail}/${cat.seats}`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VenueMap;
