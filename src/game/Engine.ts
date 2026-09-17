import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import type { Ability } from "../abilities/types";
import type { CharacterDef } from "../characters/types";
import { AbilityRuntime } from "./AbilityRuntime";

const GRID_SIZE = 24;
const BLOCK_SIZE = 1;

interface Projectile {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  bornAt: number;
}

interface RemotePlayer {
  mesh: THREE.Mesh;
  target: THREE.Vector3;
}

export class Engine {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly composer: EffectComposer;
  private readonly player: THREE.Mesh;
  private readonly clock = new THREE.Clock();
  private readonly keys = new Set<string>();
  private readonly projectiles: Projectile[] = [];
  private readonly remotePlayers = new Map<string, RemotePlayer>();
  private readonly moveSpeed: number;
  readonly runtime: AbilityRuntime;

  private readonly onHudUpdate: (runtime: AbilityRuntime) => void;

  constructor(container: HTMLElement, character: CharacterDef, onHudUpdate: (runtime: AbilityRuntime) => void) {
    this.onHudUpdate = onHudUpdate;
    this.runtime = new AbilityRuntime(character);
    this.moveSpeed = character.stats.moveSpeed;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x0a0a12);
    this.scene.fog = new THREE.Fog(0x0a0a12, 20, 60);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    this.camera.position.set(0, 8, 12);

    this.setupLights();
    this.buildVoxelGround();

    const playerGeo = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
    const playerMat = new THREE.MeshStandardMaterial({ color: character.color, roughness: 0.4, metalness: 0.1 });
    this.player = new THREE.Mesh(playerGeo, playerMat);
    this.player.position.set(0, 1, 0);
    this.player.castShadow = true;
    this.scene.add(this.player);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.6, 0.4, 0.15);
    this.composer.addPass(bloom);
    this.composer.addPass(new OutputPass());

    window.addEventListener("resize", () => this.onResize());
    window.addEventListener("keydown", (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
  }

  private setupLights() {
    const ambient = new THREE.AmbientLight(0x445566, 1.2);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff2d9, 1.8);
    sun.position.set(10, 20, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    this.scene.add(sun);
  }

  private buildVoxelGround() {
    const geo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.85 });
    const mesh = new THREE.InstancedMesh(geo, mat, GRID_SIZE * GRID_SIZE);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const dummy = new THREE.Object3D();
    let i = 0;
    for (let x = -GRID_SIZE / 2; x < GRID_SIZE / 2; x++) {
      for (let z = -GRID_SIZE / 2; z < GRID_SIZE / 2; z++) {
        dummy.position.set(x * BLOCK_SIZE, -0.5, z * BLOCK_SIZE);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    this.scene.add(mesh);
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  private updateMovement(dt: number) {
    const move = new THREE.Vector3();
    if (this.keys.has("w")) move.z -= 1;
    if (this.keys.has("s")) move.z += 1;
    if (this.keys.has("a")) move.x -= 1;
    if (this.keys.has("d")) move.x += 1;
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(this.moveSpeed * dt);
      this.player.position.add(move);
    }

    this.camera.position.lerp(
      new THREE.Vector3(this.player.position.x, this.player.position.y + 7, this.player.position.z + 10),
      0.1,
    );
    this.camera.lookAt(this.player.position);
  }

  getLocalPosition(): { x: number; y: number; z: number } {
    return { x: this.player.position.x, y: this.player.position.y, z: this.player.position.z };
  }

  spawnRemotePlayer(peerId: string, color: string) {
    if (this.remotePlayers.has(peerId)) return;
    const geo = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 1, 0);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.remotePlayers.set(peerId, { mesh, target: mesh.position.clone() });
  }

  updateRemotePlayer(peerId: string, position: { x: number; y: number; z: number }) {
    const remote = this.remotePlayers.get(peerId);
    if (!remote) return;
    remote.target.set(position.x, position.y, position.z);
  }

  setRemotePlayerColor(peerId: string, color: string) {
    const remote = this.remotePlayers.get(peerId);
    if (!remote) return;
    (remote.mesh.material as THREE.MeshStandardMaterial).color.set(color);
  }

  removeRemotePlayer(peerId: string) {
    const remote = this.remotePlayers.get(peerId);
    if (!remote) return;
    this.scene.remove(remote.mesh);
    remote.mesh.geometry.dispose();
    (remote.mesh.material as THREE.Material).dispose();
    this.remotePlayers.delete(peerId);
  }

  private updateRemotePlayers() {
    for (const remote of this.remotePlayers.values()) {
      remote.mesh.position.lerp(remote.target, 0.25);
    }
  }

  castAbility(ability: Ability) {
    this.castAbilityAt(ability, this.player.position);
  }

  castAbilityAt(ability: Ability, origin: { x: number; y: number; z: number }) {
    const originVec = new THREE.Vector3(origin.x, origin.y, origin.z);
    if (ability.target.kind === "projectile") {
      const geo = new THREE.SphereGeometry(0.25, 12, 12);
      const mat = new THREE.MeshStandardMaterial({
        color: ability.vfx.color,
        emissive: ability.vfx.color,
        emissiveIntensity: 2,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(originVec).add(new THREE.Vector3(0, 0.5, -1));
      const velocity = new THREE.Vector3(0, 0, -1).multiplyScalar(ability.target.speed);
      this.scene.add(mesh);
      this.projectiles.push({ mesh, velocity, bornAt: performance.now() });
    }
    // area / instant / self: efeito visual simples por enquanto (flash na cor do vfx).
    if (ability.target.kind !== "projectile") {
      const light = new THREE.PointLight(ability.vfx.color, 4, 6);
      light.position.copy(originVec).add(new THREE.Vector3(0, 1, 0));
      this.scene.add(light);
      setTimeout(() => this.scene.remove(light), 200);
    }
  }

  private removeProjectile(index: number) {
    const [p] = this.projectiles.splice(index, 1);
    this.scene.remove(p.mesh);
    p.mesh.geometry.dispose();
    (p.mesh.material as THREE.Material).dispose();
  }

  private updateProjectiles(dt: number) {
    const now = performance.now();
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.mesh.position.addScaledVector(p.velocity, dt);
      if (now - p.bornAt > 3000) {
        this.removeProjectile(i);
      }
    }
  }

  start() {
    const loop = () => {
      const dt = Math.min(this.clock.getDelta(), 0.1);
      this.runtime.update(dt);
      this.updateMovement(dt);
      this.updateProjectiles(dt);
      this.updateRemotePlayers();
      this.onHudUpdate(this.runtime);
      this.composer.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
