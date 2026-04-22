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
  
  categories.forEach((cat, index) => {
     let risk = 20; // Base intrinsic risk
     
     // 1. Capacity Density Risk
     if (cat.seats > 500) risk += 30;
     else if (cat.seats > 200) risk += 20;
     else if (cat.seats > 100) risk += 10;
     
     // 2. Topological/GNN Distance Risk (Proximity to chokepoints & stage)
     if (layoutType === 'stadium') {
         // Entirely enclosed; front and rear entries create squeeze points
         if (index === 0 || index === Math.floor(categories.length / 2)) risk += 35;
         else risk += 10; // Moderate ring density
     } else if (layoutType === 'arena') {
         // U-shape wraps; center and immediate stage-adjacent wings crowd easily
         if (index === 0) risk += 45; // Center block
         else if (index === 1 || index === Math.ceil(categories.length / 2)) risk += 25;
     } else if (layoutType === 'theater') {
         // Funneling effect towards main lower exits
         if (index === 0) risk += 40; // Front stalls
         else if (index === 1) risk += 20;
     } else if (layoutType === 'festival') {
         // Concentric circles: inner circle takes massive physical crush damage
         if (index === 0) risk += 60; // GA Pit
         else if (index === 1) risk += 30;
     }

     // 3. Dynamic Architectural Constraints (Physical Venue Metrics)
     if (venueMetrics.exitsCount) {
         if (venueMetrics.exitsCount <= 2) risk += 30; // Severe bottleneck
         else if (venueMetrics.exitsCount <= 4) risk += 10;
         else if (venueMetrics.exitsCount >= 10) risk -= 15; // Smooth escape
     }
     
     if (venueMetrics.aisleWidth === 'narrow') {
         risk += 25; // High crush damage in tight corridors
     } else if (venueMetrics.aisleWidth === 'wide') {
         risk -= 10;
     }

     if (venueMetrics.securitySpeed === 'slow') {
         risk += 15; // Backing up flow to inner rings
     } else if (venueMetrics.securitySpeed === 'fast') {
         risk -= 5;
     }

     // 4. Fluctuation Noise (Simulate organic variance)
     risk += Math.floor(Math.random() * 10) - 5; 
     
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

  // Match the SeatGrid columns architecture logic to find the exact seat IDs
  const cols = totalSeats > 100 ? 20 : totalSeats > 50 ? 15 : 10;
  
  const blocks = [];
  
  // Block Row A (crush zone / front barrier)
  for (let c = 1; c <= cols; c++) {
    if (c > totalSeats) break;
    blocks.push(`A${c}`);
  }
  
  // If extreme risk (> 85), also expand the boundary buffer by blocking row B
  if (riskScore >= 85) {
    for (let c = 1; c <= cols; c++) {
      if (cols + c > totalSeats) break;
      blocks.push(`B${c}`);
    }
  }

  // If the sides are narrow, block the aisle seats in Row C and D (simulate path clearing)
  if (riskScore >= 70 && totalSeats > cols * 3) {
      blocks.push(`C1`, `C${cols}`);
      if (totalSeats > cols * 4) {
         blocks.push(`D1`, `D${cols}`);
      }
  }
  
  return blocks;
}
