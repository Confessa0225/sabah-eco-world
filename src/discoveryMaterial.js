import * as THREE from 'three'

// Preserve texture patterns and alpha while adding a restrained pastel finish.
export function createDiscoveryMaterial(source, geometry) {
  const material = source.clone()
  if ('roughness' in material) material.roughness = Math.max(source.roughness, 0.85)
  if ('metalness' in material) material.metalness = Math.min(source.metalness, 0.05)
  if ('envMapIntensity' in material) material.envMapIntensity = Math.min(source.envMapIntensity, 0.35)
  const center = new THREE.Vector3()
  const size = new THREE.Vector3(1, 1, 1)
  if (geometry) {
    if (!geometry.boundingBox) geometry.computeBoundingBox()
    geometry.boundingBox.getCenter(center)
    geometry.boundingBox.getSize(size)
  }
  const reveal = { value: 0 }
  material.userData.discoveryReveal = reveal
  material.onBeforeCompile = (shader) => {
    shader.uniforms.discoveryReveal = reveal
    shader.uniforms.modelBrushCenter = { value: center }
    shader.uniforms.modelBrushScale = { value: 1 / (Math.max(size.x, size.y, size.z) || 1) }
    shader.vertexShader = `varying vec3 vModelBrush; uniform vec3 modelBrushCenter; uniform float modelBrushScale;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vModelBrush = (position - modelBrushCenter) * modelBrushScale;
      `)
    shader.fragmentShader = `uniform float discoveryReveal;
      varying vec3 vModelBrush;
      float pastelHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float pastelNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(pastelHash(i), pastelHash(i + vec2(1,0)), f.x),
                   mix(pastelHash(i + vec2(0,1)), pastelHash(i + vec2(1,1)), f.x), f.y);
      }
      ${shader.fragmentShader}`
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        vec3 p = vModelBrush * 9.0;
        float wash = (pastelNoise(p.xy) + pastelNoise(p.yz + 7.0) + pastelNoise(p.zx + 13.0)) / 3.0;
        float detail = 1.0 - smoothstep(0.004, 0.018, length(fwidth(vModelBrush)));
        float grain = (pastelNoise(vModelBrush.xy * 190.0) - 0.5) * detail;
        diffuseColor.rgb *= 0.92 + wash * 0.16 + grain * 0.035;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82), 0.025);
        float discoveryLightness = clamp(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.0, 1.0);
        vec3 discoveryGray = vec3(mix(0.65, 0.95, discoveryLightness));
        diffuseColor.rgb = mix(discoveryGray, diffuseColor.rgb, discoveryReveal);
      `)
      .replace('#include <emissivemap_fragment>', `
        #include <emissivemap_fragment>
        totalEmissiveRadiance *= discoveryReveal;
      `)
  }
  material.customProgramCacheKey = () => 'pastel-discovery-material-v2'
  return material
}
