// ScatterService.js
// Service for generating scatter masks and scatter points for procedural terrain scattering
// Inspired by modern approaches like GeoScatter

// Helper function (will be integrated into the class or remain as a local utility)
function _mulberry32(a) {
  return () => {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Helper function (will be integrated into the class)
function _validateScatterParams(params, required) {
  for (const key of required) {
    if (params[key] === undefined || params[key] === null) {
      throw new Error(`Missing required scatter parameter: ${key}`);
    }
  }
}

// --- Worker-Compatible Pure Functions ---

export const DefaultScatterLayerParams = { // Based on ScatterService constructor's defaultLayerParams
  name: "DefaultScatterLayer",
  enabled: true,
  objectType: "tree_1",
  density: 0.2,
  pointRadius: 5,
  maxSlopeDeg: 30,
  maskThreshold: 0.6,
  scatterOn: "all",
  seed: 0, // Will be replaced by Date.now() or specific seed in constructor/usage
  kAttempts: 30,
  // terrainWidth, terrainHeight, heightmapResolution are usually context-dependent, not part of layer preset
};

export const DefaultGlobalScatterParams = {
  // Example global scatter param:
  // maxTotalScatterObjects: 10000,
  // (Currently no global params are explicitly used by the scatter generation logic itself,
  // but this provides a structure if needed in the future for App.js)
  enabled: true, // A master switch for all scattering perhaps
};


export const generateScatterMaskInternal = (heightmap, width, height, config, terrainTypesEnum) => {
  // config should contain: maskThreshold, scatterOn
  // terrainTypesEnum is the TERRAIN_TYPES object
  _validateScatterParams({ heightmap, width, height, config, terrainTypesEnum }, ['heightmap', 'width', 'height', 'config', 'terrainTypesEnum']);
  _validateScatterParams(config, ['maskThreshold', 'scatterOn']);


  const { maskThreshold, scatterOn } = config;
  const mask = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        mask[i] = 0;
        continue;
      }

      const hNorm = heightmap[i];
      let inMask = false;
      switch (scatterOn) {
        case terrainTypesEnum.MOUNTAIN:
          inMask = hNorm > maskThreshold;
          break;
        case terrainTypesEnum.VALLEY:
          inMask = hNorm < (maskThreshold * 0.5);
          break;
        case terrainTypesEnum.PLAIN:
          inMask = hNorm >= (maskThreshold * 0.5) && hNorm <= (maskThreshold * 1.2);
          break;
        case terrainTypesEnum.ALL:
        default:
          inMask = hNorm >= maskThreshold;
          break;
      }
      mask[i] = inMask ? 1 : 0;
    }
  }
  return mask;
};

export const generatePoissonScatterPointsInternal = (
  mask, mapWidth, mapHeight, heightmap,
  config // Expects: density, seed, pointRadius, maxSlopeDeg, kAttempts, terrainWidth, terrainHeight
) => {
  _validateScatterParams({ mask, mapWidth, mapHeight, heightmap, config }, ['mask', 'mapWidth', 'mapHeight', 'heightmap', 'config']);
  _validateScatterParams(config, ['density', 'seed', 'pointRadius', 'maxSlopeDeg', 'kAttempts', 'terrainWidth', 'terrainHeight']);

  const {
    density, seed, pointRadius, maxSlopeDeg, kAttempts,
    terrainWidth, terrainHeight,
  } = config;

  const minDist = Math.max(1, pointRadius);
  const cellSize = minDist / Math.SQRT2;
  const gridW = Math.ceil(mapWidth / cellSize);
  const gridH = Math.ceil(mapHeight / cellSize);
  const gridData = Array.from({ length: gridW * gridH }, () => null);
  const points = [];
  const active = [];
  const rng = _mulberry32(seed);

  const dxWorld = terrainWidth / (mapWidth > 1 ? mapWidth - 1 : 1);
  const dyWorld = terrainHeight / (mapHeight > 1 ? mapHeight - 1 : 1);

  function getGridIdx(x, y) {
    return Math.floor(x / cellSize) + Math.floor(y / cellSize) * gridW;
  }

  function getSlopeAndNormalAt(xGrid, yGrid) {
      const x = Math.floor(xGrid);
      const y = Math.floor(yGrid);

      if (x <= 0 || x >= mapWidth -1 || y <= 0 || y >= mapHeight -1) {
          return { slope: 90, normal: {x:0, y:1, z:0} };
      }

      const hC = heightmap[y * mapWidth + x];
      const hL = heightmap[y * mapWidth + (x - 1)];
      const hR = heightmap[y * mapWidth + (x + 1)];
      const hD = heightmap[(y + 1) * mapWidth + x];
      const hU = heightmap[(y - 1) * mapWidth + x];

      const dz_dx = (hR - hL) / (2 * dxWorld);
      const dz_dy = (hD - hU) / (2 * dyWorld);

      const normalVec = { x: -dz_dx, y: 1, z: -dz_dy };
      const len = Math.sqrt(normalVec.x * normalVec.x + normalVec.y * normalVec.y + normalVec.z * normalVec.z);
      if (len > 0) {
          normalVec.x /= len; normalVec.y /= len; normalVec.z /= len;
      }
      const slopeRad = Math.acos(Math.min(1, Math.max(-1, normalVec.y)));
      const slopeDegVal = slopeRad * (180 / Math.PI);
      return { slope: slopeDegVal, normal: normalVec };
  }

  function isValidCandidate(candX, candY) {
    if (candX < 0 || candX >= mapWidth || candY < 0 || candY >= mapHeight) return false;
    const maskIndex = Math.floor(candY) * mapWidth + Math.floor(candX);
    if (mask[maskIndex] !== 1) return false;
    const { slope } = getSlopeAndNormalAt(candX, candY);
    if (slope > maxSlopeDeg) return false;
    const gx = Math.floor(candX / cellSize);
    const gy = Math.floor(candY / cellSize);
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        const ngx = gx + i;
        const ngy = gy + j;
        if (ngx >= 0 && ngx < gridW && ngy >= 0 && ngy < gridH) {
          const neighborCellIdx = ngx + ngy * gridW;
          const ptInCell = gridData[neighborCellIdx];
          if (ptInCell) {
            const dxPt = ptInCell.x - candX;
            const dyPt = ptInCell.y - candY;
            if (dxPt * dxPt + dyPt * dyPt < minDist * minDist) return false;
          }
        }
      }
    }
    return true;
  }

  for (let yGrid = 0; yGrid < mapHeight; yGrid++) {
      for (let xGrid = 0; xGrid < mapWidth; xGrid++) {
          if (mask[yGrid * mapWidth + xGrid] === 1 && rng() < (density * 0.1)) {
               if (isValidCandidate(xGrid, yGrid)) {
                  const { slope, normal } = getSlopeAndNormalAt(xGrid, yGrid);
                  const zValue = heightmap[yGrid * mapWidth + xGrid];
                  const p = { x: xGrid, y: yGrid, z: zValue, normal, slope };
                  active.push(p);
                  gridData[getGridIdx(xGrid, yGrid)] = p;
                  points.push(p);
               }
          }
      }
  }
  if (active.length === 0) {
      let attempts = 0;
      while(attempts < Math.max(100, mapWidth * mapHeight * 0.01) && active.length === 0) {
          const x0 = rng() * mapWidth;
          const y0 = rng() * mapHeight;
          if (isValidCandidate(x0,y0)) {
              const { slope, normal } = getSlopeAndNormalAt(x0, y0);
              const zValue = heightmap[Math.floor(y0) * mapWidth + Math.floor(x0)];
              const p = { x: x0, y: y0, z: zValue, normal, slope };
              active.push(p);
              gridData[getGridIdx(x0,y0)] = p;
              points.push(p);
          }
          attempts++;
      }
  }

  while (active.length > 0) {
    const randomIdx = Math.floor(rng() * active.length);
    const centerPt = active[randomIdx];
    let foundCandidate = false;
    for (let i = 0; i < kAttempts; i++) {
      const angle = rng() * 2 * Math.PI;
      const r = minDist * (1 + rng());
      const candX = centerPt.x + Math.cos(angle) * r;
      const candY = centerPt.y + Math.sin(angle) * r;
      if (isValidCandidate(candX, candY)) {
        const { slope, normal } = getSlopeAndNormalAt(candX, candY);
        const zValue = heightmap[Math.floor(candY) * mapWidth + Math.floor(candX)];
        const newPt = { x: candX, y: candY, z: zValue, normal, slope };
        points.push(newPt);
        active.push(newPt);
        gridData[getGridIdx(candX, candY)] = newPt;
        foundCandidate = true;
        break;
      }
    }
    if (!foundCandidate) active.splice(randomIdx, 1);
  }
  return points.map(p => ({
      x: Math.round(p.x), y: Math.round(p.y), z: p.z, normal: p.normal, slope: p.slope
  }));
};

export const generateScatterLayerPointsInternal = (
  heightmapArray, mapGridWidth, mapGridHeight,
  terrainWorldProps, // { worldWidth, worldDepth }
  layerConfig, // This should be the fully resolved layer config
  terrainTypesEnum // The TERRAIN_TYPES map
) => {
  _validateScatterParams(terrainWorldProps, ['worldWidth', 'worldDepth']);

  const mask = generateScatterMaskInternal(
    heightmapArray, mapGridWidth, mapGridHeight,
    { maskThreshold: layerConfig.maskThreshold, scatterOn: layerConfig.scatterOn },
    terrainTypesEnum
  );

  const points = generatePoissonScatterPointsInternal(
    mask, mapGridWidth, mapGridHeight, heightmapArray,
    {
      density: layerConfig.density,
      seed: layerConfig.seed, // noiseSeedForLayer is layerConfig.seed
      pointRadius: layerConfig.pointRadius,
      maxSlopeDeg: layerConfig.maxSlopeDeg,
      kAttempts: layerConfig.kAttempts || 30, // Ensure kAttempts is provided
      terrainWidth: terrainWorldProps.worldWidth,
      terrainHeight: terrainWorldProps.worldDepth,
    }
  );
  return points;
};


class ScatterService {
  constructor() {
    // Instance uses a deep copy of the exported default for its own base defaultLayerParams
    this.defaultLayerParams = JSON.parse(JSON.stringify(DefaultScatterLayerParams));
    // Overwrite seed with a dynamic one for the instance if needed, or let users set it.
    this.defaultLayerParams.seed = Date.now();

    // These might also be needed if they vary per instance or are configurable globally for the service
    this.defaultLayerParams.terrainWidth = 1000;
    this.defaultLayerParams.terrainHeight = 1000;
    this.defaultLayerParams.heightmapResolution = 512;


    this.TERRAIN_TYPES = {
      ALL: 'all',
      MOUNTAIN: 'mountain',
      VALLEY: 'valley',
      PLAIN: 'plain',
    };
  }

  /**
   * Generates a scatter mask based on the heightmap and layer parameters.
   * @param {Float32Array} heightmap - The heightmap data (flattened array).
   * @param {number} width - Width of the heightmap (resolution).
   * @param {number} height - Height of the heightmap (resolution).
   * @param {object} layerConfig - Scatter layer parameters, overrides defaults.
   * @returns {Uint8Array} - Binary mask (1 = scatter, 0 = no scatter).
   */
  generateScatterMask(heightmap, width, height, layerConfig = {}) {
    const effectiveConfig = { ...this.defaultLayerParams, ...layerConfig };
    // Pass necessary params from effectiveConfig and this.TERRAIN_TYPES to the internal function
    return generateScatterMaskInternal(
      heightmap,
      width,
      height,
      { // Pass only needed params to internal function's config
        maskThreshold: effectiveConfig.maskThreshold,
        scatterOn: effectiveConfig.scatterOn
      },
      this.TERRAIN_TYPES
    );
  }

  /**
   * Generates scatter points using Bridson's Poisson Disk Sampling.
   * @param {Uint8Array} mask - Binary mask (1 = scatter, 0 = no scatter).
   * @param {number} mapWidth - Width of the mask (heightmap resolution).
   * @param {number} mapHeight - Height of the mask (heightmap resolution).
   * @param {Float32Array} heightmap - Heightmap data (flattened, world heights).
   * @param {object} layerConfig - Scatter layer parameters.
   * @returns {Array<{x: number, y: number, z: number, normal: {x,y,z}, slope: number}>} - Array of scatter points.
   */
  generatePoissonScatterPoints(mask, mapWidth, mapHeight, heightmap, layerConfig = {}) {
    const effectiveConfig = { ...this.defaultLayerParams, ...layerConfig };

    return generatePoissonScatterPointsInternal(
      mask, mapWidth, mapHeight, heightmap,
      { // Pass only necessary parameters to the internal function
        density: effectiveConfig.density,
        seed: effectiveConfig.seed,
        pointRadius: effectiveConfig.pointRadius,
        maxSlopeDeg: effectiveConfig.maxSlopeDeg,
        kAttempts: effectiveConfig.kAttempts,
        terrainWidth: effectiveConfig.terrainWidth,
        terrainHeight: effectiveConfig.terrainHeight,
      }
    );
  }

  /**
   * Main method to generate scatter points for a given layer configuration.
   * Assumes heightmap contains world heights.
   * @param {Float32Array} heightmap - The heightmap data (flattened, world heights).
   * @param {number} mapWidthRes - Width of the heightmap (resolution).
   * @param {number} mapHeightRes - Height of the heightmap (resolution).
   * @param {object} terrainParams - Parameters of the terrain (e.g., worldWidth, worldHeight/Depth, heightScale).
   *                                 Example: { worldWidth: 1000, worldDepth: 1000, minHeight: 0, maxHeight: 200 }
   * @param {object} layerConfig - Specific configuration for this scatter layer.
   * @returns {Array<{x: number, y: number, z: number, normal: {x,y,z}, slope: number}>} - Array of scatter points.
   */
  generateScatterLayer(heightmap, mapWidthRes, mapHeightRes, terrainParams, layerConfig) {
    _validateScatterParams(
        { heightmap, mapWidthRes, mapHeightRes, terrainParams, layerConfig },
        ['heightmap', 'mapWidthRes', 'mapHeightRes', 'terrainParams', 'layerConfig']
    );
    _validateScatterParams(terrainParams, ['worldWidth', 'worldDepth']);


    // Effective config combines defaults, layer-specific, and actual terrain dimensions
    const effectiveConfig = {
        ...this.defaultLayerParams,
        ...layerConfig,
        // Ensure terrainWidth/Height from terrainParams override any defaults for actual world dimensions
        terrainWidth: terrainParams.worldWidth,
        terrainHeight: terrainParams.worldDepth,
        heightmapResolution: mapWidthRes,
    };

    const points = generateScatterLayerPointsInternal(
      heightmap,
      mapWidthRes,
      mapHeightRes,
      { worldWidth: effectiveConfig.terrainWidth, worldDepth: effectiveConfig.terrainHeight },
      effectiveConfig, // Pass the fully resolved layer config
      this.TERRAIN_TYPES
    );

    console.log(`ScatterService: Generated ${points.length} points for layer "${effectiveConfig.name}".`);
    return points;
  }

  /**
   * GLSL snippet for scatter mask generation (for use in shaders if needed)
   * @returns {string}
   */
  static getScatterMaskGLSL() {
    return `
    // height: normalized height (0-1)
    // maskThreshold: uniform float
    // scatterOn: int (0=all, 1=mountain, 2=valley, 3=plain)
    // TERRAIN_TYPES_MOUNTAIN = 1, etc. (needs to match JS)
    bool checkScatterMask(float height, float maskThreshold, int scatterOnValue) {
      if (scatterOnValue == 1) return height > maskThreshold; // MOUNTAIN
      if (scatterOnValue == 2) return height < maskThreshold * 0.5; // VALLEY
      if (scatterOnValue == 3) return height >= maskThreshold * 0.5 && height <= maskThreshold * 1.2; // PLAIN
      // ALL (0) or default
      return height >= maskThreshold;
    }
    `;
  }
}

export default ScatterService;