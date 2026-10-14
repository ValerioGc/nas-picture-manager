export interface ImageInfo {
  name: string;
  folder: string | null;
  width: number;
  height: number;
  format: string;
  hasAlpha: boolean;
  size: number;
  created: number | null;
  modified: number | null;
}

export interface ImageDocument {
  info: ImageInfo;
  preview: number[] | Uint8Array<ArrayBuffer>;
}

export interface ImageEntry {
  id: number;
  name: string;
  file?: File;
  source?: PickedFile;
}

export interface PickedFile {
  name: string;
  path: string;
  url: string;
}

export interface FilePickerOptions {
  multiple?: boolean;
  extensions?: string[];
  directory?: string;
}

export interface FileSelection {
  files: PickedFile[];
  cancelled: boolean;
  error?: string;
}

export type Sidebar = 'info' | 'edit' | null;

export type Zoom = 'fit' | number;

export type ImageErrorCode =
  | 'invalid_input'
  | 'file_too_large'
  | 'pixel_limit_exceeded'
  | 'dimension_limit_exceeded'
  | 'decode_memory_limit_exceeded'
  | 'too_many_files'
  | 'unsupported_format'
  | 'invalid_image'
  | 'unavailable'
  | 'busy'
  | 'invalid_edits'
  | 'save_failed'
  | 'overwrite_original';

export interface CropRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageEdits {
  rotation: number;
  flipHorizontal: boolean;
  flipVertical: boolean;
  brightness: number;
  contrast: number;
  sharpness: number;
  crop: CropRectangle | null;
}

export type ExportFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'bmp' | 'tiff' | 'ico';

export interface ImagePoint {
  x: number;
  y: number;
}

export type AnnotationKind = 'rectangle' | 'circle' | 'line' | 'text' | 'pen' | 'highlight';
export type AnnotationTool = AnnotationKind | 'select';

export interface AnnotationStyle {
  color: string;
  size: number;
  opacity: number;
  filled: boolean;
  fontSize: number;
}

export interface ImageAnnotation extends ImagePoint {
  id: number;
  kind: AnnotationKind;
  width: number;
  height: number;
  text: string;
  points: ImagePoint[];
  style: AnnotationStyle;
}
