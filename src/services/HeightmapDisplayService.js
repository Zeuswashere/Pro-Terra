/**
 * @file HeightmapDisplayService.js
 * Service responsible for converting heightmap data into ImageData for 2D canvas display.
 */

/**
 * Converts a Float32Array heightmap into an ImageData object for canvas rendering.
 *
 * @param {Float32Array} heightmap - The raw heightmap data.
 * @param {number} width - The width of the heightmap.
 * @param {number} height - The height of the heightmap.
 * @param {object} [options={}] - Optional parameters.
 * @param {number} [options.minHeight] - Manually specified minimum height for normalization.
 *                                       If not provided, it's calculated from the heightmap.
 * @param {number} [options.maxHeight] - Manually specified maximum height for normalization.
 *                                       If not provided, it's calculated from the heightmap.
 * @param {string} [options.colormap] - (Future use) Specifies a colormap for rendering.
 *                                      Currently defaults to grayscale.
 * @returns {ImageData} The ImageData object ready to be put onto a canvas.
 * @throws {Error} If heightmap is empty or width/height are invalid.
 */
export function convertHeightmapToImageData(heightmap, width, height, options = {}) {
  if (!heightmap || heightmap.length === 0) {
    throw new Error('Heightmap data is empty or invalid.');
  }
  if (width <= 0 || height <= 0) {
    throw new Error('Width and height must be positive integers.');
  }
  if (heightmap.length !== width * height) {
    throw new Error('Heightmap length does not match width * height.');
  }

  let minH = options.minHeight;
  let maxH = options.maxHeight;

  if (minH === undefined || maxH === undefined) {
    minH = heightmap[0];
    maxH = heightmap[0];
    for (let i = 1; i < heightmap.length; i++) {
      if (heightmap[i] < minH) minH = heightmap[i];
      if (heightmap[i] > maxH) maxH = heightmap[i];
    }
  }

  // Handle cases where map is flat
  if (minH === maxH) {
    maxH = minH + 1; // Avoid division by zero, render as flat black or some default
  }

  const imageData = new ImageData(width, height);
  const data = imageData.data; // Uint8ClampedArray: R, G, B, A values

  for (let i = 0; i < heightmap.length; i++) {
    const heightValue = heightmap[i];
    // Normalize heightValue to 0-1 range
    const normalizedHeight = (heightValue - minH) / (maxH - minH);
    // Scale to 0-255 for grayscale color
    const colorValue = Math.floor(normalizedHeight * 255);

    const pixelIdx = i * 4; // Each pixel has 4 components (R,G,B,A)
    data[pixelIdx] = colorValue;     // R
    data[pixelIdx + 1] = colorValue; // G
    data[pixelIdx + 2] = colorValue; // B
    data[pixelIdx + 3] = 255;        // A (opaque)
  }

  return imageData;
}

// Example usage (for testing or demonstration):
/*
function drawHeightmapToCanvas(canvasId, heightmap, width, height, options) {
  try {
    const imageData = convertHeightmapToImageData(heightmap, width, height, options);
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error(`Canvas with ID "${canvasId}" not found.`);
      return;
    }
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Failed to get 2D context from canvas.');
      return;
    }
    ctx.putImageData(imageData, 0, 0);
    console.log('Heightmap drawn to canvas.');
  } catch (error) {
    console.error('Error drawing heightmap:', error);
  }
}
*/
