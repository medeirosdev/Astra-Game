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

const loader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, Promise<THREE.Texture>>();
const templateCache = new Map<string, Promise<CharacterTemplate>>();
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

  constructor(modelUrl: string, tintColor?: string, skinTextureUrl?: string) {
    Promise.all([
      loadCharacterTemplate(modelUrl),
      loadAnimationLibrary(),
      skinTextureUrl ? loadSkinTexture(skinTextureUrl) : Promise.resolve(null),
    ]).then(([{ scene }, clips, skinTexture]) => {
      const instance = cloneSkeleton(scene) as THREE.Group;
      // Esse rig (Quaternius) também olha pra +Z por padrão; o resto do
      // jogo (câmera, movimento, mira dos poderes) trata -Z como "pra
      // frente". Sem isso o personagem anda de costas — olhando pra câmera.
      instance.rotation.y = Math.PI;
      instance.traverse((obj) => {
        if (obj.name === "hand_l" || obj.name === "hand_r") this.handBones.push(obj);
        if (!(obj instanceof THREE.Mesh)) return;
        obj.castShadow = true;
        obj.receiveShadow = true;
        // Clona o material antes de mexer nele — ele é compartilhado entre
        // todo mundo usando o mesmo corpo (macho/fêmea); sem clonar, tingir
        // ou deixar transparente um personagem vazaria pra todos os outros.
        if (obj.material instanceof THREE.MeshStandardMaterial) {
          obj.material = obj.material.clone();
          if (obj.material.name.startsWith(TINTABLE_MATERIAL_PREFIX)) {
            if (skinTexture) obj.material.map = skinTexture;
            // Tint mais fraco (mistura com branco) em vez de substituir a cor
            // direto: sobrescrever deixa a pele/roupa uma estátua lisa de cor
            // sólida, apagando o relevo da textura real. Misturado, dá pra
            // reconhecer o personagem pela cor sem perder o corpo texturizado.
            if (tintColor) obj.material.color.set(tintColor).lerp(new THREE.Color("#ffffff"), 0.55);
          }
          this.meshMaterials.push(obj.material);
        }
      });
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
