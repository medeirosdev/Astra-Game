import * as THREE from "three";

// Texturas PBR CC0 (Poly Haven, ver public/textures/CREDITS.txt) pra dar
// relevo de verdade no chão/paredes/obstáculos — antes eram só cor sólida.
const loader = new THREE.TextureLoader();
const rawCache = new Map<string, THREE.Texture>();

function loadRaw(url: string, colorSpace: THREE.ColorSpace): THREE.Texture {
  let tex = rawCache.get(url);
  if (!tex) {
    tex = loader.load(url);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = colorSpace;
    tex.anisotropy = 4;
    rawCache.set(url, tex);
  }
  return tex;
}

// Cada material precisa da própria instância de textura pra poder ter um
// repeat diferente (chão gigante x parede pequena) sem os dois brigarem
// pelo mesmo objeto — clone() é barato, reaproveita a imagem já carregada.
function tiled(url: string, colorSpace: THREE.ColorSpace, repeat: number): THREE.Texture {
  const tex = loadRaw(url, colorSpace).clone();
  tex.needsUpdate = true;
  tex.repeat.set(repeat, repeat);
  return tex;
}

export interface TerrainMaterialOptions {
  repeat?: number;
  color?: THREE.ColorRepresentation;
  roughness?: number;
}

// `prefix` é o nome do set em public/textures/ (ex: "abyss" -> abyss_diff.jpg
// / abyss_nor.jpg / abyss_rough.jpg, ver CREDITS.txt).
export function createTerrainMaterial(prefix: string, options: TerrainMaterialOptions = {}): THREE.MeshStandardMaterial {
  const repeat = options.repeat ?? 1;
  return new THREE.MeshStandardMaterial({
    map: tiled(`/textures/${prefix}_diff.jpg`, THREE.SRGBColorSpace, repeat),
    normalMap: tiled(`/textures/${prefix}_nor.jpg`, THREE.NoColorSpace, repeat),
    roughnessMap: tiled(`/textures/${prefix}_rough.jpg`, THREE.NoColorSpace, repeat),
    color: options.color ?? 0xffffff,
    roughness: options.roughness ?? 1,
  });
}
