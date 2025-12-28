
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
    count: 1200,
    dustCount: 2200,
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
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const composerRef = useRef<EffectComposer | null>(null);
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

  const generatePointsFromText = (text: string, fontSize: number, spacing: number = 0.75): THREE.Vector3[] => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 1200;
    canvas.height = 600;
    
    ctx.fillStyle = 'white';
    ctx.font = `bold ${fontSize}px Cinzel, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Split intelligent pour les textes longs
    if (text.length > 15) {
        const words = text.split(' ');
        const mid = Math.ceil(words.length / 2);
        ctx.fillText(words.slice(0, mid).join(' '), 600, 220);
        ctx.fillText(words.slice(mid).join(' '), 600, 380);
    } else {
        ctx.fillText(text, 600, 300);
    }

    const imageData = ctx.getImageData(0, 0, 1200, 600).data;
    const points: THREE.Vector3[] = [];
    
    for (let y = 0; y < 600; y += 6) {
      for (let x = 0; x < 1200; x += 6) {
        const alpha = imageData[(y * 1200 + x) * 4 + 3];
        if (alpha > 128) {
          points.push(new THREE.Vector3(
            (x - 600) * 0.07 * spacing, 
            -(y - 300) * 0.07 * spacing, 
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
        points.push(new THREE.Vector3(x * 0.85, y * 0.85, 0));
        if (i % 2 === 0) {
            const r = Math.random();
            points.push(new THREE.Vector3(x * 0.85 * r, y * 0.85 * r, (Math.random() - 0.5) * 5));
        }
    }
    return points;
  };

  const pickRandomPhoto = () => {
    const photos = photoGroupRef.current.children;
    if (photos.length > 0) {
      const randomIndex = Math.floor(Math.random() * photos.length);
      stateRef.current.focusTarget = photos[randomIndex];
    }
  };

  const createPhotoMesh = (texture: THREE.Texture) => {
    const frameGeo = new THREE.BoxGeometry(1.7, 1.7, 0.12);
    const frameMat = new THREE.MeshStandardMaterial({ 
      color: CONFIG.colors.champagneGold, 
      metalness: 1.0, 
      roughness: 0.05,
      emissive: CONFIG.colors.champagneGold,
      emissiveIntensity: 0.1
    });
    const frame = new THREE.Mesh(frameGeo, frameMat);

    const photoGeo = new THREE.PlaneGeometry(1.5, 1.5);
    const photoMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    const photo = new THREE.Mesh(photoGeo, photoMat);
    photo.position.z = 0.07;

    const group = new THREE.Group();
    group.add(frame);
    group.add(photo);
    group.scale.setScalar(0.8);
    group.userData.isPhoto = true;
    group.userData.frameMat = frameMat;

    photoGroupRef.current.add(group);
    const p = createParticleData(group, 'PHOTO', false);
    particlesRef.current.push(p);
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
        (Math.random() - 0.5) * (type === 'PHOTO' ? 0.3 : 2.0),
        (Math.random() - 0.5) * (type === 'PHOTO' ? 0.3 : 2.0),
        (Math.random() - 0.5) * (type === 'PHOTO' ? 0.3 : 2.0)
      )
    };

    const h = CONFIG.particles.treeHeight;
    let t = Math.random();
    t = Math.pow(t, 0.8);
    const y = (t * h) - (h / 2);
    let rMax = CONFIG.particles.treeRadius * (1.1 - t);
    if (rMax < 1.0) rMax = 1.0;
    const angle = t * 40 * Math.PI + Math.random() * Math.PI * 2;
    const r = rMax * (0.8 + Math.random() * 0.4);
    data.posTree.set(Math.cos(angle) * r, y, Math.sin(angle) * r);

    let rScatter = isDust ? (18 + Math.random() * 30) : (12 + Math.random() * 20);
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

    // "Bonne et heureuse année 2026" réduit pour fit l'écran
    formationsRef.current.love = generatePointsFromText("Je t'aime", 120);
    formationsRef.current.year = generatePointsFromText("Bonne et heureuse année 2026", 65);
    formationsRef.current.heart = generateHeartPoints(1000);

    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(CONFIG.colors.bg);
    scene.fog = new THREE.FogExp2(CONFIG.colors.bg, 0.012);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    cameraRef.current = camera;
    camera.position.set(0, 0, CONFIG.camera.z);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    rendererRef.current = renderer;
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 2.0;
    containerRef.current.appendChild(renderer.domElement);

    const mainGroup = mainGroupRef.current;
    scene.add(mainGroup);
    mainGroup.add(photoGroupRef.current);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const spotGold = new THREE.SpotLight(0xffeeba, 3000);
    spotGold.position.set(20, 50, 40);
    scene.add(spotGold);

    const sphereGeo = new THREE.SphereGeometry(0.5, 12, 12);
    const boxGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const goldMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.champagneGold, metalness: 1.0, roughness: 0.1 });
    const greenMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.deepGreen, metalness: 0.1, roughness: 0.8 });
    const redMat = new THREE.MeshPhysicalMaterial({ color: CONFIG.colors.accentRed, metalness: 0.3, roughness: 0.2, clearcoat: 1.0 });

    for (let i = 0; i < CONFIG.particles.count; i++) {
      const rand = Math.random();
      const mesh = new THREE.Mesh(rand < 0.6 ? boxGeo : sphereGeo, rand < 0.4 ? greenMat : rand < 0.8 ? goldMat : redMat);
      mesh.scale.setScalar(0.3 + Math.random() * 0.7);
      mainGroup.add(mesh);
      particlesRef.current.push(createParticleData(mesh, 'BASE', false));
    }

    const dustGeo = new THREE.TetrahedronGeometry(0.15, 0);
    const dustMat = new THREE.MeshBasicMaterial({ color: 0xfff4d1, transparent: true, opacity: 0.6 });
    for (let i = 0; i < CONFIG.particles.dustCount; i++) {
      const mesh = new THREE.Mesh(dustGeo, dustMat.clone());
      mainGroup.add(mesh);
      particlesRef.current.push(createParticleData(mesh, 'DUST', true));
    }

    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.8, 0),
      new THREE.MeshStandardMaterial({ color: 0xfff2a1, emissive: 0xffcc00, emissiveIntensity: 5.0 })
    );
    star.position.y = CONFIG.particles.treeHeight / 2 + 1.2;
    mainGroup.add(star);

    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.8);
    bloomPass.strength = 0.7;
    const composer = new EffectComposer(renderer);
    composerRef.current = composer;
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    const animate = () => {
      requestAnimationFrame(animate);
      const dt = clock.current.getDelta();
      const time = clock.current.elapsedTime;
      const state = stateRef.current;

      const isInMessageMode = ['MESSAGE_LOVE', 'MESSAGE_YEAR', 'MESSAGE_HEART'].includes(state.mode);
      
      // ROTATION CONTROLS
      if (state.mode === 'SCATTER' && state.handDetected) {
          // Amplification du mouvement horizontal de la main
          const targetRotY = state.handX * 4.0; 
          state.rotationY += (targetRotY - state.rotationY) * 3.5 * dt;
      } else {
          const rotationSpeed = (state.mode === 'TREE' ? 0.25 : isInMessageMode ? 0.05 : 0.08);
          state.rotationY += rotationSpeed * dt;
      }
      
      mainGroup.rotation.y = state.rotationY;
      mainGroup.rotation.x += (0 - mainGroup.rotation.x) * 2.0 * dt;

      let currentFormation: THREE.Vector3[] = [];
      if (state.mode === 'MESSAGE_LOVE') currentFormation = formationsRef.current.love;
      if (state.mode === 'MESSAGE_YEAR') currentFormation = formationsRef.current.year;
      if (state.mode === 'MESSAGE_HEART') currentFormation = formationsRef.current.heart;

      let dustCounter = 0;

      particlesRef.current.forEach((p, idx) => {
        let targetPos = (state.mode === 'TREE') ? p.posTree : p.posScatter;
        let targetScale = p.baseScale;
        let lerpFactor = 2.5;

        // Message au premier plan (Z=30 pour être très proche de la caméra)
        if (p.isDust && currentFormation.length > 0) {
            const pointIdx = dustCounter % currentFormation.length;
            const rawTarget = currentFormation[pointIdx];
            
            // On projette à Z=30 devant la caméra dans le monde
            const heroWorldPos = new THREE.Vector3(rawTarget.x, rawTarget.y, 30);
            
            // On neutralise la rotation du mainGroup pour que le texte reste face écran
            const invMatrix = new THREE.Matrix4().copy(mainGroup.matrixWorld).invert();
            targetPos = heroWorldPos.applyMatrix4(invMatrix);
            
            targetScale = 0.9;
            lerpFactor = 9.0; 
            
            if (p.mesh.material) {
                p.mesh.material.opacity = 1.0;
                if (state.mode === 'MESSAGE_HEART') {
                    p.mesh.material.color.setHex(0xff0000);
                    p.mesh.scale.setScalar(targetScale * (1.0 + Math.sin(time * 5) * 0.2)); // Battement de coeur
                } else {
                    p.mesh.material.color.setHex(0xfff4d1);
                }
            }
            dustCounter++;
        } else if (p.isDust) {
            if (p.mesh.material) p.mesh.material.opacity = 0.6;
        }

        // Photo Focus
        if (state.mode === 'FOCUS' && p.mesh === state.focusTarget) {
            const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const heroWorldPos = new THREE.Vector3().copy(camera.position).add(cameraForward.multiplyScalar(15));
            const invMatrix = new THREE.Matrix4().copy(mainGroup.matrixWorld).invert();
            targetPos = heroWorldPos.applyMatrix4(invMatrix);
            targetScale = 6.5; 
            lerpFactor = 7.0;
            p.mesh.lookAt(camera.position);
        } else if (state.mode === 'FOCUS') {
            targetScale *= 0.4;
        }

        p.mesh.position.lerp(targetPos, lerpFactor * dt);
        const s = new THREE.Vector3(targetScale, targetScale, targetScale);
        p.mesh.scale.lerp(s, 4.0 * dt);

        if (p.mesh !== state.focusTarget && !isInMessageMode) {
            if (state.mode === 'TREE') p.mesh.rotation.y += 0.4 * dt;
            else {
                p.mesh.rotation.x += p.spinSpeed.x * dt;
                p.mesh.rotation.y += p.spinSpeed.y * dt;
            }
        }
      });

      composer.render();
    };
    animate();

    const handleResize = () => {
        if (!camera || !renderer || !composer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (containerRef.current) containerRef.current.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 z-0 bg-black" />;
});

export default ThreeCanvas;
