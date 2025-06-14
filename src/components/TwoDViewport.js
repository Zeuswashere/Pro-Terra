import React, { useState, useRef, useEffect, useCallback } from 'react';

const TwoDViewport = ({
  currentParams, // Global parameters from SettingsPanel/App.js
  heightmapGenerationService, // Instance of HeightmapGenerationService
  erosionService, // Instance of ErosionService
  heightmapDisplayService, // Instance of HeightmapDisplayService
  onHeightmapGenerated, // Callback: (data, width, height, minH, maxH) => void
  initialHeightmapData, // Optional initial heightmap data from App.js
}) => {
  const canvasRef = useRef(null);

  const [heightmapData, setHeightmapData] = useState(initialHeightmapData?.data || null);
  const [originalHeightmapData, setOriginalHeightmapData] = useState(null); // For erosion reset
  const [mapWidth, setMapWidth] = useState(initialHeightmapData?.width || currentParams.meshResolution || 512);
  const [mapHeight, setMapHeight] = useState(initialHeightmapData?.height || currentParams.meshResolution || 512);
  const [minHeight, setMinHeight] = useState(initialHeightmapData?.minHeight || 0);
  const [maxHeight, setMaxHeight] = useState(initialHeightmapData?.maxHeight || 1);
  const [isHeightmapGenerated, setIsHeightmapGenerated] = useState(!!initialHeightmapData);

  const [erosionProgress, setErosionProgress] = useState(0);
  const [isEroding, setIsEroding] = useState(false);

  // Ensure map dimensions are updated if currentParams change before generation
  useEffect(() => {
    if (!isHeightmapGenerated) {
      setMapWidth(currentParams.meshResolution || 512);
      setMapHeight(currentParams.meshResolution || 512);
    }
  }, [currentParams.meshResolution, isHeightmapGenerated]);

  const drawHeightmap = useCallback(() => {
    if (!heightmapData || !canvasRef.current || !heightmapDisplayService) {
      // Clear canvas if no heightmap data
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    try {
      const imageData = heightmapDisplayService.convertHeightmapToImageData(
        heightmapData,
        mapWidth,
        mapHeight,
        { minHeight, maxHeight }
      );
      canvasRef.current.width = mapWidth;
      canvasRef.current.height = mapHeight;
      const ctx = canvasRef.current.getContext('2d');
      ctx.putImageData(imageData, 0, 0);
    } catch (error) {
      console.error('Error drawing heightmap:', error);
    }
  }, [heightmapData, mapWidth, mapHeight, minHeight, maxHeight, heightmapDisplayService]);

  useEffect(() => {
    drawHeightmap();
  }, [drawHeightmap]); // Redraw whenever drawHeightmap function (and its dependencies) change.

  const handleGenerateHeightmap = async () => {
    if (!heightmapGenerationService) {
      console.error("HeightmapGenerationService not available.");
      return;
    }
    console.log("Generating heightmap with params:", currentParams);

    // Use service's default noise parameters if needed, or merge with currentParams
    // For now, assume currentParams contains all necessary generation settings.
    const noise2D = null; // Or generate/get from service if required by generateTerrain
                          // The current HeightmapGenerationService.generateTerrain doesn't strictly need it as a direct input if it creates its own noise sources.

    try {
      // generateTerrain returns { geometry } - we need the raw heightmap array
      // This implies HeightmapGenerationService might need a method that just returns the height data array
      // For now, let's assume there's a method like `generateHeightmapArray` or adapt.
      // The existing `generateTerrain` in HeightmapGenerationService also directly manipulates geometry.
      // We'll need to adjust this interaction.
      // For this component, the primary output is the Float32Array for the heightmap.

      // Placeholder: Simulate generation if service method isn't returning raw array directly
      // In a real scenario, heightmapGenerationService.generateTerrain or a similar method
      // would be adapted to return the raw height data or provide a way to extract it.

      // Let's assume heightmapGenerationService has a method that can return raw heightmap
      // For now, we'll mock this part of the interaction.
      // A more realistic approach would be:
      // const { heightmapArray, width, height, min, max } = await heightmapGenerationService.generateRawHeightmap(currentParams);
      // For now, we'll use the existing generateTerrain and try to extract from its geometry (less ideal)
      // OR, assume generateTerrain can be modified to also return the heightmap array.

      // TEMPORARY MOCK - Replace with actual service call and data extraction
      const tempWidth = currentParams.meshResolution || 512;
      const tempHeight = currentParams.meshResolution || 512;
      const placeholderHeightmap = new Float32Array(tempWidth * tempHeight);
      let minH = 0, maxH = 0;
      // Fill with some pattern for visualization if actual service not wired for raw data yet
      for (let i = 0; i < placeholderHeightmap.length; i++) {
        const x = (i % tempWidth) / tempWidth;
        const y = Math.floor(i / tempWidth) / tempHeight;
        placeholderHeightmap[i] = (Math.sin(x * Math.PI * 4) + Math.cos(y * Math.PI * 4)) * 0.25 + 0.5; // Example pattern
        if (i === 0) { minH = maxH = placeholderHeightmap[i]; }
        else {
            if (placeholderHeightmap[i] < minH) minH = placeholderHeightmap[i];
            if (placeholderHeightmap[i] > maxH) maxH = placeholderHeightmap[i];
        }
      }
      // --- END TEMP MOCK ---

      setHeightmapData(placeholderHeightmap);
      setOriginalHeightmapData(new Float32Array(placeholderHeightmap)); // Save for erosion reset
      setMapWidth(tempWidth);
      setMapHeight(tempHeight);
      setMinHeight(minH);
      setMaxHeight(maxH);
      setIsHeightmapGenerated(true);

      if (onHeightmapGenerated) {
        onHeightmapGenerated(placeholderHeightmap, tempWidth, tempHeight, minH, maxH);
      }
      console.log("Heightmap generation complete (mocked).");

    } catch (error) {
      console.error("Error generating heightmap:", error);
    }
  };

  const handleExportHeightmap = () => {
    if (!canvasRef.current) return;
    const dataURL = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'heightmap.png';
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log("Heightmap exported.");
  };

  // Erosion handlers (stubs for now)
  const handleStartErosion = () => {
    if (!erosionService || !heightmapData) {
        console.error("ErosionService not available or no heightmap.");
        return;
    }
    console.log("Starting erosion...");
    setIsEroding(true);
    // erosionService.initialize(heightmapData, mapWidth, mapHeight, currentParams.erosion); // Or similar params
    // erosionService.onProgress(updateErosionProgress);
    // erosionService.onComplete(handleErosionComplete);
    // erosionService.start();
    // For now, simulate
    setTimeout(() => {
        if (isEroding) { // Check if still "eroding" in case stop was called
             // Simulate some data change
            const newData = new Float32Array(heightmapData.map(h => h * 0.95));
            setHeightmapData(newData);
            // No direct call to onHeightmapGenerated during erosion steps usually,
            // unless App.js needs to sync the 3D view continuously.
            // This might be too performance intensive. Better to update 3D view on erosion completion or specific intervals.
            setErosionProgress(1);
            setIsEroding(false);
            console.log("Erosion complete (simulated).");
        }
    }, 2000);
  };

  const handleStopErosion = () => {
    if (!erosionService) return;
    console.log("Stopping erosion...");
    setIsEroding(false);
    // erosionService.pause();
  };

  const handleResetErosion = () => {
    if (!erosionService || !originalHeightmapData) {
        console.error("ErosionService not available or no original heightmap to reset to.");
        return;
    }
    console.log("Resetting erosion...");
    setHeightmapData(new Float32Array(originalHeightmapData)); // Reset to the state before erosion
    setErosionProgress(0);
    setIsEroding(false);
    // erosionService.reset(originalHeightmapData);
    // Need to inform App.js if the 3D view needs to be reset too
    if (onHeightmapGenerated && originalHeightmapData) {
        // Recalculate min/max for the original data if not stored separately for it
        let minH = originalHeightmapData[0], maxH = originalHeightmapData[0];
        for (let i = 1; i < originalHeightmapData.length; i++) {
            if (originalHeightmapData[i] < minH) minH = originalHeightmapData[i];
            if (originalHeightmapData[i] > maxH) maxH = originalHeightmapData[i];
        }
        onHeightmapGenerated(originalHeightmapData, mapWidth, mapHeight, minH, maxH);
    }
  };

  // Placeholder for erosion progress update from service - these would be implemented
  // when fully wiring up erosionService.onProgress and erosionService.onComplete
  // For now, removing them as they are unused placeholders.


  const viewportStyle = {
    border: '1px solid #ccc',
    width: mapWidth,
    height: mapHeight,
    margin: '10px auto',
    position: 'relative',
  };

  const canvasStyle = {
    display: 'block',
  };

  const buttonContainerStyle = {
    display: 'flex',
    justifyContent: 'center',
    gap: '10px',
    padding: '10px',
    flexWrap: 'wrap',
  };

  return (
    <div>
      <div style={buttonContainerStyle}>
        <button onClick={handleGenerateHeightmap} disabled={!heightmapGenerationService || isEroding}>
          Generate Heightmap
        </button>
        <button onClick={handleExportHeightmap} disabled={!isHeightmapGenerated || isEroding}>
          Export Heightmap (PNG)
        </button>
      </div>
      <div style={buttonContainerStyle}>
        <button onClick={handleStartErosion} disabled={!isHeightmapGenerated || isEroding || !erosionService}>
          Start Erosion
        </button>
        <button onClick={handleStopErosion} disabled={!isEroding || !erosionService}>
          Stop Erosion
        </button>
        <button onClick={handleResetErosion} disabled={!originalHeightmapData || isEroding || !erosionService}>
          Reset Erosion
        </button>
      </div>
      {isEroding && <div>Erosion Progress: {(erosionProgress * 100).toFixed(0)}%</div>}

      <div style={viewportStyle}>
        <canvas ref={canvasRef} style={canvasStyle} />
      </div>
    </div>
  );
};

export default TwoDViewport;
