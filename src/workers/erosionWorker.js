import ErosionSimulator from '../services/ErosionSimulator';
import { computeSlopeMap, computeCurvatureMap, computeFlowMap } from '../services/HeightfieldService';

let simulator = null;

self.onmessage = (e) => {
  const { action, payload } = e.data;
  switch(action) {
    case 'init': {
      const { width, height, heightMap, params, numDroplets } = payload;
      // Compute slope, curvature, and flow maps using universal service
      const slopeMap = computeSlopeMap(heightMap, width, height, params.size, params.size);
      const curvatureMap = computeCurvatureMap(heightMap, width, height, params.size, params.size);
      const flowMap = computeFlowMap(heightMap, width, height);
      simulator = new ErosionSimulator(width, height, heightMap, params);
      simulator.slopeMap = slopeMap;
      simulator.curvatureMap = curvatureMap;
      simulator.flowMap = flowMap;
      simulator.start(numDroplets);
      self.postMessage({ type: 'initialized' });
      break;
    }
    case 'step': {
      const { batchSize } = payload;
      const alive = simulator.stepDroplets(batchSize);
      const heightClone = simulator.cloneHeightMap();
      self.postMessage({ type: 'stepped', alive, heightMap: heightClone }, [heightClone.buffer]);
      break;
    }
    case 'pause': {
      simulator.pause();
      self.postMessage({ type: 'paused' });
      break;
    }
    case 'resume': {
      simulator.resume();
      self.postMessage({ type: 'resumed' });
      break;
    }
    case 'reset': {
      const { initialHeightMap } = payload;
      simulator.resetHeightMap(initialHeightMap);
      self.postMessage({ type: 'reset' });
      break;
    }
    default:
      console.warn('ErosionWorker: Unknown action', action);
  }
}; 