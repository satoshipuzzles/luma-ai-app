// types/luma.ts
export type CameraMotion = 'static' | 'orbit' | 'dolly' | 'pan' | 'tilt';
export type CameraDirection = 'left' | 'right' | 'up' | 'down';

export interface CameraMotionConfig {
  type: CameraMotion;
  speed: number;
  direction: CameraDirection;
}

export interface GenerationOptions {
  aspectRatio: string;
  loop: boolean;
  cameraMotion: CameraMotionConfig;
}
