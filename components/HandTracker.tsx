
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
    let isMounted = true;
    const init = async () => {
      try {
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

        if (navigator.mediaDevices?.getUserMedia && videoRef.current && isMounted) {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 } 
          });
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
            if (isMounted) predict();
          };
        }
      } catch (e) {
        console.warn("Hand Tracker init failed, continuing without gestural control:", e);
      }
    };

    const predict = async () => {
      if (!videoRef.current || !landmarkerRef.current || !isMounted) return;

      const now = performance.now();
      if (videoRef.current.currentTime !== lastVideoTime.current) {
        lastVideoTime.current = videoRef.current.currentTime;
        const result = landmarkerRef.current.detectForVideo(videoRef.current, now);

        if (result.landmarks && result.landmarks.length > 0) {
          const lm = result.landmarks[0];
          const x = -(lm[9].x - 0.5) * 2;
          const y = -(lm[9].y - 0.5) * 2;

          const isFingerUp = (tip: number, pip: number) => lm[tip].y < lm[pip].y;
          const upCount = [isFingerUp(8,6), isFingerUp(12,10), isFingerUp(16,14), isFingerUp(20,18)].filter(Boolean).length;
          const pinch = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y) < 0.05;

          let mode: SceneMode = currentModeRef.current;
          if (pinch) mode = 'FOCUS';
          else if (upCount === 1) mode = 'MESSAGE_LOVE';
          else if (upCount === 2) mode = 'MESSAGE_YEAR';
          else if (upCount === 3) mode = 'MESSAGE_HEART';
          else if (upCount === 0) mode = 'TREE';
          else if (upCount >= 4) mode = 'SCATTER';
          
          currentModeRef.current = mode;
          onUpdate(x, y, true, mode);
        } else {
          onUpdate(0, 0, false, currentModeRef.current);
        }
      }
      if (isMounted) requestAnimationFrame(predict);
    };

    init();

    return () => {
      isMounted = false;
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [onUpdate]);

  return (
    <div className="fixed bottom-4 right-4 w-32 h-24 border border-white/10 rounded overflow-hidden z-50 pointer-events-none opacity-0">
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
    </div>
  );
};

export default HandTracker;