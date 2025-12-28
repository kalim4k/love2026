
import React, { useRef, useEffect } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { SceneMode } from '../types';

interface HandTrackerProps {
  onUpdate: (x: number, y: number, detected: boolean, mode: SceneMode) => void;
}

const HandTracker: React.FC<HandTrackerProps> = ({ onUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const lastVideoTime = useRef<number>(-1);
  const currentModeRef = useRef<SceneMode>('TREE');

  useEffect(() => {
    const init = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
      );
      landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
      });

      if (navigator.mediaDevices?.getUserMedia && videoRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener("loadeddata", predict);
      }
    };

    const predict = async () => {
      if (!videoRef.current || !landmarkerRef.current) return;

      const now = performance.now();
      if (videoRef.current.currentTime !== lastVideoTime.current) {
        lastVideoTime.current = videoRef.current.currentTime;
        const result = landmarkerRef.current.detectForVideo(videoRef.current, now);

        if (result.landmarks && result.landmarks.length > 0) {
          const lm = result.landmarks[0];
          const x = -(lm[9].x - 0.5) * 2;
          const y = -(lm[9].y - 0.5) * 2;

          // Détection de l'état des doigts
          const isFingerUp = (tipIdx: number, pipIdx: number) => lm[tipIdx].y < lm[pipIdx].y;
          
          const indexUp = isFingerUp(8, 6);
          const middleUp = isFingerUp(12, 10);
          const ringUp = isFingerUp(16, 14);
          const pinkyUp = isFingerUp(20, 18);
          const thumbUp = lm[4].x < lm[3].x; // Simplifié pour main droite/gauche

          // Comptage des doigts (hors pouce pour la simplicité du geste)
          const fingersUpCount = [indexUp, middleUp, ringUp, pinkyUp].filter(Boolean).length;
          
          const thumbTip = lm[4];
          const indexTip = lm[8];
          const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);

          let mode: SceneMode = currentModeRef.current;
          
          if (pinchDist < 0.05) {
            mode = 'FOCUS';
          } else if (fingersUpCount === 1 && indexUp) {
            mode = 'MESSAGE_LOVE'; // 1 doigt -> Je t'aime
          } else if (fingersUpCount === 2 && indexUp && middleUp) {
            mode = 'MESSAGE_YEAR'; // 2 doigts -> Bonne année 2026
          } else if (fingersUpCount === 3 && indexUp && middleUp && ringUp) {
            mode = 'MESSAGE_HEART'; // 3 doigts -> Coeur
          } else if (fingersUpCount === 0) {
            mode = 'TREE';
          } else if (fingersUpCount >= 4) {
            mode = 'SCATTER';
          }
          
          currentModeRef.current = mode;
          onUpdate(x, y, true, mode);
        } else {
          onUpdate(0, 0, false, currentModeRef.current);
        }
      }
      requestAnimationFrame(predict);
    };

    init();
  }, [onUpdate]);

  return (
    <div className="fixed bottom-4 right-4 w-32 h-24 border border-white/10 rounded overflow-hidden z-50 pointer-events-none opacity-0 hover:opacity-50 transition-opacity">
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale invert" />
    </div>
  );
};

export default HandTracker;
