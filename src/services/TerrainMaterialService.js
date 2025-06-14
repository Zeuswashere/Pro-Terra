import * as THREE from 'three';
import terrainVertexShader from '../shaders/terrain.vert.js';
import terrainFragmentShader from '../shaders/terrain.frag.js';
import waterVertexShader from '../shaders/water.vert.js';
import waterFragmentShader from '../shaders/water.frag.js';

// Texture cache to avoid redundant loads
const textureCache = new Map();

// Default Poly Haven PBR texture URLs
const DEFAULT_ALBEDO_URL = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/brown_mud_leaves_01/brown_mud_leaves_01_diff_4k.jpg';
const DEFAULT_NORMAL_URL = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/brown_mud_leaves_01/brown_mud_leaves_01_nor_gl_4k.jpg';
const DEFAULT_ROUGHNESS_URL = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/brown_mud_leaves_01/brown_mud_leaves_01_rough_4k.jpg';
const DEFAULT_DISPLACEMENT_URL = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/4k/brown_mud_leaves_01/brown_mud_leaves_01_disp_4k.jpg';

export const DefaultTextureURLs = {
    albedo: DEFAULT_ALBEDO_URL,
    normal: DEFAULT_NORMAL_URL,
    roughness: DEFAULT_ROUGHNESS_URL,
    displacement: DEFAULT_DISPLACEMENT_URL,
};

export const DefaultTerrainMaterialParams = {
    heightScale: 0.5,
    rockHeight: 0.6,
    moistureScale: 0.8,
    moistureNoiseScale: 0.05,
    terrainBlendSharpness: 1.5,
    normalStrength: 0.5,
    specularIntensity: 0.3,
    roughness: 0.7,
    detailScale: 0.1,
    microDetailScale: 0.5,
    textureResolution: 1.0,
    gravelIntensity: 0.5,
    gravelScale: 12.0,
    sedimentCurvatureIntensity: 0.5,
    snowHeight: 0.8,
    snowSharpness: 1.0,
    vegetationDensity: 0.7,
    rockVariation: 0.2,
    albedoMap: null, // Will be loaded by default in createTexturedTerrainMaterial
    normalMap: null, // Will be loaded by default
    roughnessMap: null, // Will be loaded by default
    displacementMap: null, // Will be loaded by default
    displacementScale: 0.2, // Note: createTexturedTerrainMaterial overrides this if not in params
    textureScale: 1.0,
    normalMapStrength: 1.0,
    roughnessMultiplier: 1.0,
    albedoIntensity: 0.6,
    // Texture URLs are separate but can be referenced via DefaultTextureURLs
};


/**
 * Loads the default Poly Haven PBR textures for terrain.
 * @returns {Promise<{albedoMap: THREE.Texture, normalMap: THREE.Texture, roughnessMap: THREE.Texture, displacementMap: THREE.Texture}>}
 */
export async function loadDefaultTerrainTextures() {
    const [albedoMap, normalMap, roughnessMap, displacementMap] = await Promise.all([
        loadTexture(DEFAULT_ALBEDO_URL, { repeat: true }),
        loadTexture(DEFAULT_NORMAL_URL, { repeat: true }),
        loadTexture(DEFAULT_ROUGHNESS_URL, { repeat: true }),
        loadTexture(DEFAULT_DISPLACEMENT_URL, { repeat: true })
    ]);
    return { albedoMap, normalMap, roughnessMap, displacementMap };
}

/**
 * Loads the default PBR textures and creates a terrain material with them.
 * @param {object} params - Additional material params (optional)
 * @returns {Promise<THREE.ShaderMaterial>}
 */
export async function createTexturedTerrainMaterial(params = {}) {
    const textures = await loadDefaultTerrainTextures();
    // Ensure that if params provides a displacementScale, it's used, otherwise use the default from DefaultTerrainMaterialParams
    const effectiveDisplacementScale = params.displacementScale !== undefined
        ? params.displacementScale
        : DefaultTerrainMaterialParams.displacementScale;

    return createTerrainMaterial({
        ...DefaultTerrainMaterialParams, // Apply general defaults first
        ...textures,                    // Apply loaded textures
        ...params,                      // Override with specific params
        displacementScale: effectiveDisplacementScale, // Ensure correct displacement scale
    });
}

export const createTerrainMaterial = (params = {}) => {
    // Combine provided params with defaults. Provided params override defaults.
    const effectiveParams = { ...DefaultTerrainMaterialParams, ...params };

    const {
        heightScale,
        rockHeight,
        moistureScale,
        moistureNoiseScale,
        terrainBlendSharpness,
        normalStrength,
        specularIntensity,
        roughness,
        detailScale,
        microDetailScale,
        textureResolution,
        gravelIntensity,
        gravelScale,
        sedimentCurvatureIntensity,
        snowHeight,
        snowSharpness,
        vegetationDensity,
        rockVariation,
        albedoMap,
        normalMap,
        roughnessMap,
        displacementMap,
        displacementScale,
        textureScale,
        normalMapStrength,
        roughnessMultiplier,
        albedoIntensity
    } = effectiveParams;

    // Enable defines if maps are provided
    const defines = {};
    if (albedoMap) defines.USE_ALBEDOMAP = '';
    if (normalMap) defines.USE_NORMALMAP = '';
    if (roughnessMap) defines.USE_ROUGHNESSMAP = '';
    if (displacementMap) defines.USE_DISPLACEMENTMAP = '';

    const material = new THREE.ShaderMaterial({
        uniforms: {
            heightScale: { value: heightScale },
            rockHeight: { value: rockHeight },
            moistureScale: { value: moistureScale },
            moistureNoiseScale: { value: moistureNoiseScale },
            terrainBlendSharpness: { value: terrainBlendSharpness },
            normalStrength: { value: normalStrength },
            specularIntensity: { value: specularIntensity },
            roughness: { value: roughness },
            detailScale: { value: detailScale },
            microDetailScale: { value: microDetailScale },
            textureResolution: { value: textureResolution },
            gravelIntensity: { value: gravelIntensity },
            gravelScale: { value: gravelScale },
            sedimentCurvatureIntensity: { value: sedimentCurvatureIntensity },
            snowHeight: { value: snowHeight },
            snowSharpness: { value: snowSharpness },
            vegetationDensity: { value: vegetationDensity },
            rockVariation: { value: rockVariation },
            albedoMap: { value: albedoMap },
            normalMap: { value: normalMap },
            roughnessMap: { value: roughnessMap },
            displacementMap: { value: displacementMap },
            displacementScale: { value: displacementScale },
            textureScale: { value: textureScale },
            normalMapStrength: { value: normalMapStrength },
            roughnessMultiplier: { value: roughnessMultiplier },
            albedoIntensity: { value: albedoIntensity }
        },
        vertexShader: terrainVertexShader,
        fragmentShader: terrainFragmentShader,
        defines,
        side: THREE.DoubleSide
    });
    return material;
};

export const DefaultWaterParams = {
    waterLevel: 0.0,
    waterColor: new THREE.Color(0x0077be), // Store as THREE.Color object
    segments: 32,
    useLOD: true,
    waterOpacity: 0.4,
};

export const createWaterPlane = (size, params = {}) => {
    const effectiveParams = { ...DefaultWaterParams, ...params };

    // Ensure waterColor is a THREE.Color object if provided as string/hex
    if (typeof effectiveParams.waterColor === 'string' || typeof effectiveParams.waterColor === 'number') {
        effectiveParams.waterColor = new THREE.Color(effectiveParams.waterColor);
    } else if (Array.isArray(effectiveParams.waterColor) && effectiveParams.waterColor.length === 3) {
        // Assuming array is [r, g, b] normalized 0-1
        effectiveParams.waterColor = new THREE.Color(effectiveParams.waterColor[0], effectiveParams.waterColor[1], effectiveParams.waterColor[2]);
    }


    const {
        waterLevel,
        waterColor, // Now guaranteed to be a THREE.Color object or default
        segments,
        useLOD,
        waterOpacity
    } = effectiveParams;

    const createWaterGeometry = (segments) => new THREE.PlaneGeometry(size, size, segments, segments);
    const clippingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -waterLevel + 0.01);

    const waterMaterial = new THREE.ShaderMaterial({
        uniforms: {
            waterColor: { value: waterColor.toArray() }, // Use the processed THREE.Color object
            waterOpacity: { value: waterOpacity }
        },
        vertexShader: waterVertexShader,
        fragmentShader: waterFragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        clippingPlanes: [clippingPlane],
        clipShadows: true,
        depthWrite: false,
        depthTest: true
    });

    let waterPlane;
    if (useLOD) {
        const lod = new THREE.LOD();
        const highDetail = new THREE.Mesh(createWaterGeometry(segments), waterMaterial);
        highDetail.rotation.x = -Math.PI / 2;
        highDetail.position.y = waterLevel;
        highDetail.renderOrder = 0;
        lod.addLevel(highDetail, 0);
        waterPlane = lod;
    } else {
        waterPlane = new THREE.Mesh(createWaterGeometry(segments), waterMaterial);
        waterPlane.rotation.x = -Math.PI / 2;
        waterPlane.position.y = waterLevel;
        waterPlane.renderOrder = 0;
    }

    return waterPlane;
};

export const loadTexture = async (url, options = {}) => {
    if (textureCache.has(url)) {
        return textureCache.get(url);
    }
    const {
        repeat = true,
        anisotropy = 4,
        minFilter = THREE.LinearMipMapLinearFilter,
        magFilter = THREE.LinearFilter
    } = options;
    const textureLoader = new THREE.TextureLoader();
    return new Promise((resolve, reject) => {
        textureLoader.load(
            url,
            (texture) => {
                if (repeat) {
                    texture.wrapS = THREE.RepeatWrapping;
                    texture.wrapT = THREE.RepeatWrapping;
                }
                texture.anisotropy = anisotropy;
                texture.minFilter = minFilter;
                texture.magFilter = magFilter;
                texture.needsUpdate = true;
                textureCache.set(url, texture); // Cache the loaded texture
                resolve(texture);
            },
            undefined,
            (error) => {
                console.error('Error loading texture:', error);
                reject(error);
            }
        );
    });
}; 