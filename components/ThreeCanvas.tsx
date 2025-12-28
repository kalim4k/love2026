
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
    champagneGold: 0xffd966,
    deepGreen: 0x03180a,
    accentRed: 0x990000,
    brightGold: 0xfff2a1,
  },
  particles: {
    count: 1400,
    dustCount: 3000,
    treeHeight: 24,
    treeRadius: 8
  },
  camera: {
    z: 50
  }
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
      const loader = new THREE.TextureLoader();
      loader.load(url, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        createPhotoMesh(texture);
      });
    },
    updateHand: (x: number, y: number, detected: boolean, mode: SceneMode) => {
      const prevState = stateRef.current.mode;
      stateRef.current.handX = x;
      stateRef.current.handY = y;
      stateRef.current.handDetected = detected;
      stateRef.current.mode = mode;

      if (mode === 'FOCUS' && prevState !== 'FOCUS') {
        pickRandomPhoto();
      } else if (mode !== 'FOCUS') {
        stateRef.current.focusTarget = null;
      }
    },
    setMode: (mode: SceneMode) => {
      stateRef.current.mode = mode;
      if (mode !== 'FOCUS') stateRef.current.focusTarget = null;
    }
  }));

  const generatePointsFromText = (text: string, fontSize: number): THREE.Vector3[] => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 1600;
    canvas.height = 800;
    
    ctx.fillStyle = 'white';
    ctx.font = `bold ${fontSize}px Cinzel, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Split long text into multiple lines
    if (text.length > 15) {
        const words = text.split(' ');
        const mid = Math.ceil(words.length / 2);
        const line1 = words.slice(0, mid).join(' ');
        const line2 = words.slice(mid).join(' ');
        ctx.fillText(line1, 800, 300);
        ctx.fillText(line2, 800, 500);
    } else {
        ctx.fillText(text, 800, 400);
    }

    const imageData = ctx.getImageData(0, 0, 1600, 800).data;
    const points: THREE.Vector3[] = [];
    const step = 8;
    
    for (let y = 0; y < 800; y += step) {
      for (let x = 0; x < 1600; x += step) {
        const alpha = imageData[(y * 1600 + x) * 4 + 3];
        if (alpha > 128) {
          points.push(new THREE.Vector3(
            (x - 800) * 0.05, 
            -(y - 400) * 0.05, 
            0
          ));
        }
      }
    }
    return points;
  };

  const generateHeartPoints = (count: number): THREE.Vector3[] => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
        const t = (i / count) * Math.PI * 2;
        const x = 16 * Math.pow(Math.sin(t), 3);
        const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        points.push(new THREE.Vector3(x * 0.8, y * 0.8, 0));
    }
    return points;
  };

  const createPhotoMesh = (texture: THREE.Texture) => {
    const frameGeo = new THREE.BoxGeometry(1.7, 1.7, 0.1);
    const frameMat = new THREE.MeshStandardMaterial({ 
      color: CONFIG.colors.champagneGold, 
      metalness: 0.8, 
      roughness: 0.2
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);

    const photoGeo = new THREE.PlaneGeometry(1.5, 1.5);
    const photoMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    const photo = new THREE.Mesh(photoGeo, photoMat);
    photo.position.z = 0.06;

    const group = new THREE.Group();
    group.add(frame);
    group.add(photo);
    group.scale.setScalar(0.8);
    
    photoGroupRef.current.add(group);
    particlesRef.current.push(createParticleData(group, 'PHOTO', false));
  };

  const pickRandomPhoto = () => {
    const photos = photoGroupRef.current.children;
    if (photos.length > 0) {
      stateRef.current.focusTarget = photos[Math.floor(Math.random() * photos.length)];
    }
  };

  const createParticleData = (mesh: THREE.Object3D, type: string, isDust: boolean) => {
    const data: any = {
      mesh,
      type,
      isDust,
      posTree: new THREE.Vector3(),
      posScatter: new THREE.Vector3(),
      baseScale: mesh.scale.x,
      spinSpeed: new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.5
      )
    };

    const h = CONFIG.particles.treeHeight;
    let t = Math.pow(Math.random(), 0.7);
    const y = (t * h) - (h / 2);
    let rMax = CONFIG.particles.treeRadius * (1.1 - t);
    if (rMax < 1.0) rMax = 1.0;
    const angle = t * 35 * Math.PI + Math.random() * Math.PI * 2;
    const r = rMax * (0.8 + Math.random() * 0.4);
    data.posTree.set(Math.cos(angle) * r, y, Math.sin(angle) * r);

    let rScatter = 20 + Math.random() * 25;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    data.posScatter.set(
      rScatter * Math.sin(phi) * Math.cos(theta),
      rScatter * Math.sin(phi) * Math.sin(theta),
      rScatter * Math.cos(phi)
    );

    return data;
  };

  useEffect(() => {
    if (!containerRef.current) return;

    let isMounted = true;
    let animationId: number;

    const init = async () => {
      await document.fonts.ready;
      if (!isMounted) return;

      formationsRef.current.love = generatePointsFromText("Je t'aime", 140);
      formationsRef.current.year = generatePointsFromText("Bonne et heureuse année 2026", 80);
      formationsRef.current.heart = generateHeartPoints(1200);

      const scene = new THREE.Scene();
      sceneRef.current = scene;
      scene.background = new THREE.Color(CONFIG.colors.bg);
      scene.fog = new THREE.FogExp2(CONFIG.colors.bg, 0.012);

      const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
      cameraRef.current = camera;
      camera.position.set(0, 0, CONFIG.camera.z);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      rendererRef.current = renderer;
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      containerRef.current?.appendChild(renderer.domElement);

      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

      const mainGroup = mainGroupRef.current;
      scene.add(mainGroup);
      mainGroup.add(photoGroupRef.current);

      scene.add(new THREE.AmbientLight(0xffffff, 0.4));
      const spot = new THREE.SpotLight(0xfff2a1, 1500);
      spot.position.set(10, 40, 30);
      scene.add(spot);

      const goldMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.champagneGold, metalness: 0.9, roughness: 0.1 });
      const greenMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.deepGreen, roughness: 0.8 });
      const redMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.accentRed, metalness: 0.5 });
      const sphereGeo = new THREE.SphereGeometry(0.4, 8, 8);
      const boxGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);

      for (let i = 0; i < CONFIG.particles.count; i++) {
        const m = new THREE.Mesh(Math.random() > 0.5 ? sphereGeo : boxGeo, Math.random() > 0.7 ? redMat : Math.random() > 0.3 ? goldMat : greenMat);
        m.scale.setScalar(0.4 + Math.random() * 0.8);
        mainGroup.add(m);
        particlesRef.current.push(createParticleData(m, 'BASE', false));
      }

      const dustMat = new THREE.MeshBasicMaterial({ color: 0xfff4d1, transparent: true, opacity: 0.5 });
      const dustGeo = new THREE.OctahedronGeometry(0.12, 0);
      for (let i = 0; i < CONFIG.particles.dustCount; i++) {
        const m = new THREE.Mesh(dustGeo, dustMat.clone());
        mainGroup.add(m);
        particlesRef.current.push(createParticleData(m, 'DUST', true));
      }

      const composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.0, 0.4, 0.8);
      composer.addPass(bloom);
      composerRef.current = composer;

      const animate = () => {
        if (!isMounted) return;
        animationId = requestAnimationFrame(animate);
        const dt = clock.current.getDelta();
        const time = clock.current.elapsedTime;
        const state = stateRef.current;

        const isMessage = ['MESSAGE_LOVE', 'MESSAGE_YEAR', 'MESSAGE_HEART'].includes(state.mode);
        const rotSpeed = state.mode === 'SCATTER' ? 0.05 : isMessage ? 0.02 : 0.2;
        state.rotationY += rotSpeed * dt;
        mainGroup.rotation.y = state.rotationY;

        let formation: THREE.Vector3[] = [];
        if (state.mode === 'MESSAGE_LOVE') formation = formationsRef.current.love;
        if (state.mode === 'MESSAGE_YEAR') formation = formationsRef.current.year;
        if (state.mode === 'MESSAGE_HEART') formation = formationsRef.current.heart;

        let dustIdx = 0;
        particlesRef.current.forEach((p) => {
          let target = (state.mode === 'TREE') ? p.posTree : p.posScatter;
          let scale = p.baseScale;
          let lerpVal = 3.0;

          if (p.isDust && formation.length > 0) {
            const fPos = formation[dustIdx % formation.length];
            const worldPos = new THREE.Vector3(fPos.x, fPos.y, 25);
            const local = worldPos.clone().applyMatrix4(mainGroup.matrixWorld.clone().invert());
            target = local;
            scale = 1.0;
            lerpVal = 7.0;
            dustIdx++;
          }

          if (state.mode === 'FOCUS' && p.mesh === state.focusTarget) {
            const focusWorld = new THREE.Vector3(0, 0, 35);
            target = focusWorld.applyMatrix4(mainGroup.matrixWorld.clone().invert());
            scale = 5.0;
            lerpVal = 6.0;
            p.mesh.lookAt(camera.position);
          } else if (state.mode === 'FOCUS') {
            scale *= 0.2;
          }

          p.mesh.position.lerp(target, lerpVal * dt);
          p.mesh.scale.lerp(new THREE.Vector3(scale, scale, scale), 4 * dt);
          if (p.mesh !== state.focusTarget) {
            p.mesh.rotation.x += p.spinSpeed.x * dt;
            p.mesh.rotation.y += p.spinSpeed.y * dt;
          }
        });

        composer.render();
      };
      animate();
    };

    init();

    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current || !composerRef.current) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
      composerRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      rendererRef.current?.dispose();
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 z-0 bg-black" />;
});

export default ThreeCanvas;