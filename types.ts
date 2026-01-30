
export interface MemoryData {
  name: string;
  relationship: string;
  detail: string;
  mood: 'nostalgic' | 'bittersweet' | 'hopeful' | 'grieving';
}

export interface GenerationResult {
  letter: string;
  imageUrl: string;
  audioData?: string;
  citations?: { title: string; uri: string }[];
}

export enum AppState {
  LANDING = 'landing',
  INPUT = 'input',
  GENERATING = 'generating',
  REVEAL = 'reveal'
}
