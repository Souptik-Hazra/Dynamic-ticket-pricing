/**
 * TemporalSpeedBump
 * 
 * Part of the "Non-Parallelizable Temporal Queue" (NPTQ) component of DECPG.
 * Forces a mathematical delay (VDF-style) to neutralize bot-speed advantages.
 */
export const solveTemporalPuzzle = async (challenge, difficulty = 2000) => {
  console.log("⏱️ Starting Temporal Proof of Work (VDF)...");
  const startTime = Date.now();
  
  let result = challenge;
  const encoder = new TextEncoder();

  // Sequential hashing (Non-parallelizable loop)
  // Optimization: We use a more direct loop and fewer intermediate string conversions
  for (let i = 0; i < difficulty; i++) {
    const data = encoder.encode(result + i);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    
    // Fast hex conversion
    const hashArray = new Uint8Array(hashBuffer);
    let hashHex = '';
    for (let j = 0; j < hashArray.length; j++) {
      hashHex += hashArray[j].toString(16).padStart(2, '0');
    }
    result = hashHex;
    
    // Log progress occasionally (less frequent to reduce UI thread blocking)
    if (i % 500 === 0) {
      console.log(`⏳ Proof progress: ${((i / difficulty) * 100).toFixed(0)}%`);
    }
  }

  const endTime = Date.now();
  console.log(`✅ Temporal Proof Completed in ${endTime - startTime}ms`);
  
  return {
    proof: result,
    duration: endTime - startTime,
    difficulty
  };
};
