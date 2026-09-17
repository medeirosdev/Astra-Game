import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

interface Template {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

const loader = new GLTFLoader();
const templateCache = new Map<string, Promise<Template>>();

function loadTemplate(url: string): Promise<Template> {
  let cached = templateCache.get(url);
  if (!cached) {
    cached = loader.loadAsync(url).then((gltf) => ({ scene: gltf.scene, animations: gltf.animations }));
    templateCache.set(url, cached);
  }
  return cached;
}

// Carrega e anima um modelo (ver public/models/CREDITS.txt) — cada instância
// clona o template compartilhado (sem skinning nesses modelos, então
// Object3D.clone(true) já basta) e tem seu próprio mixer, pra cada
// personagem em cena animar de forma independente.
export class CharacterModel {
  readonly group = new THREE.Group();
  private mixer: THREE.AnimationMixer | null = null;
  private actions = new Map<string, THREE.AnimationAction>();
  private currentAction: THREE.AnimationAction | null = null;

  constructor(modelUrl: string) {
    loadTemplate(modelUrl).then(({ scene, animations }) => {
      const instance = scene.clone(true);
      // O rig desse pack (Kenney) olha pra +Z por padrão; o resto do jogo
      // (câmera, movimento, mira dos poderes) trata -Z como "pra frente".
      // Sem isso o personagem anda de costas — olhando pra câmera.
      instance.rotation.y = Math.PI;
      instance.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.castShadow = true;
          obj.receiveShadow = true;
        }
      });
      this.group.add(instance);

      this.mixer = new THREE.AnimationMixer(instance);
      animations.forEach((clip) => this.actions.set(clip.name, this.mixer!.clipAction(clip)));
      this.play("idle");
    });
  }

  play(name: string) {
    const next = this.actions.get(name);
    if (!next || next === this.currentAction) return;
    next.reset().fadeIn(0.15).play();
    this.currentAction?.fadeOut(0.15);
    this.currentAction = next;
  }

  // Toca uma vez (ataque/cast) e volta pra `then` (geralmente "idle") ao terminar.
  playOnce(name: string, then: string) {
    const action = this.actions.get(name);
    const mixer = this.mixer;
    if (!action || !mixer) return;

    action.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.05).play();
    this.currentAction?.fadeOut(0.05);
    this.currentAction = action;

    const onFinished = (event: { action: THREE.AnimationAction }) => {
      if (event.action !== action) return;
      mixer.removeEventListener("finished", onFinished);
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
