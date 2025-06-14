const terrainVertexShader = [
"varying vec3 vWorldPosition;",
"varying vec3 vNormal;",
"varying vec3 vViewPosition;",
"varying vec3 vDisplacedPosition;",
"varying float vSlope;",
"varying vec2 vUv;",
"varying vec3 vTangent;",
"varying vec3 vBitangent;",
"uniform sampler2D displacementMap;",
"uniform float displacementScale;",
"uniform float textureScale;",
"void main() {",
"    vNormal = normalize(normalMatrix * normal);",
"    vec4 worldPosition = modelMatrix * vec4(position, 1.0);",
"    vWorldPosition = worldPosition.xyz;",
"    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);",
"    vViewPosition = -mvPosition.xyz;",
"    vDisplacedPosition = worldPosition.xyz;",
"    vSlope = 1.0 - abs(vNormal.y);",
"    vUv = uv;",
"    vec3 tangent = normalize(vec3(modelMatrix * vec4(1.0, 0.0, 0.0, 0.0)));",
"    vec3 bitangent = normalize(vec3(modelMatrix * vec4(0.0, 0.0, 1.0, 0.0)));",
"    vTangent = tangent;",
"    vBitangent = bitangent;",
"#ifdef USE_DISPLACEMENTMAP",
"    float disp = texture2D(displacementMap, uv * textureScale).r;",
"    vec3 displaced = position + normal * (disp * displacementScale);",
"    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);",
"#else",
"    gl_Position = projectionMatrix * mvPosition;",
"#endif",
"}",
].join('\n');
export default terrainVertexShader; 