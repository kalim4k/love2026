
import * as THREE from 'three';

export type SceneMode = 'TREE' | 'SCATTER' | 'FOCUS' | 'MESSAGE_LOVE' | 'MESSAGE_YEAR' | 'MESSAGE_HEART';

export interface AppState {
    mode: SceneMode;
    focusTarget: THREE.Object3D | null;
    handDetected: boolean;
    handX: number;
    handY: number;
    rotationX: number;
    rotationY: number;
    uiVisible: boolean;
    isGeneratingWish: boolean;
    lastWish: string;
}

export interface ParticleConfig {
    mesh: THREE.Mesh | THREE.Group;
    type: string;
    isDust: boolean;
    posTree: THREE.Vector3;
    posScatter: THREE.Vector3;
    posFormation: THREE.Vector3; // Position cible pour les messages
    baseScale: number;
    spinSpeed: THREE.Vector3;
}
