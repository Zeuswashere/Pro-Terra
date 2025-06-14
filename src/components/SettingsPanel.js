import React from 'react';
import PropTypes from 'prop-types';
import ParameterControl from './ParameterControl';
import { FaMountain, FaSlidersH, FaWater, FaLeaf, FaLayerGroup, FaEraser, FaMagic, FaPalette } from 'react-icons/fa';
import ScatterLayerCard from './ScatterLayerCard';

// eslint-disable-next-line no-unused-vars
const SettingsPanel = React.memo(({ params, onParamChange, onReset, defaultScatterLayerParams }) => {
  const handleParamChange = (key, value) => {
    onParamChange(key, value);
  };

  const sectionIcons = {
    'Terrain Shape': <FaSlidersH style={{ marginRight: 8, color: '#6ec1e4' }} />,
    'Elevation': <FaMountain style={{ marginRight: 8, color: '#e4b06e' }} />,
    'Ridged Noise': <FaMagic style={{ marginRight: 8, color: '#b06ee4' }} />,
    'Domain Warping': <FaLayerGroup style={{ marginRight: 8, color: '#6ee4b0' }} />,
    'Erosion': <FaEraser style={{ marginRight: 8, color: '#e46e6e' }} />,
    'Smoothing': <FaLeaf style={{ marginRight: 8, color: '#6ee4b0' }} />,
    'Surface & Texture': <FaPalette style={{ marginRight: 8, color: '#e46ec1' }} />,
    'Water': <FaWater style={{ marginRight: 8, color: '#6ec1e4' }} />,
    'Scatter Layers': <FaLayerGroup style={{ marginRight: 8, color: '#e4b06e' }} />
  };

  // Memoize options arrays
  const erosionTypeOptions = React.useMemo(() => [
    { value: 'thermal', label: 'Thermal' },
    { value: 'hydraulic', label: 'Hydraulic' },
    { value: 'both', label: 'Both' }
  ], []);

  const CollapsibleSection = ({ title, children, defaultOpen = true }) => {
    const [open, setOpen] = React.useState(defaultOpen);
    return (
      <div style={{
        marginBottom: 18,
        borderRadius: 12,
        background: 'rgba(40,40,50,0.97)',
        boxShadow: open ? '0 2px 12px 0 rgba(0,0,0,0.10)' : 'none',
        border: open ? '1.5px solid #444' : '1.5px solid #333',
        transition: 'box-shadow 0.2s, border 0.2s',
        overflow: 'hidden'
      }}>
        <div
          onClick={() => setOpen(o => !o)}
          style={{
            display: 'flex', alignItems: 'center', cursor: 'pointer',
            padding: '14px 18px', fontWeight: 600, fontSize: 17,
            background: open ? 'linear-gradient(90deg, #23243a 60%, #23243a00)' : 'rgba(35,36,58,0.7)',
            color: open ? '#fff' : '#aaa',
            borderBottom: open ? '1px solid #333' : 'none',
            userSelect: 'none',
            letterSpacing: 0.2
          }}
        >
          {sectionIcons[title]}
          {title}
          <span style={{ marginLeft: 'auto', fontSize: 18, color: '#6ec1e4', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
        </div>
        <div style={{ display: open ? 'block' : 'none', padding: '18px 18px 8px 18px' }}>
          {children}
        </div>
      </div>
    );
  };

  // Helper to update a scatter layer property
  const updateScatterLayer = (layers, idx, changes) => {
    const newLayers = layers.slice();
    newLayers[idx] = { ...newLayers[idx], ...changes };
    return newLayers;
  };

  return (
    <div
      ref={panelRef => {
        if (panelRef) {
          // Restore scroll position after render
          if (typeof window !== 'undefined' && window.__settingsPanelScroll !== undefined) {
            panelRef.scrollTop = window.__settingsPanelScroll;
          }
        }
      }}
      onScroll={e => {
        if (typeof window !== 'undefined') {
          window.__settingsPanelScroll = e.currentTarget.scrollTop;
        }
      }}
      style={{
        width: 'min(98vw, 340px)',
        minWidth: 240,
        maxWidth: 400,
        height: '100vh',
        padding: 0,
        background: 'linear-gradient(160deg, #23243a 0%, #23243a 60%, #23243aee 100%)',
        overflowY: 'auto',
        borderRight: '1.5px solid #333',
        fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
        fontSize: 15,
        color: '#f3f3f3',
        boxShadow: '2px 0 16px 0 rgba(0,0,0,0.10)',
        position: 'relative',
        zIndex: 10
      }}
    >
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'linear-gradient(90deg, #23243a 80%, #23243a00)',
        padding: '22px 20px 10px 20px',
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1.5px solid #333',
        marginBottom: 8
      }}>
        <h2 style={{ margin: 0, fontWeight: 800, fontSize: 22, letterSpacing: 0.5, color: '#6ec1e4', flex: 1 }}>Terrain Settings</h2>
        <button
          onClick={onReset}
          style={{
            padding: '7px 14px',
            background: 'linear-gradient(90deg, #444 60%, #6ec1e4 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: 14,
            marginLeft: 8,
            boxShadow: '0 2px 8px 0 rgba(110,193,228,0.08)',
            transition: 'background 0.2s, box-shadow 0.2s',
          }}
          onMouseOver={e => e.currentTarget.style.background = 'linear-gradient(90deg, #6ec1e4 60%, #444 100%)'}
          onMouseOut={e => e.currentTarget.style.background = 'linear-gradient(90deg, #444 60%, #6ec1e4 100%)'}
        >
          Reset
        </button>
      </div>

      <div style={{ padding: '0 8px 32px 8px' }}>
        {/* Assuming 'params' directly contains these generation settings based on App.js initialAppSettings structure */}
        <CollapsibleSection title="Terrain Shape">
          <ParameterControl label="Size" type="range" min="2" max="100" step="1" value={params.size} onChange={v => handleParamChange('size', +v)} description="Controls the world size of the terrain." />
          <ParameterControl label="Mesh Resolution" type="range" min="32" max="1024" step="32" value={params.meshResolution || 512} onChange={v => handleParamChange('meshResolution', +v)} description="Resolution of the underlying heightmap grid." />
          {/* 'useExportResolution' might be a local UI state or a specific app feature not directly part of core params */}
          {/* <ParameterControl label="Use Export Resolution" type="checkbox" value={params.useExportResolution || false} onChange={v => handleParamChange('useExportResolution', v)} description="Toggle to preview at full export resolution (4096²)." /> */}
        </CollapsibleSection>
        <CollapsibleSection title="Elevation">
          <ParameterControl label="Amplitude" type="range" min="0" max="5" step="0.1" value={params.amplitude} onChange={v => handleParamChange('amplitude', +v)} description="Maximum elevation difference." />
          <ParameterControl label="Octaves" type="range" min="1" max="12" step="1" value={params.octaves} onChange={v => handleParamChange('octaves', +v)} />
          <ParameterControl label="Lacunarity" type="range" min="1" max="4" step="0.1" value={params.lacunarity} onChange={v => handleParamChange('lacunarity', +v)} />
          <ParameterControl label="Gain" type="range" min="0" max="1" step="0.05" value={params.gain} onChange={v => handleParamChange('gain', +v)} />
          <ParameterControl label="Frequency" type="range" min="0.01" max="1.0" step="0.01" value={params.frequency} onChange={v => handleParamChange('frequency', +v)} description="Initial noise frequency." />
          <ParameterControl label="Seed" type="number" min="0" max="999999" step="1" value={params.seed} onChange={v => handleParamChange('seed', +v)} />
        </CollapsibleSection>
        <CollapsibleSection title="Ridged Noise" defaultOpen={false}>
          {/* Assuming 'ridged' is a root param if it's not in HeightmapDefaultParams from the service */}
          <ParameterControl label="Enable Ridged Noise" type="checkbox" value={params.ridged || false} onChange={v => handleParamChange('ridged', v)} />
          <ParameterControl label="Ridged Offset" type="range" min="0" max="1" step="0.1" value={params.ridgedOffset} onChange={v => handleParamChange('ridgedOffset', +v)} />
        </CollapsibleSection>
        <CollapsibleSection title="Worley Noise" defaultOpen={false}>
          <ParameterControl 
            label="Points" 
            type="range" 
            min="8"
            max="1024"
            step="8"
            value={params.worleyPoints || 256} // From GenDefaults
            onChange={v => handleParamChange('worleyPoints', +v)} 
            description="Number of points for Worley noise generation." 
          />
          {/* Assuming worleySeed, worleyWeight, worleyDimension are root params if custom */}
          <ParameterControl 
            label="Seed" 
            type="number" 
            min="0" 
            max="999999" 
            step="1" 
            value={params.worleySeed || 0} // From GenDefaults (was missing, added to App.js initialAppSettings)
            onChange={v => handleParamChange('worleySeed', +v)} 
            description="Seed for Worley noise randomization." 
          />
          {/* <ParameterControl label="Weight" type="range" min="0" max="1" step="0.1" value={params.worleyWeight || 0.5} onChange={v => handleParamChange('worleyWeight', +v)} /> */}
          {/* <ParameterControl label="Dimension" type="range" min="1" max="3" step="1" value={params.worleyDimension || 2} onChange={v => handleParamChange('worleyDimension', +v)} /> */}
        </CollapsibleSection>
        <CollapsibleSection title="Domain Warping" defaultOpen={false}>
          {/* Assuming useDomainWarp & warpType are root params if custom */}
          {/* <ParameterControl label="Use Domain Warp" type="checkbox" value={params.useDomainWarp || false} onChange={v => handleParamChange('useDomainWarp', v)} /> */}
          {/* <ParameterControl label="Warp Type" type="select" value={params.warpType || 'fractal'} onChange={v => handleParamChange('warpType', v)} options={[ { value: 'fractal', label: 'Fractal' }, { value: 'simplex', label: 'Simplex' } ]} /> */}
          <ParameterControl label="Domain Warp Strength" type="range" min="0" max="1" step="0.05" value={params.domainWarpStrength} onChange={v => handleParamChange('domainWarpStrength', +v)} />
          <ParameterControl label="Domain Warp Frequency" type="range" min="0.01" max="0.5" step="0.01" value={params.domainWarpFreq} onChange={v => handleParamChange('domainWarpFreq', +v)} />
          {/* <ParameterControl label="Warp Iterations" type="range" min="1" max="5" step="1" value={params.warpIterations || 3} onChange={v => handleParamChange('warpIterations', +v)} /> */}
        </CollapsibleSection>
        <CollapsibleSection title="Smoothing" defaultOpen={false}>
          {/* Assuming applySmoothing, smoothIterations, smoothFactor are root params if custom */}
          {/* <ParameterControl label="Enable Smoothing" type="checkbox" value={params.applySmoothing || false} onChange={v => handleParamChange('applySmoothing', v)} /> */}
          {/* <ParameterControl label="Smoothing Passes" type="range" min="0" max="10" step="1" value={params.smoothIterations || 1} onChange={v => handleParamChange('smoothIterations', +v)} /> */}
          {/* <ParameterControl label="Smoothing Strength" type="range" min="0" max="1" step="0.05" value={params.smoothFactor || 0.5} onChange={v => handleParamChange('smoothFactor', +v)} /> */}
        </CollapsibleSection>
        <CollapsibleSection title="Surface & Texture">
          <ParameterControl label="Height Scale" type="range" min={0.1} max={5.0} step={0.1} value={params.material?.heightScale} onChange={v => handleParamChange('material.heightScale', +v)} description="Controls the exaggeration of height in the procedural texture." />
          <ParameterControl label="Rock Height" type="range" min={0.1} max={1.0} step={0.1} value={params.material?.rockHeight} onChange={v => handleParamChange('material.rockHeight', +v)} description="Height at which rock texture appears." />
          <ParameterControl label="Blend Sharpness" type="range" min={0.1} max={5.0} step={0.1} value={params.material?.terrainBlendSharpness} onChange={v => handleParamChange('material.terrainBlendSharpness', +v)} description="How sharp the transitions are between procedural textures." />
          <ParameterControl label="Moisture Scale" type="range" min={0.1} max={5.0} step={0.1} value={params.material?.moistureScale} onChange={v => handleParamChange('material.moistureScale', +v)} description="Controls the amount of green (vegetation) in the procedural texture." />
          <ParameterControl label="Moisture Noise" type="range" min={0.01} max={1.0} step={0.01} value={params.material?.moistureNoiseScale} onChange={v => handleParamChange('material.moistureNoiseScale', +v)} description="Adds randomness to the moisture map for procedural texture." />
          <ParameterControl label="Texture Resolution" type="range" min={0.5} max={6.0} step={0.1} value={params.material?.textureResolution || 1.0} onChange={v => handleParamChange('material.textureResolution', +v)} description="Controls the detail scale of procedural textures." />
          <ParameterControl label="Albedo Intensity" type="range" min={0} max={1} step={0.01} value={params.material?.albedoIntensity || 0.6} onChange={v => handleParamChange('material.albedoIntensity', +v)} description="Blend between procedural color and texture map color (if texture map provided)." />
          {/* Texture map URL controls could be added here if desired, e.g., params.material.albedoMapUrl */}
          <ParameterControl label="Texture Scale" type="range" min={1.0} max={100.0} step={1.0} value={params.material?.textureScale || 20.0} onChange={v => handleParamChange('material.textureScale', +v)} description="Scale of applied PBR textures." />
          <ParameterControl label="Normal Map Strength" type="range" min={0.0} max={2.0} step={0.05} value={params.material?.normalMapStrength || 1.0} onChange={v => handleParamChange('material.normalMapStrength', +v)} />
          <ParameterControl label="Displacement Scale" type="range" min={0.0} max={0.5} step={0.001} value={params.material?.displacementScale || 0.02} onChange={v => handleParamChange('material.displacementScale', +v)} />
          <ParameterControl label="Roughness Multiplier" type="range" min={0.0} max={2.0} step={0.05} value={params.material?.roughnessMultiplier || 1.0} onChange={v => handleParamChange('material.roughnessMultiplier', +v)} />

        </CollapsibleSection>
        <CollapsibleSection title="Water" defaultOpen={false}>
          <ParameterControl label="Enable Water" type="checkbox" value={params.water?.enableWater || false} onChange={v => handleParamChange('water.enableWater', v)} description="Add a water plane." />
          <ParameterControl label="Water Level" type="range" min={0} max={1} step={0.01} value={params.water?.waterLevel || 0} onChange={v => handleParamChange('water.waterLevel', +v)} description="Height of the water plane (relative to base, affected by Height Scale)." />
          <ParameterControl label="Water Opacity" type="range" min={0} max={1} step={0.01} value={params.water?.waterOpacity || 0.4} onChange={v => handleParamChange('water.waterOpacity', +v)} />
          {/* Water color could be a color picker component if available, or simple text input for hex */}
          {/* <ParameterControl label="Water Color" type="text" value={params.water?.waterColor.getHexString() || '#0077be'} onChange={v => handleParamChange('water.waterColor', v)} /> */}
        </CollapsibleSection>
        <CollapsibleSection title="Scatter Layers">
          {(() => {
            const currentScatterParams = params.scatter || { scatterLayers: [] };
            const scatterLayers = Array.isArray(currentScatterParams.scatterLayers) ? currentScatterParams.scatterLayers : [];
            return scatterLayers.map((layer, idx) => (
              <ScatterLayerCard
                key={layer.id || idx} // Ensure key is stable, use idx as fallback
                layer={layer}
                idx={idx}
                // layers prop for ScatterLayerCard should receive the current array for its own logic
                layers={scatterLayers}
                // onParamChange for ScatterLayerCard needs to be specific about its path
                // This means ScatterLayerCard's internal onParamChange needs to prepend `scatter.scatterLayers.${idx}`
                // For simplicity here, we assume ScatterLayerCard calls a specific update function
                // that provides the full new layer object or changes.
                // The existing updateScatterLayer helper in SettingsPanel is good.
                // It gets called by ScatterLayerCard, then SettingsPanel calls the main onParamChange.
                onLayerChange={(layerIndex, updatedLayer) => {
                  const newLayers = scatterLayers.slice();
                  newLayers[layerIndex] = updatedLayer;
                  handleParamChange('scatter.scatterLayers', newLayers);
                }}
                onLayerRemove={(layerIndex) => {
                  const newLayers = scatterLayers.filter((_, i) => i !== layerIndex);
                  handleParamChange('scatter.scatterLayers', newLayers);
                }}
                // updateScatterLayer helper is used internally by ScatterLayerCard or similar logic
                // For now, let's assume ScatterLayerCard is modified to call onLayerChange/onLayerRemove
                // Or, if ScatterLayerCard calls onParamChange with 'scatterLayers' and the full new array, that's also fine.
                // The provided `updateScatterLayer` helper seems designed for this:
                onParamChange={(layerProp, value, layerIdx) => { // This is what ScatterLayerCard might call
                    const changedLayer = { ...scatterLayers[layerIdx], [layerProp]: value };
                    const newLayersArray = updateScatterLayer(scatterLayers, layerIdx, changedLayer);
                    handleParamChange('scatter.scatterLayers', newLayersArray);
                }}
                // The line below is if ScatterLayerCard uses the updateScatterLayer prop directly
                // updateScatterLayer={(idx, changes) => handleParamChange('scatter.scatterLayers', updateScatterLayer(scatterLayers, idx, changes))}
                params={params} // Pass root params for context if needed
              />
            ));
          })()}
          <div style={{ position: 'relative', marginTop: 8 }}>
            <button
              onClick={() => {
                const currentScatterParams = params.scatter || { scatterLayers: [] };
                const scatterLayers = Array.isArray(currentScatterParams.scatterLayers) ? currentScatterParams.scatterLayers : [];
                const nextId = scatterLayers.length > 0 ? Math.max(0, ...scatterLayers.map(l => l.id || 0)) + 1 : 1;

                // Use defaultScatterLayerParams prop, ensuring a deep copy
                const newLayer = defaultScatterLayerParams
                  ? JSON.parse(JSON.stringify(defaultScatterLayerParams))
                  : {}; // Fallback to empty if prop not provided

                newLayer.id = nextId;
                newLayer.name = `Layer ${nextId}`; // Ensure name is updated
                if (defaultScatterLayerParams && !newLayer.objectType) newLayer.objectType = defaultScatterLayerParams.objectType || 'tree_1';


                handleParamChange('scatter.scatterLayers', [...scatterLayers, newLayer]);
              }}
              style={{
                position: 'absolute',
                right: 0,
                bottom: -16,
                background: 'linear-gradient(90deg, #6ec1e4 60%, #e4b06e 100%)',
                color: '#23243a',
                border: 'none',
                borderRadius: '50%',
                width: 44,
                height: 44,
                fontSize: 28,
                fontWeight: 900,
                boxShadow: '0 2px 8px 0 rgba(110,193,228,0.18)',
                cursor: 'pointer',
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s, box-shadow 0.2s',
              }}
              title="Add Scatter Layer"
            >
              +
            </button>
          </div>
        </CollapsibleSection>
        <CollapsibleSection title="Erosion">
          <ParameterControl label="Erosion Droplets" type="number" min={1000} max={1000000} step={1000} value={params.erosionDroplets || 100000} onChange={v => handleParamChange('erosionDroplets', +v)} description="Number of droplets to simulate." />
          <ParameterControl label="Batch Size" type="number" min={100} max={10000} step={100} value={params.erosionBatchSize || 1000} onChange={v => handleParamChange('erosionBatchSize', +v)} description="Update mesh every N droplets." />
          <ParameterControl label="Inertia" type="range" min={0} max={1} step={0.01} value={params.erosionInertia ?? 0.05} onChange={v => handleParamChange('erosionInertia', +v)} description="Droplet inertia (0 = follows slope, 1 = keeps direction)." />
          <ParameterControl label="Friction" type="range" min={0} max={0.2} step={0.001} value={params.erosionFriction ?? 0.02} onChange={v => handleParamChange('erosionFriction', +v)} description="Velocity loss per step." />
          <ParameterControl label="Sediment Capacity" type="range" min={0.1} max={16} step={0.1} value={params.erosionSedimentCapacity ?? 4} onChange={v => handleParamChange('erosionSedimentCapacity', +v)} description="Sediment capacity factor." />
          <ParameterControl label="Deposition Rate" type="range" min={0.01} max={1} step={0.01} value={params.erosionDepositionRate ?? 0.3} onChange={v => handleParamChange('erosionDepositionRate', +v)} description="How quickly sediment is deposited/eroded." />
          <ParameterControl label="Evaporation Rate" type="range" min={0.001} max={0.2} step={0.001} value={params.erosionEvaporationRate ?? 0.01} onChange={v => handleParamChange('erosionEvaporationRate', +v)} description="Water evaporation rate per step." />
          <ParameterControl label="Min Volume" type="range" min={0.001} max={0.2} step={0.001} value={params.erosionMinVolume ?? 0.01} onChange={v => handleParamChange('erosionMinVolume', +v)} description="Volume below which droplet disappears." />
          <ParameterControl label="Initial Volume" type="range" min={0.1} max={5} step={0.1} value={params.erosionInitialVolume ?? 0.1} onChange={v => handleParamChange('erosionInitialVolume', +v)} description="Starting water volume of each droplet." />
          <ParameterControl label="Initial Speed" type="range" min={0.1} max={5} step={0.1} value={params.erosionInitialSpeed ?? 1.0} onChange={v => handleParamChange('erosionInitialSpeed', +v)} description="Starting speed of each droplet." />
            <ParameterControl label="Max Droplet Lifetime" type="number" min={1} max={100} step={1} value={params.erosion?.maxDropletLifetime ?? 30} onChange={v => handleParamChange('erosion.maxDropletLifetime', +v)} description="Max steps per droplet." />
            {/* Erosion action buttons and progress display are removed from SettingsPanel */}
        </CollapsibleSection>
      </div>
    </div>
  );
});

SettingsPanel.propTypes = {
    params: PropTypes.object.isRequired, // Updated to generic object, specific shape is now complex due to nesting
  onParamChange: PropTypes.func.isRequired,
    onReset: PropTypes.func.isRequired,
    defaultScatterLayerParams: PropTypes.object, // Prop for scatter defaults
};

SettingsPanel.displayName = 'SettingsPanel';

export default SettingsPanel; 