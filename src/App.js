// Constants for camera, helpers, and shadow
const CAMERA_POSITION = [15, 15, 15];
const CAMERA_FOV = 50;
const GRID_HELPER_ARGS = [20, 20, '#444', '#222'];
const AXES_HELPER_ARGS = [5];

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import SettingsPanel from './components/SettingsPanel';
import PresetPanel from './components/PresetPanel';
import { createImprovedNoise2D, generateTerrain } from './services/TerrainGeneratorService';
import { createTexturedTerrainMaterial, createWaterPlane } from './services/TerrainMaterialService';
import usePersistentState from './hooks/usePersistentState';
import Water from './components/Water';
import { generateScatterMask, generatePoissonScatterPoints } from './services/ScatterService';
import BillboardTree, { InstancedBillboardTrees } from './components/BillboardTree';
import InstancedGrassClumps from './components/InstancedGrassClumps';
import * as THREE from 'three';
import ErosionWorkerService from './services/ErosionWorkerService';
import TerrainWorkerService from './services/TerrainWorkerService';

// Default parameters
const defaultParams = {
  size: 10,
  meshResolution: 128,
  
  // Multi-layered noise parameters
  amplitude: 1.0, // Height Range
  octaves: 6,
  lacunarity: 2.0,
  gain: 0.5,
  seed: Math.random() * 1000,
  
  // Worley noise parameters
  worleyPoints: 256,
  worleySeed: Math.random() * 1000,
  worleyWeight: 0.5,
  worleyDimension: 2,
  
  // Ridged noise
  ridged: false,
  ridgedOffset: 0.5,
  
  // Domain warping
  useDomainWarp: true,
  warpType: 'fractal',
  warpStrength: 0.5,
  warpFrequency: 0.02,
  warpIterations: 3,
  
  // Water
  waterLevel: 0.0,
  
  // Smoothing
  applySmoothing: false,
  smoothIterations: 1,
  smoothFactor: 0.5,
  
  // Procedural texturing
  heightScale: 0.5,
  rockHeight: 0.6,
  moistureScale: 0.8,
  moistureNoiseScale: 0.05,
  terrainBlendSharpness: 1.5,
  
  // Water parameters
  enableWater: false,
  
  // Texture resolution
  textureResolution: 1.0,
  
  // Enhanced texturing
  gravelIntensity: 0.5,
  gravelScale: 12.0,
  sedimentCurvatureIntensity: 0.5,

  // Texture maps and advanced texturing
  albedoMapUrl: '',
  normalMapUrl: '',
  roughnessMapUrl: '',
  displacementMapUrl: '',
  textureScale: 20.0,
  normalMapStrength: 1.0,
  displacementScale: 0.02,
  roughnessMultiplier: 1.0,
  albedoIntensity: 0.6,

  // Empty scatter layers by default
  scatterLayers: []
};

// Placeholder components for Rock and Grass
const Rock = ({ position, rotation, scale }) => (
  <mesh position={position} rotation={rotation} scale={scale} castShadow>
    <dodecahedronGeometry args={[0.18, 0]} />
    <meshStandardMaterial color="#888" />
  </mesh>
);
const Grass = ({ position, rotation, scale }) => (
  <mesh position={position} rotation={rotation} scale={scale} castShadow>
    <cylinderGeometry args={[0.05, 0.05, 0.3, 6]} />
    <meshStandardMaterial color="#3a5" />
  </mesh>
);

const OBJECT_COMPONENTS = {
  tree: BillboardTree,
  rock: Rock,
  grass: Grass
};

// Helper to limit points
function limitPoints(points, maxPoints) {
  if (!maxPoints || points.length <= maxPoints) return points;
  // Uniformly sample maxPoints from points
  const step = points.length / maxPoints;
  const result = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(points[Math.floor(i * step)]);
  }
  return result;
}

// Helper to coerce numeric params to numbers
function coerceNumericParams(params) {
  const numericKeys = [
    'size', 'meshResolution',
    'amplitude', 'octaves', 'lacunarity', 'gain',
    'ridgedOffset', 'warpStrength', 'warpFrequency', 'warpIterations',
    'waterLevel',
    'smoothIterations', 'smoothFactor',
    'heightScale', 'rockHeight', 'terrainBlendSharpness', 'moistureScale', 'moistureNoiseScale',
    'textureResolution', 'gravelIntensity', 'gravelScale', 'sedimentCurvatureIntensity'
  ];
  const out = { ...params };
  for (const key of numericKeys) {
    if (typeof out[key] === 'string') out[key] = +out[key];
  }
  // Also coerce scatterLayers numeric fields
  if (Array.isArray(out.scatterLayers)) {
    out.scatterLayers = out.scatterLayers
      .filter(l => l && typeof l === 'object') // Remove undefined/null
      .map(layer => {
        const layerNumeric = [
          'density', 'pointRadius', 'scale', 'jitter', 'maxSlopeDeg', 'maskThreshold', 'seed', 'maxPoints'
        ];
        const l = { ...layer };
        for (const k of layerNumeric) {
          if (typeof l[k] === 'string') l[k] = +l[k];
        }
        // Ensure seed is present and valid
        if (typeof l.seed !== 'number' || isNaN(l.seed)) l.seed = Math.floor(Math.random() * 100000);
        // Ensure scale is present and valid
        if (typeof l.scale !== 'number' || isNaN(l.scale)) l.scale = 1;
        // Ensure jitter is present and valid
        if (typeof l.jitter !== 'number' || isNaN(l.jitter)) l.jitter = 0;
        // Ensure enabled is present and valid
        if (typeof l.enabled !== 'boolean') l.enabled = true;
        // Add other defaults as needed
        return l;
      });
  }
  if (out.sedimentCurvatureIntensity === undefined) out.sedimentCurvatureIntensity = 0.5;
  return out;
}

function App() {
  // State for parameters
  const [rawParams, setParams] = usePersistentState('terrainParams', defaultParams);
  const params = coerceNumericParams(rawParams);
  // Ref for the 2D heightmap canvas
  const canvasRef = useRef(null);
  // Erosion state and refs
  const [erosionRunning, setErosionRunning] = useState(false);
  const [erosionProgress, setErosionProgress] = useState(undefined);
  const [terrainRunning, setTerrainRunning] = useState(false);
  const [terrainProgress, setTerrainProgress] = useState(undefined);
  const erosionWorkerRef = useRef(null);
  const terrainWorkerRef = useRef(null);
  const heightMapRef = useRef({ hm: null, width: 0, height: 0, minH: 0, maxH: 0, original: null });
  const [heightmapGenerated, setHeightmapGenerated] = useState(false);
  // 3D refresh logic: track when params change during 3D view
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const lastParamsStr = useRef(JSON.stringify(params));
  // Handler to generate and render a 2D heightmap
  const handleGenerateHeightmap = useCallback(() => {
    const noise2D = createImprovedNoise2D(params.seed);
    // Use meshResolution directly for 2D map
    const resolution = params.meshResolution || 512;
    const { geometry } = generateTerrain({ ...params, frequency: 0.15, meshResolution: resolution }, noise2D);
    const positions = geometry.attributes.position.array;
    const width = resolution + 1;
    const height = resolution + 1;
    // Build heightmap array and find min/max
    let minH = Infinity, maxH = -Infinity;
    const hm = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const h = positions[i * 3 + 2];
      hm[i] = h;
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
    }
    // Store raw heightmap and stats for erosion
    const original = new Float32Array(hm);
    heightMapRef.current = { hm, width, height, minH, maxH, original };
    // Draw to canvas
    const canvas = canvasRef.current;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      const normalized = Math.floor(((hm[i] - minH) / (maxH - minH || 1)) * 255);
      img.data[4 * i] = normalized;
      img.data[4 * i + 1] = normalized;
      img.data[4 * i + 2] = normalized;
      img.data[4 * i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    setHeightmapGenerated(true);
  }, [params, setHeightmapGenerated]);
  
  // Handler to export current heightmap as PNG
  const handleExportHeightmap = useCallback(() => {
    const { hm, width, height, minH, maxH } = heightMapRef.current;
    if (!hm) return;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = width;
    exportCanvas.height = height;
    const ctx2 = exportCanvas.getContext('2d');
    const imgData = ctx2.createImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      const norm = Math.floor(((hm[i] - minH) / (maxH - minH || 1)) * 255);
      imgData.data[4 * i] = norm;
      imgData.data[4 * i + 1] = norm;
      imgData.data[4 * i + 2] = norm;
      imgData.data[4 * i + 3] = 255;
    }
    ctx2.putImageData(imgData, 0, 0);
    exportCanvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `heightmap_${width}x${height}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 'image/png');
  }, []);

  // Erosion simulation parameters and handlers
  const erosionDroplets = params.erosionDroplets || 100000;
  const erosionBatchSize = params.erosionBatchSize || 1000;
  const erosionParams = {
    inertia: params.erosionInertia ?? 0.05,
    friction: params.erosionFriction ?? 0.02,
    sedimentCapacityFactor: params.erosionSedimentCapacity ?? 4,
    depositionRate: params.erosionDepositionRate ?? 0.3,
    evaporationRate: params.erosionEvaporationRate ?? 0.01,
    minVolume: params.erosionMinVolume ?? 0.01,
    initialVolume: params.erosionInitialVolume ?? 1.0,
    initialSpeed: params.erosionInitialSpeed ?? 1.0,
    maxDropletLifetime: params.erosionMaxDropletLifetime ?? 30
  };
  const handleStartErosion = useCallback(() => {
    const { width, height, original } = heightMapRef.current;
    if (!original) return;
    const worker = new ErosionWorkerService();
    erosionWorkerRef.current = worker;
    setErosionRunning(true);
    setErosionProgress(0);
    worker.init(width, height, original, erosionParams, erosionDroplets).then(() => {
    function runBatch() {
        worker.step(erosionBatchSize).then(({ alive, heightMap }) => {
          let newMin = Infinity, newMax = -Infinity;
          for (const v of heightMap) { if (v < newMin) newMin = v; if (v > newMax) newMax = v; }
          heightMapRef.current.hm = heightMap;
          heightMapRef.current.minH = newMin;
          heightMapRef.current.maxH = newMax;
          const ctx = canvasRef.current.getContext('2d');
          const img2 = ctx.createImageData(width, height);
          for (let i = 0; i < width * height; i++) {
            const norm = Math.floor(((heightMap[i] - newMin) / (newMax - newMin || 1)) * 255);
            img2.data[4 * i] = norm;
            img2.data[4 * i + 1] = norm;
            img2.data[4 * i + 2] = norm;
            img2.data[4 * i + 3] = 255;
          }
          ctx.putImageData(img2, 0, 0);
          setErosionProgress((erosionDroplets - alive) / erosionDroplets);
          if (alive) setTimeout(runBatch, 0);
          else setErosionRunning(false);
        });
    }
    runBatch();
    });
  }, [erosionBatchSize, erosionDroplets, erosionParams]);
  const handleStopErosion = useCallback(() => {
    if (erosionWorkerRef.current) erosionWorkerRef.current.pause();
    setErosionRunning(false);
  }, []);
  const handleResetErosion = useCallback(() => {
    const orig = heightMapRef.current.original;
    if (!orig) return;
    if (erosionWorkerRef.current) {
      erosionWorkerRef.current.reset(orig).then(() => {
        const { width, height } = heightMapRef.current;
        let minH2 = Infinity, maxH2 = -Infinity;
        for (const v of orig) { if (v < minH2) minH2 = v; if (v > maxH2) maxH2 = v; }
        heightMapRef.current.hm = new Float32Array(orig);
        heightMapRef.current.minH = minH2;
        heightMapRef.current.maxH = maxH2;
        const ctx = canvasRef.current.getContext('2d');
        const img3 = ctx.createImageData(width, height);
        for (let i = 0; i < width * height; i++) {
          const norm = Math.floor(((orig[i] - minH2) / (maxH2 - minH2 || 1)) * 255);
          img3.data[4 * i] = norm;
          img3.data[4 * i + 1] = norm;
          img3.data[4 * i + 2] = norm;
          img3.data[4 * i + 3] = 255;
        }
        ctx.putImageData(img3, 0, 0);
        setErosionRunning(false);
        setErosionProgress(undefined);
      });
    }
  }, []);

  // 2D/3D view toggle and zoom/pan setup
  const [show3DView, setShow3DView] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const handleWheel = useCallback(e => { e.preventDefault(); const delta = -e.deltaY / 500; setZoom(z => Math.min(Math.max(z * (1 + delta), 0.1), 10)); }, []);
  const handleMouseDown = useCallback(e => { isPanningRef.current = true; panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }; }, [pan]);
  const handleMouseMove = useCallback(e => { if (isPanningRef.current) { setPan({ x: e.clientX - panStartRef.current.x, y: e.clientY - panStartRef.current.y }); } }, []);
  const handleMouseUp = useCallback(() => { isPanningRef.current = false; }, []);
  // 3D view on-demand data
  const [threeData, setThreeData] = useState(null);
  const handleGenerate3D = useCallback(() => {
    const terrainWorker = new TerrainWorkerService();
    terrainWorkerRef.current = terrainWorker;
    setTerrainRunning(true);
    setTerrainProgress(0);
    terrainWorker.generate(params, p => setTerrainProgress(p), heightMapRef.current.hm).then(data => {
      const { geometryData, scatterData } = data;
      // Reconstruct geometry
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(geometryData.positions), 3));
      geom.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(geometryData.normals), 3));
      if (geometryData.uvs.length) geom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometryData.uvs), 2));
      if (geometryData.indices.length) geom.setIndex(new THREE.BufferAttribute(new Uint32Array(geometryData.indices), 1));
      // Create threeData
      // Water plane recreated on main thread
      const waterPlane = params.enableWater
        ? createWaterPlane( Math.max(params.size, params.size), { waterLevel: params.waterLevel, waterColor: '#00ffff', useLOD: false })
        : null;
      setThreeData({ geometry: geom, material: null, water: waterPlane, scatterData });
      // Create material on main thread
      createTexturedTerrainMaterial({
        heightScale: params.heightScale, rockHeight: params.rockHeight,
        moistureScale: params.moistureScale, moistureNoiseScale: params.moistureNoiseScale,
        terrainBlendSharpness: params.terrainBlendSharpness, textureResolution: params.textureResolution,
        gravelIntensity: params.gravelIntensity, gravelScale: params.gravelScale,
        sedimentCurvatureIntensity: params.sedimentCurvatureIntensity,
        albedoMapUrl: params.albedoMapUrl, normalMapUrl: params.normalMapUrl,
        roughnessMapUrl: params.roughnessMapUrl, displacementMapUrl: params.displacementMapUrl,
        textureScale: params.textureScale, normalMapStrength: params.normalMapStrength,
        displacementScale: params.displacementScale, roughnessMultiplier: params.roughnessMultiplier,
        albedoIntensity: params.albedoIntensity
      }).then(mat => {
        setThreeData(td => ({ ...td, material: mat }));
        setTerrainRunning(false);
        setTerrainProgress(undefined);
        setShow3DView(true);
      });
    });
  }, [params]);

  useEffect(() => {
    const paramStr = JSON.stringify(params);
    if (show3DView && threeData && paramStr !== lastParamsStr.current) {
      setNeedsRefresh(true);
    }
    lastParamsStr.current = paramStr;
  }, [params, show3DView, threeData]);

  // Combined worker activity
  const anyWorkerRunning = erosionRunning || terrainRunning;
  const combinedProgress = anyWorkerRunning ? (
    ((erosionRunning ? (erosionProgress || 0) : 0) + (terrainRunning ? (terrainProgress || 0) : 0)) /
    ((erosionRunning ? 1 : 0) + (terrainRunning ? 1 : 0))
  ) : 0;

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#1e1e1e' }}>
      <SettingsPanel 
        params={{
          ...params,
          erosionRunning,
          erosionProgress,
          terrainRunning,
          terrainProgress,
          onStartErosion: !erosionRunning ? handleStartErosion : undefined,
          onStopErosion: erosionRunning ? handleStopErosion : undefined,
          onResetErosion: handleResetErosion
        }}
        onParamChange={(key, value) => setParams(prev => ({ ...prev, [key]: value }))}
        onReset={() => setParams(defaultParams)}
      />
      <div style={{ flex: 1, padding: '20px', backgroundColor: '#222' }}>
        {/* Web worker loading bar */}
        <div style={{ height: '6px', background: '#333', marginBottom: '10px' }}>
          {anyWorkerRunning && (
            <div style={{ width: `${combinedProgress * 100}%`, height: '100%', background: '#6ec1e4', transition: 'width 0.2s' }} />
          )}
        </div>
        {/* View controls */}
        <div style={{ marginBottom: '10px', display: 'flex', gap: '10px' }}>
          {!show3DView && (
            <button 
              onClick={handleGenerateHeightmap}
              style={{ 
                padding: '10px 20px',
                background: '#6ec1e4',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                ':hover': {
                  background: '#5aa8cc',
                  transform: 'translateY(-1px)'
                },
                ':active': {
                  transform: 'translateY(0)'
                }
              }}
            >
              <span>🗻</span>
              Generate Heightmap
            </button>
          )}
          {!show3DView && heightmapGenerated && (
            <button 
              onClick={handleExportHeightmap}
              style={{ 
                padding: '10px 20px',
                background: '#6ec1e4',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                ':hover': {
                  background: '#5aa8cc',
                  transform: 'translateY(-1px)'
                },
                ':active': {
                  transform: 'translateY(0)'
                }
              }}
            >
              <span>💾</span>
              Export Heightmap
            </button>
          )}
          <button 
            onClick={() => {
              if (!show3DView) {
                handleGenerate3D();
              } else {
                setShow3DView(false);
              }
            }}
            style={{ 
              padding: '10px 20px',
              background: show3DView ? '#e46464' : '#6ec1e4',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              ':hover': {
                background: show3DView ? '#cc5353' : '#5aa8cc',
                transform: 'translateY(-1px)'
              },
              ':active': {
                transform: 'translateY(0)'
              }
            }}
          >
            {show3DView ? (
              <>
                <span>⬜</span>
                2D View
              </>
            ) : (
              <>
                <span>🎮</span>
                3D View
              </>
            )}
          </button>
        </div>
        {/* Display area */}
        <div style={{ width: '100%', height: 'calc(100% - 60px)', overflow: 'hidden', position: 'relative' }}>
          {/* Refresh button overlay when 3D needs regeneration */}
          {needsRefresh && !terrainRunning && show3DView && threeData && (
            <button
              onClick={() => { handleGenerate3D(); setNeedsRefresh(false); }}
              style={{ position: 'absolute', top: 10, right: 10, zIndex: 10, padding: '6px', background: '#6ec1e4', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              title="Refresh 3D"
            >↻</button>
          )}
          {show3DView && threeData ? (
            <Canvas shadows camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }} style={{ width: '100%', height: '100%' }}>
              <mesh geometry={threeData.geometry} material={threeData.material} vertexColors rotation={[-Math.PI / 2, 0, 0]} />
              {threeData.water && <Water object={threeData.water} />}
              {threeData.scatterData
                .filter(({ layer, points }) =>
                  layer &&
                  typeof layer.seed === 'number' &&
                  typeof layer.scale === 'number' &&
                  Array.isArray(points) &&
                  layer.enabled
                )
                .map(({ layer, points }, idx) => {
                  // Get heightmap info
                  const { hm, width, height } = heightMapRef.current || {};
                  // Provide a getZ function
                  const getZ = (x, y) => {
                    if (!hm || !width || !height) return 0;
                    // Clamp x/y to valid range
                    const xi = Math.max(0, Math.min(width - 1, Math.round(x)));
                    const yi = Math.max(0, Math.min(height - 1, Math.round(y)));
                    return hm[yi * width + xi];
                  };

                  if (layer.debug) {
                    // Render debug points
                    return points.map((pt, i) => (
                      <mesh key={i} position={[pt.x, getZ(pt.x, pt.y), pt.y]}>
                        <sphereGeometry args={[0.1, 8, 8]} />
                        <meshStandardMaterial color="red" />
                      </mesh>
                    ));
                  }
                  if (layer.objectType === 'tree') {
                    return (
                      <InstancedBillboardTrees
                        key={idx}
                        points={points}
                        getZ={getZ}
                        width={width}
                        height={height}
                        layer={layer}
                        params={params}
                      />
                    );
                  }
                  if (layer.objectType === 'grass') {
                    return <InstancedGrassClumps key={idx} points={points} params={params} useSimpleMesh />;
                  }
                  const Component = OBJECT_COMPONENTS[layer.objectType] || BillboardTree;
                  // For other object types, compute world coordinates from grid points
                  return points.map((pt, i) => {
                    const worldSize = params.size;
                    const x = (pt.x / (width - 1) - 0.5) * worldSize;
                    const z = (pt.y / (height - 1) - 0.5) * worldSize;
                    const y = getZ(pt.x, pt.y);
                    return <Component key={`${idx}-${i}`} position={[x, y, z]} />;
                  });
                })}
              <gridHelper args={GRID_HELPER_ARGS} />
              <axesHelper args={AXES_HELPER_ARGS} />
              <OrbitControls enableZoom enableRotate enablePan />
            </Canvas>
          ) : (
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;