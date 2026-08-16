/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_AUTH_INACTIVITY_TIMEOUT_MINUTES?: string;
  readonly VITE_AUTH_ACTIVITY_PING_INTERVAL_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
