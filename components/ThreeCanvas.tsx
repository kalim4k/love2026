
import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import { SceneMode, AppState } from '../types';

const CONFIG = {
  colors: {
    bg: 0x000000,
    gold: 0xffd966,
    green: 0x03180a,
    red: 0x990000,
  },
  particles: {
    count: 1500,
    dustCount: 8000, // Augmenté pour une meilleure visibilité des messages
    treeHeight: 24,
    treeRadius: 8
  },
  camera: { z: 50 }
};

export interface ThreeCanvasHandle {
  addPhoto: (url: string) => void;
  updateHand: (x: number, y: number, detected: boolean, mode: SceneMode) => void;
  setMode: (mode: SceneMode) => void;
}

const ThreeCanvas = forwardRef<ThreeCanvasHandle, {}>((props, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const mainGroupRef = useRef<THREE.Group>(new THREE.Group());
  const photoGroupRef = useRef<THREE.Group>(new THREE.Group());
  const particlesRef = useRef<any[]>([]);
  
  const formationsRef = useRef<{
    love: THREE.Vector3[],
    year: THREE.Vector3[],
    heart: THREE.Vector3[]
  }>({ love: [], year: [], heart: [] });

  const stateRef = useRef<AppState>({
    mode: 'TREE',
    focusTarget: null,
    handDetected: false,
    handX: 0,
    handY: 0,
    rotationX: 0,
    rotationY: 0,
    uiVisible: true,
    isGeneratingWish: false,
    lastWish: ""
  });

  const clock = useRef(new THREE.Clock());

  useImperativeHandle(ref, () => ({
    addPhoto: (url: string) => {
      new THREE.TextureLoader().load(url, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        const group = new THREE.Group();
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(1.7, 1.7, 0.1),
          new THREE.MeshStandardMaterial({ color: CONFIG.colors.gold, metalness: 0.8, roughness: 0.2 })
        );
        const photo = new THREE.Mesh(
          new THREE.PlaneGeometry(1.5, 1.5),
          new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide })
        );
        photo.position.z = 0.06;
        group.add(frame, photo);
        group.scale.setScalar(0.8);
        photoGroupRef.current.add(group);
        particlesRef.current.push(createParticleData(group, 'PHOTO', false));
      });
    },
    updateHand: (x: number, y: number, detected: boolean, mode: SceneMode) => {
      stateRef.current.handX = x;
      stateRef.current.handY = y;
      stateRef.current.handDetected = detected;
      
      const prevState = stateRef.current.mode;
      stateRef.current.mode = mode;

      if (mode === 'FOCUS' && prevState !== 'FOCUS') {
        const photos = photoGroupRef.current.children;
        if (photos.length > 0) stateRef.current.focusTarget = photos[Math.floor(Math.random() * photos.length)];
      } else if (mode !== 'FOCUS') {
        stateRef.current.focusTarget = null;
      }
    },
    setMode: (mode: SceneMode) => {
      stateRef.current.mode = mode;
      stateRef.current.focusTarget = null;
    }
  }));

  const createParticleData = (mesh: THREE.Object3D, type: string, isDust: boolean) => {
    const data: any = {
      mesh, type, isDust,
      posTree: new THREE.Vector3(),
      posScatter: new THREE.Vector3(),
      baseScale: mesh.scale.x,
      spinSpeed: new THREE.Vector3((Math.random()-0.5)*1.5, (Math.random()-0.5)*1.5, (Math.random()-0.5)*1.5)
    };

    const h = CONFIG.particles.treeHeight;
    const t = Math.pow(Math.random(), 0.7);
    const y = (t * h) - (h / 2);
    const rMax = Math.max(1.0, CONFIG.particles.treeRadius * (1.1 - t));
    const angle = t * 35 * Math.PI + Math.random() * Math.PI * 2;
    data.posTree.set(Math.cos(angle) * rMax, y, Math.sin(angle) * rMax);

    const rScatter = 20 + Math.random() * 25;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    data.posScatter.set(rScatter * Math.sin(phi) * Math.cos(theta), rScatter * Math.sin(phi) * Math.sin(theta), rScatter * Math.cos(phi));
    return data;
  };

  const generatePointsFromText = (text: string, fontSize: number): THREE.Vector3[] => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 1200; canvas.height = 600;
    ctx.fillStyle = 'white';
    ctx.font = `bold ${fontSize}px Cinzel, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    
    if (text.length > 12) {
      const words = text.split(' ');
      const mid = Math.ceil(words.length / 2);
      ctx.fillText(words.slice(0, mid).join(' '), 600, 220);
      ctx.fillText(words.slice(mid).join(' '), 600, 380);
    } else {
      ctx.fillText(text, 600, 300);
    }

    const imgData = ctx.getImageData(0, 0, 1200, 600).data;
    const points: THREE.Vector3[] = [];
    const step = 4; // Pas réduit pour augmenter la résolution du message
    for (let y = 0; y < 600; y += step) {
      for (let x = 0; x < 1200; x += step) {
        if (imgData[(y * 1200 + x) * 4 + 3] > 128) {
          points.push(new THREE.Vector3((x - 600) * 0.05, -(y - 300) * 0.05, 0));
        }
      }
    }
    return points;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.015);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = CONFIG.camera.z;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    const mainGroup = mainGroupRef.current;
    scene.add(mainGroup);
    mainGroup.add(photoGroupRef.current);

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const light = new THREE.DirectionalLight(0xffffff, 1.2);
    light.position.set(5, 10, 7);
    scene.add(light);

    const goldMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.gold, metalness: 0.9, roughness: 0.1 });
    const greenMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.green, roughness: 0.8 });
    const redMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.red, metalness: 0.5 });
    const sphere = new THREE.SphereGeometry(0.4, 8, 8);

    for (let i = 0; i < CONFIG.particles.count; i++) {
      const m = new THREE.Mesh(sphere, Math.random() > 0.7 ? redMat : Math.random() > 0.3 ? goldMat : greenMat);
      m.scale.setScalar(0.4 + Math.random() * 0.8);
      mainGroup.add(m);
      particlesRef.current.push(createParticleData(m, 'BASE', false));
    }

    const dustMat = new THREE.MeshBasicMaterial({ color: 0xfff4d1, transparent: true, opacity: 0.6 });
    const dustGeo = new THREE.OctahedronGeometry(0.12, 0);
    for (let i = 0; i < CONFIG.particles.dustCount; i++) {
      const m = new THREE.Mesh(dustGeo, dustMat.clone());
      mainGroup.add(m);
      particlesRef.current.push(createParticleData(m, 'DUST', true));
    }

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.4, 0.85));
    composerRef.current = composer;

    const loadFormations = async () => {
        try { await document.fonts.ready; } catch(e) {}
        formationsRef.current.love = generatePointsFromText("Je t'aime", 140);
        formationsRef.current.year = generatePointsFromText("Bonne Année 2026", 110);
        const heart: THREE.Vector3[] = [];
        for(let i=0; i<2000; i++) {
          const t = (i/2000) * Math.PI * 2;
          heart.push(new THREE.Vector3(16 * Math.pow(Math.sin(t), 3) * 0.85, (13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t)) * 0.85, 0));
        }
        formationsRef.current.heart = heart;
    };
    loadFormations();

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const dt = clock.current.getDelta();
      const state = stateRef.current;

      const isMsg = state.mode.startsWith('MESSAGE');
      
      // ROTATION CONTROL: Influence de la main
      if (state.handDetected) {
        // Rotation basée sur la position de la main (Lissage avec lerp)
        const targetRotY = state.handX * 1.5;
        const targetRotX = -state.handY * 0.8;
        mainGroup.rotation.y = THREE.MathUtils.lerp(mainGroup.rotation.y, targetRotY, 5 * dt);
        mainGroup.rotation.x = THREE.MathUtils.lerp(mainGroup.rotation.x, targetRotX, 5 * dt);
      } else {
        // Rotation automatique si aucune main n'est là
        state.rotationY += (state.mode === 'SCATTER' ? 0.05 : isMsg ? 0.02 : 0.2) * dt;
        mainGroup.rotation.y = state.rotationY;
        mainGroup.rotation.x = THREE.MathUtils.lerp(mainGroup.rotation.x, 0, 2 * dt);
      }

      let formation: THREE.Vector3[] = [];
      if (state.mode === 'MESSAGE_LOVE') formation = formationsRef.current.love;
      if (state.mode === 'MESSAGE_YEAR') formation = formationsRef.current.year;
      if (state.mode === 'MESSAGE_HEART') formation = formationsRef.current.heart;

      let dIdx = 0;
      particlesRef.current.forEach((p) => {
        let target = (state.mode === 'TREE') ? p.posTree : p.posScatter;
        let scale = p.baseScale;
        let lerp = 3.0;

        if (p.isDust && formation.length > 0) {
          const fPos = formation[dIdx % formation.length];
          const world = new THREE.Vector3(fPos.x, fPos.y, 20); // Un peu plus proche pour plus de clarté
          target = world.applyMatrix4(mainGroup.matrixWorld.clone().invert());
          scale = 1.2; 
          lerp = 8.0; 
          dIdx++;
        }

        if (state.mode === 'FOCUS' && p.mesh === state.focusTarget) {
          target = new THREE.Vector3(0,0,35).applyMatrix4(mainGroup.matrixWorld.clone().invert());
          scale = 5.0; lerp = 6.0; p.mesh.lookAt(camera.position);
        } else if (state.mode === 'FOCUS') {
          scale *= 0.2;
        }

        p.mesh.position.lerp(target, lerp * dt);
        p.mesh.scale.lerp(new THREE.Vector3(scale, scale, scale), 4 * dt);
      });

      composer.render();
    };
    animate();

    const resize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', resize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      renderer.dispose();
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 z-0 bg-black" />;
});

export default ThreeCanvas;