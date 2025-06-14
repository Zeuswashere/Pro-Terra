export default class ErosionWorkerService {
  constructor() {
    this.worker = new Worker(new URL('../workers/erosionWorker.js', import.meta.url));
    this.handlers = {};
    this.worker.onmessage = (e) => {
      const { type } = e.data;
      const handler = this.handlers[type];
      if (handler) handler(e.data);
    };
  }

  init(width, height, heightMap, params, numDroplets) {
    return new Promise((resolve) => {
      this.handlers['initialized'] = () => {
        this.handlers['initialized'] = null;
        resolve();
      };
      this.worker.postMessage({ action: 'init', payload: { width, height, heightMap, params, numDroplets } }, [heightMap.buffer]);
    });
  }

  step(batchSize) {
    return new Promise((resolve) => {
      this.handlers['stepped'] = (data) => {
        this.handlers['stepped'] = null;
        resolve(data);
      };
      this.worker.postMessage({ action: 'step', payload: { batchSize } });
    });
  }

  pause() {
    this.worker.postMessage({ action: 'pause' });
  }

  resume() {
    this.worker.postMessage({ action: 'resume' });
  }

  reset(initialHeightMap) {
    return new Promise((resolve) => {
      this.handlers['reset'] = () => {
        this.handlers['reset'] = null;
        resolve();
      };
      this.worker.postMessage({ action: 'reset', payload: { initialHeightMap } }, [initialHeightMap.buffer]);
    });
  }
} 