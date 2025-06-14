// import ErosionWorkerService from './ErosionWorkerService'; // Assuming this will be the path

class ErosionService {
  constructor() {
    this.defaultParams = {
      erosionDroplets: 30000,
      erosionBatchSize: 1000,
      inertia: 0.1,
      friction: 0.1,
      sedimentCapacityFactor: 1.0,
      depositionRate: 0.1,
      evaporationRate: 0.01,
      minVolume: 0.01,
      initialVolume: 1.0,
      initialSpeed: 1.0,
      maxDropletLifetime: 100,
      // Parameters for worker communication or internal state
      numWorkers: 4, // Example: default number of workers
    };

    this.heightmapData = null;
    this.originalHeightmap = null;
    this.width = 0;
    this.height = 0;
    this.params = { ...this.defaultParams };

    this._isRunning = false;
    this._progress = 0; // 0 to 1

    this.progressSubscribers = [];
    this.completeSubscribers = [];

    // this.workerService = new ErosionWorkerService(); // Or some initialization logic
    // For now, worker interaction methods will be stubs.
  }

  initialize(heightmap, width, height, params = {}) {
    this.originalHeightmap = new Float32Array(heightmap); // Store a copy
    this.heightmapData = new Float32Array(heightmap); // Current working copy
    this.width = width;
    this.height = height;
    this.params = { ...this.defaultParams, ...params };
    this._progress = 0;
    this._isRunning = false;

    console.log('ErosionService initialized with dimensions:', width, 'x', height);
    // TODO: Initialize worker service with heightmap and params
    // this.workerService.initialize(this.heightmapData, this.width, this.height, this.params);
  }

  start() {
    if (this._isRunning) {
      console.log('Erosion already running.');
      return;
    }
    if (!this.heightmapData) {
      console.error('ErosionService not initialized. Call initialize() first.');
      return;
    }
    this._isRunning = true;
    this._progress = 0;
    console.log('Erosion started.');
    // TODO: Start erosion process in worker
    // this.workerService.startErosion();
    // For now, simulate some progress for testing
    this.simulateProgress();
  }

  step(batchSize) {
    if (!this._isRunning) {
      // Allow stepping even if not "running" full simulation, e.g. for manual control
      if (!this.heightmapData) {
        console.error('ErosionService not initialized. Call initialize() first.');
        return;
      }
       this._isRunning = true; // Mark as running if stepping manually
    }
    const currentBatchSize = batchSize || this.params.erosionBatchSize;
    console.log(`Erosion step with batch size: ${currentBatchSize}`);
    // TODO: Tell worker to process a batch
    // this.workerService.processBatch(currentBatchSize).then(erodedHeightmap => {
    //   this.heightmapData.set(erodedHeightmap);
    //   this._progress = this.workerService.getProgress(); // Assuming worker tracks overall progress
    //   this.notifyProgress();
    //   if (this._progress >= 1) {
    //     this.handleCompletion();
    //   }
    // });
  }

  pause() {
    if (!this._isRunning) {
      console.log('Erosion not running.');
      return;
    }
    this._isRunning = false;
    console.log('Erosion paused.');
    // TODO: Pause erosion process in worker
    // this.workerService.pauseErosion();
  }

  reset(originalHeightmap) {
    const mapToReset = originalHeightmap || this.originalHeightmap;
    if (!mapToReset) {
      console.error('No original heightmap available to reset to.');
      return;
    }
    this.heightmapData = new Float32Array(mapToReset);
    this._progress = 0;
    this._isRunning = false;
    console.log('Erosion reset to original heightmap.');
    this.notifyProgress(); // Notify that progress is back to 0
    // TODO: Reset worker state
    // this.workerService.reset(this.heightmapData);
  }

  onProgress(callback) {
    if (typeof callback === 'function') {
      this.progressSubscribers.push(callback);
    }
  }

  onComplete(callback) {
    if (typeof callback === 'function') {
      this.completeSubscribers.push(callback);
    }
  }

  notifyProgress() {
    this.progressSubscribers.forEach(cb => cb(this._progress, this.heightmapData));
  }

  notifyComplete() {
    this.completeSubscribers.forEach(cb => cb(this.heightmapData));
  }

  handleCompletion() {
    this._isRunning = false;
    this._progress = 1;
    this.notifyProgress(); // Final progress update
    this.notifyComplete();
    console.log('Erosion completed.');
  }

  isRunning() {
    return this._isRunning;
  }

  getProgress() {
    return this._progress;
  }

  getHeightmap() {
    return this.heightmapData;
  }

  // --- Helper for simulation without actual worker ---
  simulateProgress() {
    if (!this._isRunning) return;

    // Simulate work being done in batches
    const totalDroplets = this.params.erosionDroplets;
    let processedDroplets = Math.floor(this._progress * totalDroplets);

    const intervalId = setInterval(() => {
      if (!this._isRunning) {
        clearInterval(intervalId);
        return;
      }

      processedDroplets += this.params.erosionBatchSize;
      this._progress = Math.min(1, processedDroplets / totalDroplets);

      // Simulate heightmap modification (e.g., slightly lower everything)
      if (this.heightmapData) {
        for(let i=0; i < this.heightmapData.length; i++) {
            // this.heightmapData[i] *= (1 - (0.001 * (this.params.erosionBatchSize / totalDroplets)));
        }
      }

      this.notifyProgress();

      if (this._progress >= 1) {
        clearInterval(intervalId);
        this.handleCompletion();
      }
    }, 100); // Simulate batch processing time
  }
}

export default ErosionService;
