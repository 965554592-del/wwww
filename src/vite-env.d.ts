/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
