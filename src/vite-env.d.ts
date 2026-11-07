/// <reference types="vite/client" />

declare const __APP_VERSION__: string;
declare const __BUILD_NUMBER__: string;

interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string;
  // Add other environment variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}