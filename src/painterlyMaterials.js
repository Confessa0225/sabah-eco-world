// Procedural brush washes: no texture downloads or full-screen postprocessing.
const time = { value: 0 }
const daylight = { value: 1 }
const cloudCover = { value: 0.2 }

const noise = `
  float brushHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float brushNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(brushHash(i), brushHash(i + vec2(1, 0)), f.x),
               mix(brushHash(i + vec2(0, 1)), brushHash(i + vec2(1, 1)), f.x), f.y);
  }
  float brushWash(vec2 p) {
    return brushNoise(p) * 0.57 + brushNoise(p * 2.13 + 7.3) * 0.28
      + brushNoise(p * 4.37 + 19.1) * 0.15;
  }
`

const brushes = {
  ground: `
    vec2 p = vBrushPosition.xz;
    float wash = brushWash(p * 0.38);
    float strokes = brushNoise(p * vec2(1.8, 5.5) + wash * 2.0);
    // Fade fine pigment at a distance to prevent crawling/shimmering in the aerial view.
    float detail = 1.0 - smoothstep(0.08, 0.45, length(fwidth(p)));
    float paper = (brushNoise(p * 38.0) - 0.5) * detail;
    diffuseColor.rgb *= 0.89 + wash * 0.2 + (strokes - 0.5) * 0.09 * detail + paper * 0.035;
    float dryBrush = smoothstep(0.57, 0.8, strokes) * 0.07 * detail;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.83), dryBrush);
  `,
  water: `
    vec2 p = vBrushPosition.xz;
    float wash = brushWash(p * 0.7 + vec2(brushTime * 0.045, 0.0));
    float phase = p.x * 3.8 + p.y * 1.6 + wash * 5.0 - brushTime * 0.8;
    float width = max(fwidth(phase), 0.07);
    float wave = smoothstep(0.83 - width, 0.96 + width, sin(phase));
    float brokenStroke = smoothstep(0.4, 0.7, brushNoise(p * vec2(0.8, 2.4)));
    float detail = 1.0 - smoothstep(0.4, 1.8, width);
    diffuseColor.rgb *= 0.9 + wash * 0.2;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92), wave * brokenStroke * detail * 0.3);
  `,
  sky: `
    vec3 direction = normalize(vBrushPosition);
    vec2 p = direction.xz / (0.7 + max(direction.y, 0.0));
    float wash = brushWash(p * 3.6 + vec2(brushTime * 0.003, 0.0));
    float veil = smoothstep(0.48 - brushCloudCover * 0.17, 0.76, wash);
    veil *= smoothstep(-0.05, 0.22, direction.y);
    float paper = brushNoise(p * vec2(90.0, 180.0)) - 0.5;
    diffuseColor.rgb *= 0.97 + wash * 0.06 + paper * 0.012;
    vec3 cloudColor = mix(diffuseColor.rgb * 1.18, vec3(0.94, 0.91, 0.84), brushDaylight);
    diffuseColor.rgb = mix(diffuseColor.rgb, cloudColor, veil * mix(0.22, 0.65, brushCloudCover));
  `
}

export function applyPainterlyMaterial(material, kind) {
  if (!brushes[kind]) throw new Error(`Unknown brush style: ${kind}`)
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, { brushTime: time, brushDaylight: daylight, brushCloudCover: cloudCover })
    shader.vertexShader = `varying vec3 vBrushPosition;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vBrushPosition = ${kind === 'sky' ? 'position' : '(modelMatrix * vec4(transformed, 1.0)).xyz'};
      `)
    shader.fragmentShader = `varying vec3 vBrushPosition;
      uniform float brushTime;
      uniform float brushDaylight;
      uniform float brushCloudCover;
      ${noise}\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>\n${brushes[kind]}`)
  }
  material.customProgramCacheKey = () => `painterly-${kind}-v1`
  material.needsUpdate = true
  return material
}

export function updatePainterlyEnvironment(delta, dayFactor, weather) {
  time.value += delta
  daylight.value = dayFactor
  const target = weather === 'sunny' ? 0.15 : weather === 'storm' ? 1 : 0.75
  cloudCover.value += (target - cloudCover.value) * (1 - Math.exp(-delta * 0.8))
}
