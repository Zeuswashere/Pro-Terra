import * as THREE from 'three';
import { Noise } from 'noisejs';
import Alea from 'alea';
import WorleyNoise from 'worley-noise';

// Default parameters related to noise and terrain shape
const defaultParams = {
  octaves: 6,
  ridgedOffset: 0.5,
  gain: 0.5,
  lacunarity: 2.0,
  amplitude: 1.0,
  domainWarpStrength: 0.35,
  domainWarpFreq: 0.08,
  frequency: 0.15,
  worleyPoints: 1024, // Default based on meshResolution * 2, assuming meshResolution = 512
  worleySeed: 0, // Default to params.seed
  worleyDimension: 2,
  windDirection: Math.PI / 4,
  // Parameters that were part of generateTerrain's direct logic, but might be useful as defaults
  meshResolution: 512,
  size: 1000, // Default world extent if width/height not provided
  applySmoothing: true, // Default for enabling smoothing
  smoothIterations: 1, // Default smoothing iterations
  smoothFactor: 0.5, // Default smoothing factor
};

export const createImprovedNoise2D = (seed) => {
  const prng = Alea(seed);

  return (x, y, frequency = 1.0) => {
    const scaledFreq = Math.pow(frequency, 0.85);
    // This implementation of prng() seems to be a placeholder or incomplete.
    // A typical noise function would use x, y, and scaledFreq.
    // For now, retaining the original logic.
    return prng();
  };
};

// Helper to clamp values to [0, 1]
export function clamp01Internal(v) { return Math.max(0, Math.min(1, v)); }

export const applySmoothingInternal = (vertexPositions, mapWidth, mapHeight, smoothingParams) => {
  // Expects vertexPositions to be a Float32Array of [x1,y1,z1, x2,y2,z2, ...]
  // Modifies vertexPositions in place.
  const tempPositionsZ = new Float32Array(vertexPositions.length / 3);
  for(let i=0; i < vertexPositions.length / 3; i++) {
    tempPositionsZ[i] = vertexPositions[i*3+2];
  }

  const smoothKernel = [
    {x: -1, y: -1, weight: 0.5}, {x: 0, y: -1, weight: 1}, {x: 1, y: -1, weight: 0.5},
    {x: -1, y: 0, weight: 1}, {x: 1, y: 0, weight: 1},
    {x: -1, y: 1, weight: 0.5}, {x: 0, y: 1, weight: 1}, {x: 1, y: 1, weight: 0.5}
  ];
  // const kernelWeight = 6; // This was unused after refactor of smoothing logic

  const iterations = smoothingParams.smoothIterations || defaultParams.smoothIterations;
  const factor = smoothingParams.smoothFactor || defaultParams.smoothFactor;
  const kernelWeightTotal = 6; // sum of weights in smoothKernel if all neighbors are valid (1*4 + 0.5*4 = 6)

  for (let iter = 0; iter < iterations; iter++) {
    const currentPassZ = new Float32Array(tempPositionsZ); // Use Z values from previous pass or initial

    for (let i = 0; i < tempPositionsZ.length; i++) {
      const x = i % mapWidth;
      const y = Math.floor(i / mapWidth);

      let sum = currentPassZ[i] * kernelWeightTotal; // Center point
      let totalWeight = kernelWeightTotal;

      for (const {x: dx, y: dy, weight} of smoothKernel) {
        const nx = x + dx;
        const ny = y + dy;

        if (nx >= 0 && nx < mapWidth && ny >= 0 && ny < mapHeight) {
          const nIdx = ny * mapWidth + nx;
          sum += currentPassZ[nIdx] * weight;
          totalWeight += weight;
        }
      }
      // It seems the original kernelWeight was meant to be the weight of the central pixel itself,
      // and totalWeight would sum this with neighbor weights.
      // The above logic seems to double count the center pixel if kernelWeightTotal is the sum of neighbors.
      // Let's adjust:
      // Corrected logic:
      let currentSum = currentPassZ[i]; // Start with the current pixel's value
      let currentTotalWeight = 1; // Weight for the current pixel itself

      for (const {x: dx, y: dy, weight} of smoothKernel) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < mapWidth && ny >= 0 && ny < mapHeight) {
          const nIdx = ny * mapWidth + nx;
          currentSum += currentPassZ[nIdx] * weight;
          currentTotalWeight += weight;
        }
      }
      const avg = currentSum / currentTotalWeight;
      tempPositionsZ[i] = THREE.MathUtils.lerp(currentPassZ[i], avg, factor);
    }
  }
  // Apply smoothed Z values back to the original vertexPositions array
  for(let i=0; i < vertexPositions.length / 3; i++) {
    vertexPositions[i*3+2] = tempPositionsZ[i];
  }
  // No return, modifies vertexPositions in place
};

export const createWorleyPointsInternal = (count, seed) => {
  const points = [];
  const prngWorley = Alea(seed);
  for (let i = 0; i < count; i++) {
    points.push({
      x: prngWorley(),
      y: prngWorley()
    });
  }
  return points;
};


// Renamed from createImprovedNoise2D to avoid conflict if original is kept for compatibility
export const createImprovedNoise2DInternal = (seed) => {
  const prng = Alea(seed);
  // This returned function should ideally use x, y, and frequency
  // to generate noise. The current prng() call just returns a sequence of random numbers.
  return (x, y, frequency = 1.0) => {
    // const scaledFreq = Math.pow(frequency, 0.85); // Example of using frequency
    return prng(); // Placeholder: uses PRNG but not spatial coordinates
  };
};


export const generateTerrainInternal = (params) => {
  // Merge with default params - ensure this happens correctly if called from worker
  // For worker, it's better if `params` comes fully resolved.
  const effectiveParams = { ...defaultParams, ...params };

  const worldSize = effectiveParams.size; // Assuming square terrain for simplicity in noise mapping
  const meshResolution = effectiveParams.meshResolution;

  const gridWidth = meshResolution + 1;
  const gridHeight = meshResolution + 1;

  const prngSeed = Alea(effectiveParams.seed);
  const baseNoise = new Noise(prngSeed());
  function simplex2(x, y) { return baseNoise.simplex2(x, y); }
  function perlin2(x, y) { return baseNoise.perlin2(x, y); }

  const numWorleyPoints = Math.max(128, Math.min(4096, Math.floor(effectiveParams.worleyPoints)));
  let worleyInstance;

  try {
    const worleySeedActual = effectiveParams.worleySeed !== 0 ? effectiveParams.worleySeed : effectiveParams.seed;
    const worleyPointsArray = createWorleyPointsInternal(numWorleyPoints, worleySeedActual);

    worleyInstance = new WorleyNoise({
      numPoints: worleyPointsArray.length,
      seed: Math.floor(worleySeedActual),
      dim: effectiveParams.worleyDimension
    });
    worleyPointsArray.forEach(point => worleyInstance.addPoint(point));
    if (!worleyInstance.points || worleyInstance.points.length === 0) {
      throw new Error('Failed to initialize Worley noise points');
    }
  } catch (error) {
    console.error('Worker: Failed to initialize Worley noise:', error.message);
    // Fallback Worley if initialization fails
    const worleySeedFallback = effectiveParams.worleySeed !== 0 ? effectiveParams.worleySeed : effectiveParams.seed;
    const fallbackPoints = createWorleyPointsInternal(numWorleyPoints, worleySeedFallback);
    worleyInstance = { // Simplified fallback, actual WorleyNoise object might be complex to mock
      points: fallbackPoints,
      getEuclidean: (p) => {
        let minDist = Infinity;
        fallbackPoints.forEach(point => {
          const dx = p.x - point.x;
          const dy = p.y - point.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          minDist = Math.min(minDist, dist);
        });
        return minDist;
      }
    };
  }

  const {
    windDirection, octaves, ridgedOffset, gain, lacunarity,
    amplitude, domainWarpStrength, domainWarpFreq, frequency: initialFrequency,
    applySmoothing, smoothIterations, smoothFactor
  } = effectiveParams;

  const dirX = Math.cos(windDirection);
  const dirY = Math.sin(windDirection);

  const heightmapArray = new Float32Array(gridWidth * gridHeight);
  const vertexPositionsForSmoothing = new Float32Array(gridWidth * gridHeight * 3); // For applySmoothingInternal

  for (let iy = 0; iy < gridHeight; iy++) {
    for (let ix = 0; ix < gridWidth; ix++) {
      const worldX = (ix / (gridWidth - 1) - 0.5) * worldSize;
      const worldY = (iy / (gridHeight - 1) - 0.5) * worldSize; // This is world Z for noise sampling

      let h = 0;
      let currentAmp = 1;
      let currentFreq = initialFrequency;

      for (let o = 0; o < octaves; o++) {
        const warpNoiseFreq = domainWarpFreq * Math.pow(lacunarity, o);
        const warpNoiseAmp = domainWarpStrength * currentAmp;

        const warpOffsetX = simplex2(worldX * warpNoiseFreq, worldY * warpNoiseFreq) * warpNoiseAmp * dirX;
        const warpOffsetY = simplex2(worldX * warpNoiseFreq + 100, worldY * warpNoiseFreq + 100) * warpNoiseAmp * dirY;

        const warpedX = worldX + warpOffsetX;
        const warpedY = worldY + warpOffsetY;

        let vSimplex = simplex2(warpedX * currentFreq, warpedY * currentFreq);
        let vPerlin = perlin2(warpedX * currentFreq, warpedY * currentFreq);

        const normX = clamp01Internal(warpedX / worldSize + 0.5);
        const normY = clamp01Internal(warpedY / worldSize + 0.5);
        let vWorley = worleyInstance.getEuclidean({ x: normX, y: normY }, 1); // Get F1 value
        vWorley = 1.0 - 2.0 * vWorley; // Invert and scale to -1 to 1 range

        vSimplex = ridgedOffset - Math.abs(vSimplex); vSimplex *= vSimplex;
        vPerlin = ridgedOffset - Math.abs(vPerlin); vPerlin *= vPerlin;
        vWorley = ridgedOffset - Math.abs(vWorley); vWorley *= vWorley;

        let v = (vSimplex + vPerlin + vWorley) / 3;

        const microDetail = simplex2(warpedX * currentFreq * 4, warpedY * currentFreq * 4) * 0.1;
        v += microDetail;

        h += v * currentAmp;
        currentAmp *= gain;
        currentFreq *= lacunarity;
      }
      const valueIndex = iy * gridWidth + ix;
      heightmapArray[valueIndex] = h * amplitude;

      // Store for smoothing (X, Y are grid coords, Z is height)
      vertexPositionsForSmoothing[valueIndex * 3 + 0] = ix;
      vertexPositionsForSmoothing[valueIndex * 3 + 1] = iy;
      vertexPositionsForSmoothing[valueIndex * 3 + 2] = heightmapArray[valueIndex];
    }
  }

  // Edge blending (modifies vertexPositionsForSmoothing's Z values)
  // This was originally done on PlaneGeometry vertices after height application.
  // Replicating it here based on grid coordinates.
  for (let iy = 0; iy < gridHeight; iy++) {
    for (let ix = 0; ix < gridWidth; ix++) {
        const margin = 1; // Blend within 1 unit of the edge
        const edgeDistX = Math.min(ix, gridWidth - 1 - ix);
        const edgeDistY = Math.min(iy, gridHeight - 1 - iy);
        const edgeDist = Math.min(edgeDistX, edgeDistY);

        if (edgeDist < margin) {
            const t = edgeDist / margin;
            const valueIndex = iy * gridWidth + ix;
            vertexPositionsForSmoothing[valueIndex * 3 + 2] *= t;
        }
    }
  }

  if (applySmoothing) {
    applySmoothingInternal(vertexPositionsForSmoothing, gridWidth, gridHeight,
      { smoothIterations, smoothFactor }
    );
  }

  // Extract final Z values from vertexPositionsForSmoothing back to heightmapArray
  for (let i = 0; i < gridWidth * gridHeight; i++) {
    heightmapArray[i] = vertexPositionsForSmoothing[i * 3 + 2];
  }

  return { heightmap: heightmapArray, width: gridWidth, height: gridHeight };
};


// Original exported functions can be kept for compatibility if needed,
// or they can now call the *Internal versions.
// For this refactor, we assume App.js and other consumers will eventually use the *Internal versions via workers,
// or call a main thread orchestrator that uses these.

export const createImprovedNoise2D = createImprovedNoise2DInternal; // Alias for now

// The main generateTerrain export can now use the internal version
// and if it needs to return geometry (as before), it can construct it here.
// However, the task asks generateTerrainInternal to return the heightmap array.
// So, the original generateTerrain is effectively replaced by generateTerrainInternal's signature.
export const generateTerrain = (params) => {
    // This function is now primarily for main-thread use if geometry is directly needed.
    // For worker, generateTerrainInternal is used.
    // If generateTerrain is still called expecting geometry:
    const { heightmap, width, height } = generateTerrainInternal(params);

    // Reconstruct geometry if this function's old signature must be maintained
    const worldSize = params.size || defaultParams.size;
    const meshResolution = params.meshResolution || defaultParams.meshResolution;
    const geometry = new THREE.PlaneGeometry(worldSize, worldSize, meshResolution, meshResolution);
    const positions = geometry.attributes.position.array;

    if (positions.length / 3 !== heightmap.length) {
        console.warn("Heightmap length mismatch with geometry positions. Ensure meshResolution matches.");
        // Fallback: just return raw data if geometry can't be reliably populated.
        return { heightmap, width, height, geometry: null };
    }

    for (let i = 0; i < heightmap.length; i++) {
        positions[i * 3 + 2] = heightmap[i];
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    return { geometry, heightmap, width, height }; // Also return heightmap data
};


export { defaultParams as HeightmapDefaultParams };
