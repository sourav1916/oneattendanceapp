import type { ComponentType } from 'react';

export declare const DevTools: ComponentType<{
  initialPosition?: {
    x: number;
    y: number;
  };
}>;

export declare function installDevTools(options?: {
  axiosInstance?: unknown;
  fetch?: boolean;
  console?: boolean;
}): () => void;
