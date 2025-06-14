import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stats, useProgress, Html } from '@react-three/drei';
import * as THREE from 'three';

// Assuming BillboardTree and InstancedGrassClumps might be moved to their own files or defined here
// For now, let's define simplified placeholders if not directly importing.
const PlaceholderObject = ({ position, type }) => (
  <mesh position={position}>
    <boxGeometry args={[0.5, 1, 0.5]} />
    <meshStandardMaterial color={type === 'tree' ? 'green' : 'brown'} />
  </mesh>
);

const OBJECT_COMPONENTS = {
  tree_1: (props) => <PlaceholderObject {...props} type="tree" />, // Replace with actual BillboardTree
  rock_1: (props) => <PlaceholderObject {...props} type="rock" />,  // Replace with actual Rock component
  // grass_clump_1: InstancedGrassClumps, // Example
};


const CAMERA_POSITION = [150, 100, 150];
const CAMERA_FOV = 50;

// Loader component to be shown via useProgress
function Loader() {
  const { active, progress, errors, item, loaded, total } = useProgress();
  return active ? <Html center>{Math.round(progress)}% loaded: {item}</Html> : null;
}

const ThreeDViewport = ({
  currentParams,
  heightmapData, // Float32Array
  mapWidth, // Resolution width
  mapHeight, // Resolution height
  minGeneratedHeight, // min height from heightmap generation for scaling
  maxGeneratedHeight, // max height from heightmap generation for scaling
  services, // { TerrainMaterialService, ScatterService }
  onBusyStateChange, // (isBusy: boolean) => void
  onWorkerGeneratedHeightmap, // (generatedHeightmapData) => void
}) => {
  const terrainWorker = useMemo(() => {
    // Ensure worker is only created in browser environment
    if (typeof window === 'undefined') return null;
    return new Worker(new URL('../workers/terrainWorker.js', import.meta.url), { type: 'module' });
  }, []);

  const [terrainGeometry, setTerrainGeometry] = useState(null);
  const [terrainMaterial, setTerrainMaterial] = useState(null);
  const [waterMesh, setWaterMesh] = useState(null);
  const [scatterObjectsData, setScatterObjectsData] = useState([]); // Array of { points: [], layerConfig: {} }

  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // Used to force re-process

  // Effect for generating 3D data when heightmap or relevant params change
  useEffect(() => {
    // Ensure heightmapData is available before trying to process.
    // Worker will handle heightmap generation if heightmapData is null.
    if (!services || mapWidth <= 0 || mapHeight <= 0) {
        if (heightmapData) { // If we have heightmap but other params are bad, clear old geometry
            setTerrainGeometry(null);
            setTerrainMaterial(null);
            setWaterMesh(null);
            setScatterObjectsData([]);
        }
        return;
    }

    if (onBusyStateChange) onBusyStateChange(true);
    setIsProcessing(true);
    console.log("ThreeDViewport: Posting data to worker...", currentParams);

    const workerPayload = {
      params: currentParams, // Worker expects specific structure within params
      // Conditionally pass heightmap data if it exists
    };
    const transferList = [];

    if (heightmapData) {
      workerPayload.heightmapData = heightmapData.buffer.slice(0); // Send a copy of the buffer
      workerPayload.mapWidth = mapWidth;
      workerPayload.mapHeight = mapHeight;
      workerPayload.minHeight = minGeneratedHeight;
      workerPayload.maxHeight = maxGeneratedHeight;
      transferList.push(workerPayload.heightmapData);
    }

    terrainWorker.postMessage({ action: 'generateScene', payload: workerPayload }, transferList);

    // Old cleanup logic for direct THREE objects.
    // Worker results will create new geometry, so existing ones should be disposed.
    return () => {
        if (terrainGeometry) {
            terrainGeometry.dispose();
            setTerrainGeometry(null); // Clear state for next run
        }
        if (terrainMaterial) {
            // Proper texture disposal if material owns them and they aren't cached by service
            if (terrainMaterial.uniforms) {
                 Object.values(terrainMaterial.uniforms).forEach(uniform => {
                    if (uniform.value && uniform.value.isTexture && uniform.value.dispose) {
                        // Check if texture is from cache before disposing
                        // For now, assume main thread material creation handles textures correctly.
                        // uniform.value.dispose();
                    }
                });
            }
            terrainMaterial.dispose();
            setTerrainMaterial(null);
        }
         if (waterMesh) {
            if (waterMesh.geometry) waterMesh.geometry.dispose();
            if (waterMesh.material) {
                // Similar texture disposal logic if water material has unique textures
                // waterMesh.material.dispose();
            }
            setWaterMesh(null);
        }
        // Scatter objects are components, will unmount. If they use geometries, they should dispose them.
    };

  }, [
    heightmapData, mapWidth, mapHeight, minGeneratedHeight, maxGeneratedHeight,
    currentParams, services, refreshKey, terrainWorker, onBusyStateChange
  ]);

  // Effect for handling messages from the terrain worker
  useEffect(() => {
    if (!terrainWorker) return;

    const handleWorkerMessage = async (event) => {
      const { type, payload, phase, value } = event.data;

      if (type === 'progress') {
        // console.log(`Worker progress: ${phase} - ${(value * 100).toFixed(0)}%`);
        // Optionally, update a more detailed progress state here
      } else if (type === 'done') {
        console.log("ThreeDViewport: Worker finished processing.", payload);
        const { geometryData, scatterData, generatedHeightmapData } = payload;

        // 1. Handle new heightmap if worker generated it
        if (generatedHeightmapData && onWorkerGeneratedHeightmap) {
          // Reconstruct Float32Array from buffer
          const newHmData = new Float32Array(generatedHeightmapData.heightmap);
          onWorkerGeneratedHeightmap({ ...generatedHeightmapData, heightmap: newHmData });
        }

        // 2. Reconstruct Terrain Geometry
        const newGeometry = new THREE.BufferGeometry();
        newGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(geometryData.positions), 3));
        newGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(geometryData.normals), 3));
        newGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometryData.uvs), 2));
        newGeometry.setIndex(new THREE.BufferAttribute(new Uint32Array(geometryData.indices), 1));
        setTerrainGeometry(newGeometry);
        console.log("ThreeDViewport: Terrain geometry reconstructed from worker data.");

        // 3. Create Terrain Material (Main Thread)
        if (services.TerrainMaterialService) {
          try {
            const material = await services.TerrainMaterialService.createTexturedTerrainMaterial(currentParams.material || {});
            setTerrainMaterial(material);
            console.log("ThreeDViewport: Terrain material created.");
          } catch (error) {
            console.error("Error creating terrain material:", error);
            setTerrainMaterial(new THREE.MeshStandardMaterial({ color: 'grey', wireframe: true }));
          }
        } else {
          setTerrainMaterial(new THREE.MeshStandardMaterial({ color: 'grey', wireframe: true }));
        }

        // 4. Create Water Plane (Main Thread)
        if (services.TerrainMaterialService && currentParams.water?.enableWater) {
          const actualHeightScale = currentParams.material?.heightScale || 1.0;
          const waterParams = {
            ...(currentParams.water || {}),
            waterLevel: (currentParams.water.waterLevel || 0) * actualHeightScale,
          };
          const water = services.TerrainMaterialService.createWaterPlane(currentParams.size * 2, waterParams);
          setWaterMesh(water);
          console.log("ThreeDViewport: Water mesh created.");
        } else {
          setWaterMesh(null);
        }

        // 5. Set Scatter Data
        setScatterObjectsData(scatterData || []); // scatterData from worker is an array of {layerName, points}
        console.log("ThreeDViewport: Scatter data set from worker.");

        setIsProcessing(false);
        if (onBusyStateChange) onBusyStateChange(false);
        console.log("ThreeDViewport: All data processing complete.");
      } else if (type === 'error') {
        console.error("Error from terrain worker:", payload.message);
        setIsProcessing(false);
        if (onBusyStateChange) onBusyStateChange(false);
      }
    };

    terrainWorker.addEventListener('message', handleWorkerMessage);

    return () => {
      terrainWorker.removeEventListener('message', handleWorkerMessage);
      // Consider terminating worker if ThreeDViewport itself is unmounted.
      // If worker is shared or long-lived, manage termination elsewhere.
  // For this component, if it unmounts, terminating the worker is reasonable.
  // However, the current setup re-runs this effect if deps change,
  // so terminating here would break it. A separate effect for mount/unmount for terminate might be better
  // or ensure terrainWorker instance is stable and only terminate on component unmount.
  // The useMemo for terrainWorker makes it stable for component lifetime.
  // So, terminate should happen when ThreeDViewport unmounts.
  return () => {
      terrainWorker?.removeEventListener('message', handleWorkerMessage);
      // Terminate worker on component unmount
      // terrainWorker?.terminate(); // Disabled for now, could be an App-level decision
    };
}, [terrainWorker, services, currentParams, onBusyStateChange, onWorkerGeneratedHeightmap]); // Added currentParams to re-setup listener if params structure for material/water changes how they are created.


  // Helper to get Z (Y in 3D world) at a given X, Z grid coordinate
  // Assumes heightmapData is correctly scaled for world heights.
  const getTerrainHeightAt = useCallback((worldX, worldZ) => {
    if (!heightmapData || !terrainGeometry) return 0;

    const terrainSize = currentParams.size;
    // Convert world coordinates to grid coordinates (0 to mapWidth-1, 0 to mapHeight-1)
    const gridX = Math.floor(((worldX + terrainSize / 2) / terrainSize) * (mapWidth -1));
    const gridZ = Math.floor(((worldZ + terrainSize / 2) / terrainSize) * (mapHeight-1)); // mapHeight corresponds to Z dimension

    if (gridX < 0 || gridX >= mapWidth || gridZ < 0 || gridZ >= mapHeight) {
      return 0; // Outside of heightmap bounds
    }
    const index = gridZ * mapWidth + gridX;
    const actualHeightScale = currentParams.material?.heightScale || 1.0;
    return heightmapData[index] * actualHeightScale;
  }, [heightmapData, mapWidth, mapHeight, currentParams.size, currentParams.material?.heightScale]);


  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const viewportContainerStyle = { height: '100vh', width: '100%', position: 'relative' }; // Ensure canvas can fill
  const buttonStyle = { position: 'absolute', top: '10px', left: '10px', zIndex: 1000 };

  return (
    <div style={viewportContainerStyle}>
      <button onClick={handleRefresh} style={buttonStyle} disabled={isProcessing}>
        {isProcessing ? 'Processing...' : 'Refresh 3D View'}
      </button>
      <Canvas
        camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
        gl={{ antialias: true, physicallyCorrectLights: true }}
        shadows
      >
        <Loader />
        <ambientLight intensity={currentParams.lighting?.ambientIntensity ?? 0.5} />
        <directionalLight
          position={currentParams.lighting?.sunPosition ? new THREE.Vector3(...currentParams.lighting.sunPosition) : [100, 100, 50]}
          intensity={currentParams.lighting?.sunIntensity ?? 1.0}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={500}
          shadow-camera-left={-currentParams.size / 2}
          shadow-camera-right={currentParams.size / 2}
          shadow-camera-top={currentParams.size / 2}
          shadow-camera-bottom={-currentParams.size / 2}
        />

        {terrainGeometry && terrainMaterial && (
          <mesh geometry={terrainGeometry} material={terrainMaterial} receiveShadow castShadow />
        )}

        {waterMesh && <primitive object={waterMesh} />}

        {scatterObjectsData.map((layerData, layerIndex) =>
          layerData.points.map((point, pointIndex) => {
            const ObjectComponent = OBJECT_COMPONENTS[layerData.layerConfig.objectType] || PlaceholderObject;
            // Convert scatter point (grid coordinates) to world coordinates
            // Scatter points are {x, y, z (world height), normal, slope}
            // x, y from scatter are grid coords.
            const worldX = (point.x / mapWidth - 0.5) * currentParams.size;
            const worldZ = (point.y / mapHeight - 0.5) * currentParams.size; // Scatter Y is map Z
            const worldY = point.z; // Already world height from scatter service

            return (
              <ObjectComponent
                key={`${layerIndex}-${pointIndex}`}
                position={[worldX, worldY, worldZ]} // Scatter point Z is world Y
                // scale={layerData.layerConfig.scale} // Add scale from layerConfig if available
                // rotation={...} // Add rotation based on normal if needed
              />
            );
          })
        )}

        <OrbitControls />
        {currentParams.debug?.showGrid && <gridHelper args={[currentParams.size || 100, 20]} />}
        {currentParams.debug?.showAxes && <axesHelper args={[ (currentParams.size || 100) / 4]} />}
        <Stats />
      </Canvas>
    </div>
  );
};

// PropTypes (example, expand as needed)
ThreeDViewport.propTypes = {
  currentParams: PropTypes.object.isRequired,
  heightmapData: PropTypes.instanceOf(Float32Array), // Can be null initially
  mapWidth: PropTypes.number.isRequired,
  mapHeight: PropTypes.number.isRequired,
  minGeneratedHeight: PropTypes.number,
  maxGeneratedHeight: PropTypes.number,
  services: PropTypes.shape({
    TerrainMaterialService: PropTypes.object.isRequired, // Or specific shape
    ScatterService: PropTypes.object.isRequired,       // Or specific shape
  }).isRequired,
  onBusyStateChange: PropTypes.func.isRequired,
  onWorkerGeneratedHeightmap: PropTypes.func.isRequired,
};


export default ThreeDViewport;
