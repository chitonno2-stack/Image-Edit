
import type React from 'react';

export enum WorkMode {
  PORTRAIT,
  RESTORE,
  CREATIVE,
  COMPOSITE,
}

export interface ModeInfo {
  id: WorkMode;
  name: string;
  icon: React.ReactElement;
  description: string;
}

export interface ApiKey {
  key: string;
  status: 'valid' | 'invalid' | 'unknown' | 'checking';
  isActive: boolean;
}

// FIX: Added the missing `TextOverlay` interface, which is required by other components.
export interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  textAlign: 'left' | 'center' | 'right';
}
