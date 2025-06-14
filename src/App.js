import React, { useState, useCallback, useMemo, useEffect } from 'react';

// SettingsPanel and PresetPanel are still used
import SettingsPanel from './components/SettingsPanel';
import PresetPanel from './components/PresetPanel'; // Assuming this is still used

// Hook for persistent state
import usePersistentState from './hooks/usePersistentState';

// Import new Viewport components
import TwoDViewport from './components/TwoDViewport';
import ThreeDViewport from './components/ThreeDViewport';

// Import Services & their default parameter objects
import HeightmapGenerationService, { HeightmapDefaultParams } from './services/HeightmapGenerationService';
import ErosionService, { DefaultErosionParams } from './services/ErosionService';
import ScatterService, { DefaultGlobalScatterParams, DefaultScatterLayerParams } from './services/ScatterService';
// DefaultTextureURLs from TerrainMaterialService is not directly used in App.js state aggregation
import TerrainMaterialService, { DefaultTerrainMaterialParams, DefaultWaterParams } from './services/TerrainMaterialService';
import HeightmapDisplayService from './services/HeightmapDisplayService';

const getAggregatedDefaultParams = () => {
  // HeightmapGenerationService exports HeightmapDefaultParams directly (already includes shape and noise)
  const hgDefaults = HeightmapDefaultParams || {};
  const erDefaults = DefaultErosionParams || {};
  const globalScDefaults = DefaultGlobalScatterParams || {};
  // For scatter.scatterLayers, initialize with an empty array or one default layer.
  // The actual DefaultScatterLayerParams is for when a user *adds* a new layer.
  const scDefaults = {
    ...globalScDefaults, // any global scatter settings
    scatterLayers: [], // Default to no layers; SettingsPanel will use DefaultScatterLayerParams to add one
  };
  const tmDefaults = DefaultTerrainMaterialParams || {};
  const twDefaults = DefaultWaterParams || {};

  // This structure should align with what SettingsPanel and Viewports expect.
  // Using a flatter structure for generation params as per previous App.js setup.
  return {
    // Root/Generation params (from HeightmapDefaultParams)
    size: hgDefaults.size !== undefined ? hgDefaults.size : 1000,
    meshResolution: hgDefaults.meshResolution !== undefined ? hgDefaults.meshResolution : 512,
    seed: hgDefaults.seed !== undefined ? hgDefaults.seed : Date.now(),
    frequency: hgDefaults.frequency, // Assuming these are all in hgDefaults
    amplitude: hgDefaults.amplitude,
    octaves: hgDefaults.octaves,
    lacunarity: hgDefaults.lacunarity,
    gain: hgDefaults.gain,
    ridgedOffset: hgDefaults.ridgedOffset,
    worleyPoints: hgDefaults.worleyPoints,
    // Note: HeightmapDefaultParams might need to be expanded if it doesn't have all these (e.g. domainWarp)
    // For now, assuming they are part of hgDefaults or will be undefined (and thus use component-level defaults if any)
    domainWarpStrength: hgDefaults.domainWarpStrength,
    domainWarpFreq: hgDefaults.domainWarpFreq,

    // Nested params for other services/concerns
    material: { ...tmDefaults },
    water: { ...twDefaults },
    erosion: { ...erDefaults },
    scatter: { ...scDefaults }, // Contains global scatter settings and initial empty scatterLayers array

    debug: { // Default debug settings
      showGrid: false,
      showAxes: false,
    },
    lighting: { // Default lighting settings
      ambientIntensity: 0.5,
      sunIntensity: 1.0,
      sunPosition: [100, 100, 50],
    }
  };
};

function App() {
  // Instantiate Services (no changes here from previous step)
  const heightmapGenerationService = useMemo(() => new HeightmapGenerationService(), []);
  const erosionService = useMemo(() => new ErosionService(), []);
  const scatterService = useMemo(() => new ScatterService(), []);
  const terrainMaterialService = useMemo(() => new TerrainMaterialService(), []);
  const heightmapDisplayService = useMemo(() => new HeightmapDisplayService(), []);

  // initialAppSettings now uses the getAggregatedDefaultParams function
  const initialAppSettings = useMemo(() => getAggregatedDefaultParams(), []);
  // Note: Dependencies for useMemo on initialAppSettings can be empty if getAggregatedDefaultParams() is stable
  // and doesn't rely on service instances themselves for default values (which it shouldn't for static defaults).

  // New State Management
  const [currentParams, setCurrentParams] = usePersistentState('appParams_v3', initialAppSettings);
  const [activeView, setActiveView] = useState('2D');

  const [heightmapData, setHeightmapData] = useState(null);
  const [mapDimensions, setMapDimensions] = useState({
    width: currentParams.meshResolution || (initialAppSettings && initialAppSettings.meshResolution) || 512,
    height: currentParams.meshResolution || (initialAppSettings && initialAppSettings.meshResolution) || 512
  });
  const [minMaxHeight, setMinMaxHeight] = useState({ minH: 0, maxH: 1 });

  const [isAppBusy, setIsAppBusy] = useState(false);
  const [isHeightmapEverGenerated, setIsHeightmapEverGenerated] = useState(false);

  const handleResetParams = useCallback(() => {
    const newDefaults = getAggregatedDefaultParams(); // Get fresh defaults
    setCurrentParams(newDefaults);
    setHeightmapData(null);
    setIsHeightmapEverGenerated(false);
    setMapDimensions({
      width: newDefaults.meshResolution || 512,
      height: newDefaults.meshResolution || 512
    });
    setMinMaxHeight({ minH: 0, maxH: 1 });
    setActiveView('2D');
  }, [setCurrentParams]); // Removed initialAppSettings from deps, as getAggregatedDefaultParams is stable

  const onHeightmapGeneratedFrom2D = useCallback((newData, width, height, minH, maxH) => {
    setHeightmapData(newData);
    setMapDimensions({ width, height });
    setMinMaxHeight({ minH, maxH });
    setIsHeightmapEverGenerated(true);
  }, []);

  const handleBusyStateChange = useCallback((isBusy) => {
    setIsAppBusy(isBusy);
  }, []);

  // Effect to update mapDimensions if meshResolution changes in currentParams
  // before a heightmap is generated for the first time or after a reset.
  useEffect(() => {
    if (!isHeightmapEverGenerated || !heightmapData) {
      setMapDimensions({
        width: currentParams.meshResolution || initialAppSettings.meshResolution || 512,
        height: currentParams.meshResolution || initialAppSettings.meshResolution || 512,
      });
    }
  }, [currentParams.meshResolution, isHeightmapEverGenerated, heightmapData, initialAppSettings.meshResolution]);


  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#1e1e1e' }}>
      <SettingsPanel 
        params={currentParams}
        defaultScatterLayerParams={DefaultScatterLayerParams} // Pass the default for new layers
        onParamChange={(key, value) => {
          const keys = key.split('.');
          if (keys.length > 1) {
            setCurrentParams(prev => {
              const newState = { ...prev };
              let currentLevel = newState;
              keys.forEach((k, index) => {
                if (index === keys.length - 1) {
                  currentLevel[k] = value;
                } else {
                  // Ensure nested objects exist before assigning to them
                  currentLevel[k] = { ...(currentLevel[k] || {}) };
                  currentLevel = currentLevel[k];
                }
              });
              return newState;
            });
          } else {
            setCurrentParams(prev => ({ ...prev, [key]: value }));
          }
        }}
        onReset={handleResetParams}
      />
      <div style={{ flex: 1, padding: '20px', backgroundColor: '#222', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: '6px', background: '#333', marginBottom: '10px' }}>
          {isAppBusy && (
            <div style={{ width: `100%`, height: '100%', background: '#6ec1e4', animation: 'pulse 1.5s infinite ease-in-out' }} />
          )}
        </div>

        <div style={{ marginBottom: '10px', display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setActiveView(prev => prev === '2D' ? '3D' : '2D')}
            disabled={activeView === '2D' && !isHeightmapEverGenerated && !heightmapData}
            style={{
              padding: '10px 20px',
              background: '#6ec1e4',
              border: 'none', // Added comma here
              borderRadius: '8px',
              color: 'white',
              fontWeight: '600',
              cursor: 'pointer',
              opacity: (activeView === '2D' && !isHeightmapEverGenerated && !heightmapData) ? 0.5 : 1,
            }}
          >
            {activeView === '2D' ? 'Switch to 3D View' : 'Switch to 2D View'}
          </button>
        </div>

        <div style={{ flex: 1, width: '100%', overflow: 'hidden', position: 'relative', border: '1px solid #444' }}>
          {activeView === '2D' ? (
            <TwoDViewport
              currentParams={currentParams}
              heightmapGenerationService={heightmapGenerationService}
              erosionService={erosionService}
              heightmapDisplayService={heightmapDisplayService}
              onHeightmapGenerated={onHeightmapGeneratedFrom2D}
              initialHeightmapData={{
                data: heightmapData,
                width: mapDimensions.width,
                height: mapDimensions.height,
                minHeight: minMaxHeight.minH,
                maxHeight: minMaxHeight.maxH,
              }}
              onBusyStateChange={handleBusyStateChange}
            />
          ) : (
            heightmapData && isHeightmapEverGenerated ? (
              <ThreeDViewport
                currentParams={currentParams}
                heightmapData={heightmapData}
                mapWidth={mapDimensions.width}
                mapHeight={mapDimensions.height}
                minGeneratedHeight={minMaxHeight.minH}
                maxGeneratedHeight={minMaxHeight.maxH}
                services={{ terrainMaterialService, scatterService }}
                onBusyStateChange={handleBusyStateChange}
              />
            ) : (
              <div style={{color: 'white', textAlign: 'center', paddingTop: '50px'}}>
                Please generate a heightmap in the 2D view first.
              </div>
            )
          )}
        </div>
      </div>
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

export default App;
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