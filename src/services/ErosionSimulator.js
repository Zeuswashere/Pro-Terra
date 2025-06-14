/**
 * ErosionSimulator: Hydraulic erosion simulation for heightfields.
 * Supports batch updates and bilinear mass transfer for smooth results.
 */
export default class ErosionSimulator {
  /**
   * @param {number} width - Grid width.
   * @param {number} height - Grid height.
   * @param {Float32Array} heightMap - Initial heights (row-major).
   * @param {Object} params - Physical parameters (inertia, friction, etc.).
   */
  constructor(width, height, heightMap, params = {}) {
    this.width = width;
    this.height = height;
    this.heightMap = new Float32Array(heightMap);
    this.params = Object.assign({
      inertia: 0.05,           // Droplet inertia [0..1]
      friction: 0.02,          // Velocity loss per step
      sedimentCapacityFactor: 4, // Multiplier on capacity
      depositionRate: 0.3,     // How quickly sediment is deposited/eroded
      evaporationRate: 0.01,   // Water evaporation rate per step
      minVolume: 0.01,         // Volume below which droplet disappears
      initialVolume: 1.0,      // Starting water volume of each droplet
      initialSpeed: 1.0,       // Starting speed (not strictly needed)
      maxDropletLifetime: 30,  // Max steps per droplet
      slopeMapFactor: 0.001    // weight for slope influence
    }, params);
  }

  /**
   * Initialize persistent droplet state for progressive simulation.
   */
  resetDroplets(numDroplets) {
    this.droplets = [];
    for (let i = 0; i < numDroplets; i++) {
      this.droplets.push(this._createDroplet());
    }
    this.dropletsActive = true;
  }

  /**
   * Create a new droplet with random position and initial state.
   */
  _createDroplet() {
    return {
      x: Math.random() * (this.width - 2) + 1, // avoid edges
      y: Math.random() * (this.height - 2) + 1,
      dx: 0,
      dy: 0,
      speed: this.params.initialSpeed,
      water: this.params.initialVolume,
      sediment: 0,
      lifetime: 0,
      alive: true
    };
  }

  /**
   * Step all droplets for a batch (progressive, continuous, float positions).
   * @param {number} batchSize - Number of droplets to step this batch.
   * @param {function(Float32Array):void} onStep - Callback after batch.
   * @returns {boolean} - True if droplets remain, false if all finished.
   */
  stepDroplets(batchSize, onStep = null) {
    const { width, height, heightMap, params } = this;
    let activeCount = 0;
    for (let i = 0; i < this.droplets.length && activeCount < batchSize; i++) {
      const d = this.droplets[i];
      if (!d.alive) continue;
      activeCount++;
      for (let step = 0; step < 1; step++) { // 1 step per batch per droplet
        // Bilinear height and gradient
        const cellX = Math.floor(d.x);
        const cellY = Math.floor(d.y);
        const offX = d.x - cellX;
        const offY = d.y - cellY;
        // Height at droplet position
        const h = this._bilinearInterp(heightMap, d.x, d.y);
        // Gradient (central differences via bilinear)
        const grad = this._calcGradient(heightMap, d.x, d.y);
        // Update velocity (inertia vs. downslope)
        d.dx = d.dx * params.inertia - grad.gx * (1 - params.inertia);
        d.dy = d.dy * params.inertia - grad.gy * (1 - params.inertia);
        // Normalize velocity
        const len = Math.sqrt(d.dx * d.dx + d.dy * d.dy);
        if (len !== 0) {
          d.dx /= len;
          d.dy /= len;
        }
        // Move droplet
        d.x += d.dx;
        d.y += d.dy;
        // Clamp to bounds
        if (d.x < 1 || d.x > width - 2 || d.y < 1 || d.y > height - 2) {
          d.alive = false;
          continue;
        }
        // New height and delta
        const newH = this._bilinearInterp(heightMap, d.x, d.y);
        const deltaH = newH - h;
        // Update speed (gravity, friction)
        d.speed = Math.sqrt(Math.max(0, d.speed * d.speed + deltaH * -9.81));
        d.speed *= (1 - params.friction);
        // Base capacity
        let capacity = Math.max(-deltaH, 0.01) * d.speed * d.water * params.sedimentCapacityFactor;
        // // Factor in precomputed slope (if provided) to boost capacity on steeper slopes
        // if (this.slopeMap) {
        //   const idx2 = cellY * width + cellX;
        //   const rawSlope = this.slopeMap[idx2] || 0;
        //   const clampedSlope = Math.min(rawSlope, 1);
        //   capacity *= 1 + clampedSlope * this.params.slopeMapFactor;
        // }
        // // Factor in flow accumulation (more erosion where water concentrates)
        // if (this.flowMap) {
        //   const idx2 = cellY * width + cellX;
        //   const flowFactor = this.flowMap[idx2] || 0;
        //   capacity *= 1 + flowFactor;
        // }
        // // Factor in curvature (encourage erosion in concave areas)
        // if (this.curvatureMap) {
        //   const idx2 = cellY * width + cellX;
        //   const curv = this.curvatureMap[idx2] || 0;
        //   capacity *= 1 + Math.abs(curv);
        // }
        // Erode or deposit
        if (d.sediment > capacity) {
          // Deposit
          const deposit = (d.sediment - capacity) * params.depositionRate;
          this._bilinearAdd(heightMap, cellX, cellY, offX, offY, deposit);
          d.sediment -= deposit;
        } else {
          // Erode
          const erode = Math.min((capacity - d.sediment) * params.depositionRate, newH);
          if (erode > 0) {
            this._bilinearAdd(heightMap, cellX, cellY, offX, offY, -erode);
            d.sediment += erode;
          }
        }
        // Evaporate
        d.water *= (1 - params.evaporationRate);
        d.lifetime++;
        // Kill droplet if too little water, too slow, or too old
        if (d.water < params.minVolume || d.lifetime > params.maxDropletLifetime || d.speed < 0.01) {
          d.alive = false;
        }
      }
    }
    if (onStep) onStep(new Float32Array(heightMap));
    // Return true if any droplets are still alive
    return this.droplets.some(d => d.alive);
  }

  /**
   * Bilinear interpolation of height at (x, y).
   */
  _bilinearInterp(heightMap, x, y) {
    const width = this.width;
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    const offX = x - cellX;
    const offY = y - cellY;
    const toIndex = (x, y) => y * width + x;
    if (cellX < 0 || cellY < 0 || cellX >= width - 1 || cellY >= this.height - 1) return 0;
    const h00 = heightMap[toIndex(cellX, cellY)];
    const h10 = heightMap[toIndex(cellX + 1, cellY)];
    const h01 = heightMap[toIndex(cellX, cellY + 1)];
    const h11 = heightMap[toIndex(cellX + 1, cellY + 1)];
    return h00 * (1 - offX) * (1 - offY) + h10 * offX * (1 - offY) + h01 * (1 - offX) * offY + h11 * offX * offY;
  }

  /**
   * Calculate gradient (gx, gy) at (x, y) using bilinear interpolation.
   */
  _calcGradient(heightMap, x, y) {
    const width = this.width;
    const cellX = Math.floor(x);
    const cellY = Math.floor(y);
    const offX = x - cellX;
    const offY = y - cellY;
    const toIndex = (x, y) => y * width + x;
    if (cellX < 1 || cellY < 1 || cellX >= width - 2 || cellY >= this.height - 2) return { gx: 0, gy: 0 };
    // Central differences
    const hL = this._bilinearInterp(heightMap, x - 1, y);
    const hR = this._bilinearInterp(heightMap, x + 1, y);
    const hD = this._bilinearInterp(heightMap, x, y - 1);
    const hU = this._bilinearInterp(heightMap, x, y + 1);
    return { gx: (hR - hL) * 0.5, gy: (hU - hD) * 0.5 };
  }

  /**
   * Start a new erosion simulation (reset droplets and optionally heightmap).
   * @param {number} numDroplets
   * @param {boolean} resetHeightmap
   */
  start(numDroplets, resetHeightmap = false, initialHeightMap = null) {
    if (resetHeightmap && initialHeightMap) {
      this.heightMap = new Float32Array(initialHeightMap);
    }
    this.resetDroplets(numDroplets);
  }

  /**
   * Pause the simulation (droplets and heightmap are preserved).
   */
  pause() {
    this.dropletsActive = false;
  }

  /**
   * Resume the simulation (droplets and heightmap are preserved).
   */
  resume() {
    this.dropletsActive = true;
  }

  /**
   * Bilinearly add value (positive or negative) to the 4 corners of a cell.
   * @private
   */
  _bilinearAdd(heightMap, x, y, offX, offY, value) {
    const w00 = (1 - offX) * (1 - offY);
    const w10 = offX * (1 - offY);
    const w01 = (1 - offX) * offY;
    const w11 = offX * offY;
    const width = this.width;
    const toIndex = (x, y) => y * width + x;
    if (x >= 0 && y >= 0 && x < width-1 && y < this.height-1) {
      heightMap[toIndex(x, y)] += value * w00;
      heightMap[toIndex(x+1, y)] += value * w10;
      heightMap[toIndex(x, y+1)] += value * w01;
      heightMap[toIndex(x+1, y+1)] += value * w11;
      // Clamp to zero
      heightMap[toIndex(x, y)] = Math.max(0, heightMap[toIndex(x, y)]);
      heightMap[toIndex(x+1, y)] = Math.max(0, heightMap[toIndex(x+1, y)]);
      heightMap[toIndex(x, y+1)] = Math.max(0, heightMap[toIndex(x, y+1)]);
      heightMap[toIndex(x+1, y+1)] = Math.max(0, heightMap[toIndex(x+1, y+1)]);
    }
  }

  /**
   * Returns the minimum height among the 4 bilinear corners (for erosion clamp).
   * @private
   */
  _bilinearMin(heightMap, x, y, offX, offY) {
    const width = this.width;
    const toIndex = (x, y) => y * width + x;
    if (x >= 0 && y >= 0 && x < width-1 && y < this.height-1) {
      return Math.min(
        heightMap[toIndex(x, y)],
        heightMap[toIndex(x+1, y)],
        heightMap[toIndex(x, y+1)],
        heightMap[toIndex(x+1, y+1)]
      );
    }
    return 0;
  }

  /**
   * Returns a clone of the current heightmap.
   */
  cloneHeightMap() {
    return new Float32Array(this.heightMap);
  }

  /**
   * Resets the heightmap to the provided data.
   * @param {Float32Array} newHeightMap
   */
  resetHeightMap(newHeightMap) {
    this.heightMap = new Float32Array(newHeightMap);
  }

  /**
   * Optionally, set a deterministic random seed for reproducibility.
   */
  static setSeed(seed) {
    // Simple LCG for reproducibility (optional, not used by default)
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    Math.random = function() {
      return (s = s * 16807 % 2147483647) / 2147483647;
    };
  }
} 