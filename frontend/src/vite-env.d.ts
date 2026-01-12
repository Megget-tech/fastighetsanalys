/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_MAPBOX_TOKEN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '@mapbox/mapbox-gl-draw' {
  import { IControl } from 'mapbox-gl';

  export interface DrawOptions {
    displayControlsDefault?: boolean;
    controls?: {
      polygon?: boolean;
      trash?: boolean;
    };
    defaultMode?: string;
  }

  export default class MapboxDraw implements IControl {
    constructor(options?: DrawOptions);
    onAdd(map: any): HTMLElement;
    onRemove(map: any): void;
    getAll(): any;
    deleteAll(): void;
  }
}
