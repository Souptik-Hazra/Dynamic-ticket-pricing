/**
 * CrowdSimulator.js
 * 
 * Simulates a Graph Neural Network (GNN) density algorithm. 
 * Calculates safety/crowd risk scores per section based on topology constraints,
 * capacity limits, and phase-distance from the stage.
 */

export function simulateCrowdSafety(categories, layoutType, stagePosition, venueMetrics = {}) {
  const scores = {};
  
  if (!categories || categories.length === 0) return scores;
  // Create deterministic seed from the input so identical inputs yield identical scores
  const seedSource = JSON.stringify({ categories: categories.map(c => ({ name: c.name, seats: c.seats })), layoutType, stagePosition, venueMetrics });
  function hashStringToInt(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
  }

  // mulberry32 PRNG
  function mulberry32(a) {
  return function() {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  }

  const baseSeed = hashStringToInt(seedSource);

  categories.forEach((cat, index) => {
   const rng = mulberry32(baseSeed + index);
   let risk = 20; // Base intrinsic risk

   // 1. Capacity Density Risk
   if (cat.seats > 500) risk += 30;
   else if (cat.seats > 200) risk += 20;
   else if (cat.seats > 100) risk += 10;

   // 2. Topological/GNN Distance Risk (Proximity to chokepoints & stage)
   if (layoutType === 'stadium') {
     if (index === 0 || index === Math.floor(categories.length / 2)) risk += 35;
     else risk += 10;
   } else if (layoutType === 'arena') {
     if (index === 0) risk += 45;
     else if (index === 1 || index === Math.ceil(categories.length / 2)) risk += 25;
   } else if (layoutType === 'theater') {
     if (index === 0) risk += 40;
     else if (index === 1) risk += 20;
   } else if (layoutType === 'festival') {
     if (index === 0) risk += 60;
     else if (index === 1) risk += 30;
   }

   // 3. Dynamic Architectural Constraints (Physical Venue Metrics)
   if (venueMetrics.exitsCount) {
     if (venueMetrics.exitsCount <= 2) risk += 30;
     else if (venueMetrics.exitsCount <= 4) risk += 10;
     else if (venueMetrics.exitsCount >= 10) risk -= 15;
   }

   if (venueMetrics.aisleWidth === 'narrow') {
     risk += 25;
   } else if (venueMetrics.aisleWidth === 'wide') {
     risk -= 10;
   }

   if (venueMetrics.securitySpeed === 'slow') {
     risk += 15;
   } else if (venueMetrics.securitySpeed === 'fast') {
     risk -= 5;
   }

   // 4. Deterministic Fluctuation Noise (based on seeded PRNG)
   const noise = Math.floor(rng() * 10) - 5; // -5 .. +4
   risk += noise;

   // Normalize to 0-100
   scores[cat.name] = Math.min(100, Math.max(0, risk));
  });
  
  return scores;
}

export function generateAutoBlockSeats(category, riskScore) {
  // Only auto-block if risk is considered 'High' meaning > 60
  if (riskScore < 60) return [];

  const totalSeats = category.seats || 0;
  if (!totalSeats) return [];

  // Determine grid dimensions used by SeatGrid
  const cols = totalSeats > 100 ? 20 : totalSeats > 50 ? 15 : 10;
  const rows = Math.ceil(totalSeats / cols);

  // Map of row letters
  const rowLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  // Build list of seat ids in row-major order
  const seatIds = [];
  for (let r = 0; r < rows; r++) {
    const rowLetter = rowLetters[r] || `R${r+1}`;
    for (let c = 1; c <= cols; c++) {
      const idx = r * cols + (c - 1);
      if (idx >= totalSeats) break;
      seatIds.push(`${rowLetter}${c}`);
    }
  }

  const existingBlocked = new Set(Array.isArray(category.blockedSeats) ? category.blockedSeats : []);
  const existingBooked = new Set(Array.isArray(category.bookedSeats) ? category.bookedSeats : []);

  // Candidate seats exclude already blocked/booked seats
  const candidates = seatIds.filter(id => !existingBlocked.has(id) && !existingBooked.has(id));
  if (candidates.length === 0) return [];

  // Map risk to proportion of seats to block (deterministic, bounded)
  const minBlockRatio = 0.03; // 3%
  const maxBlockRatio = 0.25; // 25%
  const norm = Math.max(0, Math.min(1, (riskScore - 60) / 40)); // 0 @60, 1 @100
  const ratio = minBlockRatio + (maxBlockRatio - minBlockRatio) * norm;
  const blockCount = Math.max(1, Math.round(totalSeats * ratio));

  // Spacing radius (Manhattan-like). Higher risk => larger spacing.
  const spacing = 1 + Math.floor((riskScore - 60) / 15); // 60-74 =>1, 75-89=>2, 90+=>3

  // Deterministic PRNG for shuffling
  function hashStringToInt(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(a) {
    return function() {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  const seed = hashStringToInt(`${category.name}|${totalSeats}|${Math.round(riskScore)}`);
  const rng = mulberry32(seed);

  // Helper to compute (row,col) from seatId like 'C12'
  function parseSeat(id) {
    const m = id.match(/^([A-Z]+)(\d+)$/i);
    if (!m) return null;
    const row = m[1].toUpperCase();
    const col = parseInt(m[2], 10);
    const rIndex = rowLetters.indexOf(row);
    const r = rIndex >= 0 ? rIndex : null;
    return { id, r, c: col };
  }

  // Build coordinate map for quick neighbor checks
  const coord = {};
  seatIds.forEach(s => {
    const p = parseSeat(s);
    coord[s] = p;
  });

  // Deterministic shuffle of candidates
  const shuffled = candidates.slice().sort((a, b) => {
    // derive a pseudo-random number per id using rng seeded and id hash
    const ha = hashStringToInt(a + '|' + seed);
    const hb = hashStringToInt(b + '|' + seed);
    return (ha >>> 0) - (hb >>> 0);
  });

  // Greedy maximal independent set selection with spacing constraint
  const selected = new Set();
  const blockedSet = new Set(); // for quick neighbor lookup

  function neighborsWithin(sid, radius) {
    const p = coord[sid];
    if (!p || p.r === null) return [];
    const res = [];
    for (let rr = Math.max(0, p.r - radius); rr <= Math.min(rows - 1, p.r + radius); rr++) {
      for (let cc = Math.max(1, p.c - radius); cc <= Math.min(cols, p.c + radius); cc++) {
        const candidateId = `${rowLetters[rr] || ('R'+(rr+1))}${cc}`;
        if (candidateId !== sid && coord[candidateId]) res.push(candidateId);
      }
    }
    return res;
  }

  for (let i = 0; i < shuffled.length && selected.size < blockCount; i++) {
    const sid = shuffled[i];
    if (blockedSet.has(sid)) continue; // already excluded
    // ensure none of neighbors are already selected
    const neigh = neighborsWithin(sid, spacing);
    let conflict = false;
    for (const n of neigh) {
      if (selected.has(n)) { conflict = true; break; }
    }
    if (!conflict) {
      selected.add(sid);
      // mark neighbors as blocked from selection
      neigh.forEach(n => blockedSet.add(n));
    }
  }

  return Array.from(selected);
}
