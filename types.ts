export enum AppStatus {
  IDLE = 'IDLE',
  THINKING = 'THINKING',
  GENERATING = 'GENERATING',
  SLICING = 'SLICING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  DEBUG = 'DEBUG'
}

export interface SpriteGenerationResult {
  imageUrl: string;
  timestamp: number;
}

export type SpriteStyle = 'NEO_RETRO' | 'PIXEL_ART' | 'FLAT_VECTOR' | 'SKETCH';

export type SpriteDirection = 'FRONT' | 'SIDE' | 'SIDE_LEFT' | 'BACK' | 'ISO_FRONT' | 'ISO_BACK' | 'THREE_QUARTER';

export interface ActionPreset {
  id: string;
  label: string;
  description: string;
  promptLogic: string;
  poseId?: string; // Link to a POSE_TEMPLATE
}

export interface PromptConfig {
  positive: string;
  negative: string;
}

export interface FrameData {
  id: number;
  dataUrl: string;
}

// Added per user request logic
export interface SpriteGenerationParams {
  poseReference?: string;
}