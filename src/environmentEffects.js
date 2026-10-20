import * as THREE from 'three'

// Fade the close-range weather away early in the ascent and restore it on descent.
export function overviewVisibility(cameraY, startY, overviewY, active) {
  if (!active || overviewY <= startY) return 0
  return THREE.MathUtils.smoothstep((cameraY - startY) / (overviewY - startY), 0, 0.3)
}

export function overviewFog(near, far, mapDistance, visibility) {
  const clearNear = Math.max(near, mapDistance * 1.08)
  const clearFar = Math.max(far, clearNear + Math.max(80, mapDistance * 0.5))
  return {
    near: THREE.MathUtils.lerp(near, clearNear, visibility),
    far: THREE.MathUtils.lerp(far, clearFar, visibility)
  }
}

export function starVisibility(dayFactor, clarity) {
  return (1 - THREE.MathUtils.smoothstep(dayFactor, 0.04, 0.4)) * clarity
}

export function createStarField(radius = 450) {
  const count = 1400
  const positions = new Float32Array(count * 3)
  const colors = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const phases = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const height = 0.06 + Math.random() * 0.94
    const angle = Math.random() * Math.PI * 2
    const horizontal = Math.sqrt(1 - height * height)
    positions.set([Math.cos(angle) * horizontal * radius, height * radius, Math.sin(angle) * horizontal * radius], i * 3)
    const warmth = Math.random()
    colors.set(warmth < 0.2 ? [1, 0.88, 0.72] : warmth > 0.8 ? [0.76, 0.87, 1] : [0.94, 0.96, 1], i * 3)
    sizes[i] = 1.2 + Math.pow(Math.random(), 3) * 2.2
    phases[i] = Math.random() * Math.PI * 2
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute('starSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1))
  const material = new THREE.ShaderMaterial({
    uniforms: { visibility: { value: 0 }, time: { value: 0 }, pixelRatio: { value: 1 } },
    vertexShader: `
      attribute vec3 color;
      attribute float starSize;
      attribute float phase;
      uniform float time;
      uniform float pixelRatio;
      varying vec3 starColor;
      varying float brightness;
      void main() {
        starColor = color;
        float altitude = normalize(position).y;
        brightness = smoothstep(0.06, 0.3, altitude) * (0.88 + 0.12 * sin(time * 0.7 + phase));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = starSize * pixelRatio;
      }
    `,
    fragmentShader: `
      uniform float visibility;
      varying vec3 starColor;
      varying float brightness;
      void main() {
        float radius = length(gl_PointCoord - vec2(0.5));
        float glow = 1.0 - smoothstep(0.08, 0.5, radius);
        gl_FragColor = vec4(starColor, glow * brightness * visibility);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  const stars = new THREE.Points(geometry, material)
  stars.frustumCulled = false
  stars.visible = false
  return stars
}
