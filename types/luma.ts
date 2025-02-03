// types/luma.ts
export type LumaModel = 'ray-2' | 'ray-1-6' | 'photon-1' | 'photon-flash-1';
export type CameraMotion = 'static' | 'orbit' | 'dolly' | 'pan' | 'tilt';
export type CameraDirection = 'left' | 'right' | 'up' | 'down';

export interface CameraMotionConfig {
  type: CameraMotion;
  speed: number;
  direction: CameraDirection;
}

export interface GenerationOptions {
  model: LumaModel;  // Added this field
  prompt: string;
  aspectRatio: string;
  loop: boolean;
  cameraMotion: CameraMotionConfig;
}

export interface ModelConfig {
  name: string;
  description: string;
  defaultFee: number;
  type: 'video' | 'image';
  features: string[];
}

export const MODEL_CONFIGS: Record<LumaModel, ModelConfig> = {
  'ray-2': {
    name: 'Ray 2',
    description: 'Latest and most advanced video model',
    defaultFee: 2000,
    type: 'video',
    features: ['High quality', 'Better motion', 'Advanced camera control']
  },
  'ray-1-6': {
    name: 'Ray 1.6',
    description: 'Legacy video model',
    defaultFee: 1000,
    type: 'video',
    features: ['Basic motion', 'Faster generation']
  },
  'photon-1': {
    name: 'Photon',
    description: 'High quality image model',
    defaultFee: 500,
    type: 'image',
    features: ['Detailed images', 'High resolution']
  },
  'photon-flash-1': {
    name: 'Photon Flash',
    description: 'Fast image model',
    defaultFee: 300,
    type: 'image',
    features: ['Quick generation', 'Good for iterations']
  }
};
