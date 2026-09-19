import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

interface CharacterTemplate {
  scene: THREE.Group;
}

// Duas bibliotecas de animação compartilhadas entre os dois corpos (ver
// public/models/CREDITS.txt) — mesmo esqueleto de 65 ossos, carregadas uma
// vez só e reaproveitadas por todo mundo (local e peers remotos). A 1 tem o
// básico (idle/andar/pular/agachar/rolar); a 2 soma golpes extras usados
// nos combos por personagem (ver characters.ts).
const ANIMATION_LIBRARY_URLS = ["/models/anim-library-1.glb", "/models/anim-library-2.glb"];

// Prefixo do material de roupa/pele nos dois corpos do pack — é nele que
// aplicamos a cor do personagem (ver characters.ts), não no cabelo/olhos.
const TINTABLE_MATERIAL_PREFIX = "MI_Superhero_";
// Mesma ideia pro traje (ver ATTACH_OUTFIT/public/models/CREDITS.txt) — só
// a roupa em si ("MI_Ranger"/"MI_Peasant"), não a pele exposta embutida no
// traje ("MI_Regular_Male"/"MI_Regular_Female").
const OUTFIT_TINTABLE_PREFIXES = ["MI_Ranger", "MI_Peasant"];

const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, Promise<THREE.Texture>>();
const templateCache = new Map<string, Promise<CharacterTemplate>>();
// Geometria de cada peça do traje já remapeada pros ossos do corpo base
// (ver attachOutfit) — o remapeamento dá o mesmo resultado pra toda
// instância de um mesmo par corpo+traje, então computa uma vez só.
const remappedOutfitGeometryCache = new Map<string, THREE.BufferGeometry>();
let animationLibraryPromise: Promise<Map<string, THREE.AnimationClip>> | null = null;

// Variante de textura de pele (ver public/models/CREDITS.txt — "Light"/"Dark"
// do pack Quaternius) pra dar alguma diferença real de skin entre
// personagens que reaproveitam o mesmo corpo base, além do tint de cor.
function loadSkinTexture(url: string): Promise<THREE.Texture> {
  let cached = textureCache.get(url);
  if (!cached) {
    cached = textureLoader.loadAsync(url).then((tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false; // convenção glTF, diferente do padrão do TextureLoader
      return tex;
    });
    textureCache.set(url, cached);
  }
  return cached;
}

function loadCharacterTemplate(url: string): Promise<CharacterTemplate> {
  let cached = templateCache.get(url);
  if (!cached) {
    cached = loader.loadAsync(url).then((gltf) => ({ scene: gltf.scene }));
    templateCache.set(url, cached);
  }
  return cached;
}

// Trajes do pack "Modular Character Outfits" (ver public/models/CREDITS.txt)
// compartilham o MESMO rig de 65 ossos do corpo base, mas cada arquivo vem
// com o próprio esqueleto/ordem de joints — pra costurar a roupa nos ossos
// já animados do corpo, precisamos remapear o skinIndex de "posição na
// lista de joints do traje" pra "posição na lista de joints do corpo",
// casando por NOME do osso (não por índice, que não bate entre os dois).
function remapSkinIndices(mesh: THREE.SkinnedMesh, targetBoneNames: string[]): THREE.BufferGeometry {
  const geometry = mesh.geometry.clone();
  const sourceNames = mesh.skeleton.bones.map((b) => b.name);
  const nameToTarget = new Map(targetBoneNames.map((name, i) => [name, i]));
  const skinIndexAttr = geometry.getAttribute("skinIndex");
  const remapped = new Uint16Array(skinIndexAttr.array.length);
  for (let i = 0; i < skinIndexAttr.array.length; i++) {
    const boneName = sourceNames[skinIndexAttr.array[i]];
    remapped[i] = nameToTarget.get(boneName) ?? 0;
  }
  geometry.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(remapped, 4));
  return geometry;
}

// Cria, pra cada peça skinned do traje, um SkinnedMesh novo costurado no
// esqueleto JÁ CLONADO do corpo (bodySkeleton) — assim a roupa acompanha a
// mesma animação do corpo sem precisar de um segundo AnimationMixer.
function attachOutfit(
  outfitScene: THREE.Group,
  bodySkeleton: THREE.Skeleton,
  cacheKeyPrefix: string,
  tintColor: string | undefined,
): THREE.SkinnedMesh[] {
  const targetBoneNames = bodySkeleton.bones.map((b) => b.name);
  const pieces: THREE.SkinnedMesh[] = [];
  outfitScene.traverse((obj) => {
    if (!(obj instanceof THREE.SkinnedMesh)) return;
    const cacheKey = `${cacheKeyPrefix}:${obj.name}`;
    let geometry = remappedOutfitGeometryCache.get(cacheKey);
    if (!geometry) {
      geometry = remapSkinIndices(obj, targetBoneNames);
      remappedOutfitGeometryCache.set(cacheKey, geometry);
    }
    const material = (Array.isArray(obj.material) ? obj.material[0] : obj.material).clone() as THREE.MeshStandardMaterial;
    if (tintColor && OUTFIT_TINTABLE_PREFIXES.some((p) => material.name.startsWith(p))) {
      // Tecido de traje tem textura/costura mais contrastada que pele — dá
      // pra tingir mais forte que o corpo nu (ver TINTABLE_MATERIAL_PREFIX)
      // sem virar estátua lisa, e ajuda dois personagens com o MESMO traje
      // (Guardião/John Kaisen, ambos Ranger) a não parecerem quase iguais.
      material.color.set(tintColor).lerp(new THREE.Color("#ffffff"), 0.3);
    }
    const piece = new THREE.SkinnedMesh(geometry, material);
    piece.castShadow = true;
    piece.receiveShadow = true;
    piece.bind(bodySkeleton);
    pieces.push(piece);
  });
  return pieces;
}

function loadAnimationLibrary(): Promise<Map<string, THREE.AnimationClip>> {
  if (!animationLibraryPromise) {
    animationLibraryPromise = Promise.all(ANIMATION_LIBRARY_URLS.map((url) => loader.loadAsync(url))).then((gltfs) => {
      const clips = new Map<string, THREE.AnimationClip>();
      for (const gltf of gltfs) {
        for (const clip of gltf.animations) clips.set(clip.name, clip);
      }
      return clips;
    });
  }
  return animationLibraryPromise;
}

// Carrega e anima um modelo. Esses corpos usam skinning de verdade (malha
// deformada por peso nos 65 ossos, diferente do pack antigo da Kenney que
// era hierárquico e dava pra clonar com Object3D.clone) — por isso usa
// SkeletonUtils.clone, que reconstrói o esqueleto clonado e reconecta a
// malha a ele; um clone ingênuo deixaria todo mundo compartilhando o mesmo
// esqueleto (todo personagem animando igual, ou nenhum).
export class CharacterModel {
  readonly group = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private currentAction: THREE.AnimationAction | null = null;
  // Ossos das mãos — usados pra desenhar o rastro do soco/chute seguindo a
  // posição real da mão durante o swing (ver Engine.updateAttackTrail).
  private handBones: THREE.Object3D[] = [];
  // Materiais (já clonados por instância, ver constructor) — usado pra
  // deixar o personagem semi-transparente durante invisibilidade.
  private meshMaterials: THREE.Material[] = [];

  constructor(modelUrl: string, tintColor?: string, skinTextureUrl?: string, outfitUrl?: string) {
    Promise.all([
      loadCharacterTemplate(modelUrl),
      loadAnimationLibrary(),
      skinTextureUrl ? loadSkinTexture(skinTextureUrl) : Promise.resolve(null),
      outfitUrl ? loadCharacterTemplate(outfitUrl) : Promise.resolve(null),
    ]).then(([{ scene }, clips, skinTexture, outfitTemplate]) => {
      const instance = cloneSkeleton(scene) as THREE.Group;
      // Esse rig (Quaternius) também olha pra +Z por padrão; o resto do
      // jogo (câmera, movimento, mira dos poderes) trata -Z como "pra
      // frente". Sem isso o personagem anda de costas — olhando pra câmera.
      instance.rotation.y = Math.PI;
      let bodySkeleton: THREE.Skeleton | null = null;
      instance.traverse((obj) => {
        if (obj.name === "hand_l" || obj.name === "hand_r") this.handBones.push(obj);
        if (obj instanceof THREE.SkinnedMesh && !bodySkeleton) bodySkeleton = obj.skeleton;
        if (!(obj instanceof THREE.Mesh)) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
        // Clona o material antes de mexer nele — ele é compartilhado entre
        // todo mundo usando o mesmo corpo (macho/fêmea); sem clonar, tingir
        // ou deixar transparente um personagem vazaria pra todos os outros.
        if (obj.material instanceof THREE.MeshStandardMaterial) {
          obj.material = obj.material.clone();
          if (obj.material.name.startsWith(TINTABLE_MATERIAL_PREFIX)) {
            // Traje substitui a roupa/pele do corpo base por completo — a
            // malha "nua" original só ficaria vazando por baixo da roupa
            // nova, então escondida (o esqueleto continua existindo e
            // funcionando, ele não depende de mesh nenhuma pra animar).
            if (outfitTemplate) {
              obj.visible = false;
            } else {
              if (skinTexture) obj.material.map = skinTexture;
              // Tint mais fraco (mistura com branco) em vez de substituir a
              // cor direto: sobrescrever deixa a pele/roupa uma estátua lisa
              // de cor sólida, apagando o relevo da textura real.
              if (tintColor) obj.material.color.set(tintColor).lerp(new THREE.Color("#ffffff"), 0.55);
            }
          }
          this.meshMaterials.push(obj.material);
        }
      });
      if (outfitTemplate && bodySkeleton) {
        const pieces = attachOutfit(outfitTemplate.scene, bodySkeleton, outfitUrl!, tintColor);
        for (const piece of pieces) {
          instance.add(piece);
          this.meshMaterials.push(piece.material as THREE.Material);
        }
      }
      this.group.add(instance);

      this.mixer = new THREE.AnimationMixer(instance);
      clips.forEach((clip, name) => this.actions.set(name, this.mixer!.clipAction(clip)));
      this.play("Idle_Loop");
    });
  }

  // Posição atual (mundo) das duas mãos, pra quem quiser desenhar um rastro
  // seguindo o soco/chute. Vazio até o modelo terminar de carregar.
  getHandWorldPositions(): THREE.Vector3[] {
    return this.handBones.map((bone) => bone.getWorldPosition(new THREE.Vector3()));
  }

  // opacity < 1 usa pra invisibilidade (ver Passo Fantasma) — liga
  // `transparent` junto, senão o material ignora a opacidade.
  setOpacity(opacity: number) {
    for (const material of this.meshMaterials) {
      material.opacity = opacity;
      material.transparent = opacity < 1;
    }
  }

  play(name: string) {
    const next = this.actions.get(name);
    if (!next || next === this.currentAction) return;
    next.reset().fadeIn(0.15).play();
    this.currentAction?.fadeOut(0.15);
    this.currentAction = next;
  }

  // Toca uma vez (ataque/cast/pulo/rolar) e volta pra `then` (geralmente
  // "Idle_Loop") ao terminar. `timeScale` deixa o clipe mais rápido/lento
  // sem precisar de uma animação nova (usado pra rolar, ver Engine.ts).
  playOnce(name: string, then: string, timeScale = 1) {
    const action = this.actions.get(name);
    const mixer = this.mixer;
    if (!action || !mixer) return;

    action.reset().setLoop(THREE.LoopOnce, 1).setEffectiveTimeScale(timeScale).fadeIn(0.05).play();
    this.currentAction?.fadeOut(0.05);
    this.currentAction = action;

    const onFinished = (event: { action: THREE.AnimationAction }) => {
      if (event.action !== action) return;
      mixer.removeEventListener("finished", onFinished);
      action.setEffectiveTimeScale(1);
      this.play(then);
    };
    mixer.addEventListener("finished", onFinished);
  }

  update(dt: number) {
    this.mixer?.update(dt);
  }

  dispose() {
    this.group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.geometry.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((m) => m.dispose());
    });
  }
}
