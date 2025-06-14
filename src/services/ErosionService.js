import ErosionWorkerService from './ErosionWorkerService.js'; // Assuming path

export const DefaultErosionParams = {
  erosionDroplets: 30000,
  erosionBatchSize: 1000, // Default batch size for the step method
  inertia: 0.1,
  friction: 0.1,
  sedimentCapacityFactor: 1.0,
  depositionRate: 0.1,
  evaporationRate: 0.01,
  minVolume: 0.01,
  initialVolume: 1.0,
  initialSpeed: 1.0,
  maxDropletLifetime: 100,
  // numWorkers is not part of this config, worker service might handle it
};

class ErosionService {
  constructor() {
    this.defaultParams = { ...DefaultErosionParams }; // Initialize from exported const

    this.heightmapData = null;      // Float32Array, current working copy
    this.originalHeightmap = null;  // Float32Array, initial state for reset
    this.width = 0;
    this.height = 0;
    this.currentInternalParams = { ...this.defaultParams }; // Holds merged params from init

    this._isRunning = false;
    this._progress = 0; // 0 to 1, represents fraction of total droplets processed

    this.progressCallback = null;
    this.completeCallback = null;

    if (typeof window !== 'undefined') { // Ensure worker is only created in browser context
        this.workerService = new ErosionWorkerService();
        this.workerService.onmessage = this.handleWorkerMessage.bind(this);
    } else {
        this.workerService = null;
        console.warn("ErosionService: Worker cannot be initialized outside of a browser environment.");
    }
  }

  initialize(heightmap, width, height, params = {}) {
    if (!this.workerService) {
        console.error("ErosionService: Worker not initialized. Cannot proceed.");
        return;
    }
    this.originalHeightmap = new Float32Array(heightmap);
    this.heightmapData = new Float32Array(heightmap);
    this.width = width;
    this.height = height;
    // Merge provided params with defaults, then with any existing internal params
    this.currentInternalParams = { ...this.defaultParams, ...this.currentInternalParams, ...params };

    this._progress = 0;
    this._isRunning = false; // Set to false initially, start() or step() will set it true

    console.log('ErosionService: Initializing worker with dimensions:', width, 'x', height);

    // Prepare payload for worker initialization
    // The worker expects the heightmap buffer to be transferred.
    const initPayload = {
        width: this.width,
        height: this.height,
        heightmap: this.heightmapData.buffer.slice(0), // Send a copy of the buffer
        params: this.currentInternalParams, // Send merged erosion-specific params
        numDroplets: this.currentInternalParams.erosionDroplets
    };

    this.workerService.postMessage(
        { action: 'init', payload: initPayload },
        [initPayload.heightmap] // Transfer the buffer
    );
  }

  start() {
    if (!this.heightmapData || !this.workerService) {
      console.error('ErosionService not initialized or worker not available. Call initialize() first.');
      return;
    }
    if (this._isRunning) {
      console.log('ErosionService: Erosion already running or set to run via steps.');
      return;
    }
    this._isRunning = true;
    // Note: Progress is not reset here, allowing 'start' to resume.
    // If reset is desired, TwoDViewport should call reset() then start().
    console.log('ErosionService: Set to run. Use step() to process droplets.');
    // No direct message to worker, step() will trigger processing.
  }

  step(batchSize) {
    if (!this.heightmapData || !this.workerService) {
      console.error('ErosionService not initialized or worker not available. Call initialize() first.');
      return;
    }
    if (!this._isRunning) { // If paused, calling step will resume it.
        this._isRunning = true;
        console.log('ErosionService: Resuming via step().');
    }

    const currentBatchSize = batchSize || this.currentInternalParams.erosionBatchSize;
    this.workerService.postMessage({
        action: 'step',
        payload: { iterations: currentBatchSize }
    });
  }

  pause() {
    if (!this._isRunning) {
      return;
    }
    this._isRunning = false;
    console.log('ErosionService: Paused. Worker will complete current batch if any.');
    // No explicit message to worker needed if it processes batches atomically.
  }

  reset() {
    if (!this.originalHeightmap || !this.workerService) {
      console.error('ErosionService: No original heightmap to reset to or worker not available.');
      return;
    }

    this.heightmapData = new Float32Array(this.originalHeightmap);
    const prevProgress = this._progress;
    const prevIsRunning = this._isRunning;

    this._progress = 0;
    this._isRunning = false;

    console.log('ErosionService: Resetting erosion state and notifying worker.');
    this.workerService.postMessage({
        action: 'reset',
        payload: { heightmap: this.originalHeightmap.buffer.slice(0) } // Send copy of buffer
    }, [this.originalHeightmap.buffer.slice(0)]); // Transfer buffer

    // Notify UI of reset state if it had changed
    if (this.progressCallback && (prevProgress !== 0 || prevIsRunning)) {
      this.progressCallback(this._progress, new Float32Array(this.heightmapData));
    }
    // It could be argued that onComplete shouldn't be called on reset,
    // but if the UI needs to know the final state is the reset one, it's useful.
    // Or, a specific onReset callback could be introduced.
    // For now, let's assume onComplete signifies a stable (non-eroding) state.
    if (this.completeCallback && (prevProgress !== 0 || prevIsRunning)) {
      this.completeCallback(new Float32Array(this.heightmapData));
    }
  }

  onProgress(callback) {
    if (typeof callback === 'function') {
      this.progressCallback = callback;
    }
  }

  onComplete(callback) {
    if (typeof callback === 'function') {
      this.completeCallback = callback;
    }
  }

  handleWorkerMessage(event) {
    const { type, payload } = event.data;

    switch (type) {
      case 'initDone':
        console.log('ErosionService: Worker initialized.');
        // Optionally trigger any post-init actions or callbacks
        break;
      case 'progressUpdate':
        if (payload.heightMap && this.heightmapData) {
          // Worker sends back the full updated heightmap buffer
          const newHeightmap = new Float32Array(payload.heightMap);
          this.heightmapData.set(newHeightmap);
        }
        this._progress = payload.progress;
        if (this.progressCallback) {
          // Provide a copy to the callback to prevent accidental mutation of internal state
          this.progressCallback(this._progress, new Float32Array(this.heightmapData));
        }
        break;
      case 'erosionComplete':
        if (payload.heightMap && this.heightmapData) {
          const finalHeightmap = new Float32Array(payload.heightMap);
          this.heightmapData.set(finalHeightmap);
        }
        this._isRunning = false;
        this._progress = 1;
        console.log('ErosionService: Erosion completed by worker.');
        if (this.progressCallback) { // Final progress update
            this.progressCallback(this._progress, new Float32Array(this.heightmapData));
        }
        if (this.completeCallback) {
          this.completeCallback(new Float32Array(this.heightmapData));
        }
        break;
      case 'error':
        console.error('ErosionService: Error from worker:', payload.message);
        this._isRunning = false; // Stop on error
        // Optionally, notify via a specific error callback
        break;
      default:
        console.warn('ErosionService: Unknown message type from worker:', type);
    }
  }

  terminate() {
    if (this.workerService) {
      this.workerService.terminate();
      console.log("ErosionService: Worker terminated.");
    }
  }

  isRunning() {
    return this._isRunning;
  }

  getProgress() {
    return this._progress;
  }

  getHeightmap() {
    // Return a copy to prevent external modification of internal state
    return this.heightmapData ? new Float32Array(this.heightmapData) : null;
  }
}

export default ErosionService;
