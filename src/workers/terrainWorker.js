import * as THREE from 'three';
import { generateTerrainInternal } from '../services/HeightmapGenerationService.js';
import { generateScatterLayerPointsInternal } from '../services/ScatterService.js';

const WORKER_TERRAIN_TYPES = {
    ALL: 'all',
    MOUNTAIN: 'mountain',
    VALLEY: 'valley',
    PLAIN: 'plain',
};

self.onmessage = async (e) => {
    const { action, payload } = e.data;

    if (action === 'generateScene') {
        const { params, heightmapData, mapWidth, mapHeight, minHeight, maxHeight } = payload;
        self.postMessage({ type: 'progress', phase: 'start', value: 0.0 });

        let currentHeightmapArray;
        let currentMapGridWidth;
        let currentMapGridHeight;
        let currentMinH;
        let currentMaxH;
        let wasHeightmapGeneratedByWorker = false;

        // A. Heightmap Preparation (Simplified)
        if (!heightmapData) {
            const generationResult = generateTerrainInternal(params); // Assuming params has generation settings directly
            currentHeightmapArray = generationResult.heightmap;
            currentMapGridWidth = generationResult.width;
            currentMapGridHeight = generationResult.height;
            if (currentHeightmapArray && currentHeightmapArray.length > 0) {
                // Basic min/max, can be refined if needed for flat maps
                currentMinH = currentHeightmapArray[0];
                currentMaxH = currentHeightmapArray[0];
                for(let i=1; i<currentHeightmapArray.length; ++i) {
                    if(currentHeightmapArray[i] < currentMinH) currentMinH = currentHeightmapArray[i];
                    if(currentHeightmapArray[i] > currentMaxH) currentMaxH = currentHeightmapArray[i];
                }
            } else { currentMinH = 0; currentMaxH = 0;}
            wasHeightmapGeneratedByWorker = true;
        } else {
            currentHeightmapArray = heightmapData;
            currentMapGridWidth = mapWidth;
            currentMapGridHeight = mapHeight;
            currentMinH = minHeight;
            currentMaxH = maxHeight;
        }
        self.postMessage({ type: 'progress', phase: 'heightmap', value: 1.0 });

        // B. Terrain Mesh Generation (Placeholder for now)
        // Actual mesh data will be built based on currentHeightmapArray
        const numVertices = currentMapGridWidth * currentMapGridHeight;
        const positions = new Float32Array(numVertices * 3);
        const normals = new Float32Array(numVertices * 3);
        const uvs = new Float32Array(numVertices * 2);
        const numTriangles = (currentMapGridWidth - 1) * (currentMapGridHeight - 1) * 2;
        const indices = new Uint32Array(numTriangles * 3);

        // Populate positions, uvs, and indices
        const terrainWorldSize = params.size;
        const terrainHeightScale = params.material?.heightScale || 1.0;

        for (let j = 0; j < currentMapGridHeight; j++) { // Grid Y (depth)
            for (let i = 0; i < currentMapGridWidth; i++) { // Grid X (width)
                const vertexIdx = j * currentMapGridWidth + i;
                const heightVal = currentHeightmapArray[vertexIdx];
                const scaledHeight = heightVal * terrainHeightScale;

                const worldX = (i / (currentMapGridWidth - 1) - 0.5) * terrainWorldSize;
                const worldZ = (j / (currentMapGridHeight - 1) - 0.5) * terrainWorldSize;

                positions[vertexIdx * 3 + 0] = worldX;
                positions[vertexIdx * 3 + 1] = scaledHeight; // Y is up
                positions[vertexIdx * 3 + 2] = worldZ;

                uvs[vertexIdx * 2 + 0] = i / (currentMapGridWidth - 1);
                uvs[vertexIdx * 2 + 1] = 1.0 - (j / (currentMapGridHeight - 1)); // Flip V for THREE.js convention
            }
        }
        self.postMessage({ type: 'progress', phase: 'mesh', value: 0.3 });

        let indicesIdx = 0;
        for (let j = 0; j < currentMapGridHeight - 1; j++) {
            for (let i = 0; i < currentMapGridWidth - 1; i++) {
                const a = j * currentMapGridWidth + i;
                const b = j * currentMapGridWidth + (i + 1);
                const c = (j + 1) * currentMapGridWidth + i;
                const d = (j + 1) * currentMapGridWidth + (i + 1);
                indices[indicesIdx++] = a; indices[indicesIdx++] = c; indices[indicesIdx++] = b; // Triangle 1: a-c-b
                indices[indicesIdx++] = b; indices[indicesIdx++] = c; indices[indicesIdx++] = d; // Triangle 2: b-c-d
            }
        }
        self.postMessage({ type: 'progress', phase: 'mesh', value: 0.6 });

        // Calculate Normals (Y-up)
        // Using a basic approximation for speed in worker. More robust methods (e.g. THREE.Geometry.computeVertexNormals) are costly here.
        const dx_normal_approx = terrainWorldSize / (currentMapGridWidth > 1 ? currentMapGridWidth - 1 : 1);

        for (let j = 0; j < currentMapGridHeight; j++) {
            for (let i = 0; i < currentMapGridWidth; i++) {
                const vertexIdx = j * currentMapGridWidth + i;

                const hVal = (idx) => positions[idx * 3 + 1]; // Helper to get scaled height

                const hL = hVal((i > 0 ? i - 1 : i) + j * currentMapGridWidth);
                const hR = hVal((i < currentMapGridWidth - 1 ? i + 1 : i) + j * currentMapGridWidth);
                const hD = hVal(i + (j > 0 ? j - 1 : j) * currentMapGridWidth); // Down on grid (smaller Z in world)
                const hU = hVal(i + (j < currentMapGridHeight - 1 ? j + 1 : j) * currentMapGridWidth); // Up on grid (larger Z in world)

                const normVec = new THREE.Vector3(hL - hR, 2 * dx_normal_approx, hD - hU);
                normVec.normalize();

                normals[vertexIdx * 3 + 0] = normVec.x;
                normals[vertexIdx * 3 + 1] = normVec.y;
                normals[vertexIdx * 3 + 2] = normVec.z;
            }
        }
        self.postMessage({ type: 'progress', phase: 'mesh', value: 1.0 });


        // C. Scatter Generation
        const allScatterData = [];
        self.postMessage({ type: 'progress', phase: 'scatter', value: 0.0 });
        const scatterLayersConfig = params.scatter?.scatterLayers || [];
        const terrainWorldProps = {
            worldWidth: terrainWorldSize,
            worldDepth: terrainWorldSize // Assuming square terrain for scatter service
        };

        if (scatterLayersConfig.length > 0) {
            let layersProcessed = 0;
            for (const layerConfig of scatterLayersConfig) {
                if (!layerConfig.enabled) {
                    layersProcessed++;
                    self.postMessage({ type: 'progress', phase: 'scatter', value: layersProcessed / scatterLayersConfig.length });
                    continue;
                }
                try {
                    const points = generateScatterLayerPointsInternal(
                        currentHeightmapArray,
                        currentMapGridWidth,
                        currentMapGridHeight,
                        terrainWorldProps,
                        layerConfig,
                        WORKER_TERRAIN_TYPES
                    );
                    allScatterData.push({ layerName: layerConfig.name, points: points });
                } catch (scatterError) {
                    console.error(`Worker: Error generating scatter layer "${layerConfig.name}":`, scatterError);
                    allScatterData.push({ layerName: layerConfig.name, points: [], error: scatterError.message });
                }
                layersProcessed++;
                self.postMessage({ type: 'progress', phase: 'scatter', value: layersProcessed / scatterLayersConfig.length });
            }
        } else {
             self.postMessage({ type: 'progress', phase: 'scatter', value: 1.0 });
        }


        // D. Post Message Back
        const geometryData = {
            positions: positions.buffer,
            normals: normals.buffer,
            uvs: uvs.buffer,
            indices: indices.buffer
        };
        let workerResultPayload = { geometryData, scatterData: allScatterData }; // allScatterData is now populated
        const transferableObjects = [positions.buffer, normals.buffer, uvs.buffer, indices.buffer];

        if (wasHeightmapGeneratedByWorker && currentHeightmapArray) {
            workerResultPayload.generatedHeightmapData = {
                heightmap: currentHeightmapArray.buffer,
                width: currentMapGridWidth,
                height: currentMapGridHeight,
                minH: currentMinH,
                maxH: currentMaxH
            };
            transferableObjects.push(currentHeightmapArray.buffer);
        }

        self.postMessage({ type: 'done', payload: workerResultPayload }, transferableObjects);

    } else {
        console.error('Unknown action in terrainWorker:', action);
        self.postMessage({ type: 'error', message: `Unknown action: ${action}` });
    }
};