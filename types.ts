export enum AppState {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PROCESSING = 'PROCESSING',
  TRANSCRIBING = 'TRANSCRIBING',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR',
}

export enum ModelType {
  FLASH = 'gemini-2.5-flash',
  FLASH_LITE = 'gemini-2.5-flash-lite-preview-02-05', // Using latest preview as literal lite mapping might vary
  PRO = 'gemini-3-pro-preview',
}

export interface TranscriptionSettings {
  model: string;
  identifySpeakers: boolean;
  speakerNames: string[]; // Changed to array for dynamic inputs
  timestamps: boolean;
}

export interface TranscriptionResult {
  text: string;
  chunks: string[]; // For segment-based rendering
}

export interface ErrorDetails {
  message: string;
  code?: string;
  suggestion?: string;
}