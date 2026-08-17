/**
 * 渲染接口类型（前后端共用）
 *
 * 前端把画布 JSON 序列化后 POST 到 /api/cards/render，
 * 字段命名和前端 store 完全一致。
 */

export interface CanvasMeta {
  width: number;
  height: number;
  background: string;
  unit: 'pt';
  name?: string;
}

export interface RectElement {
  id: string;
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  zIndex: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
  hidden?: boolean;
  name?: string;
}

export interface ImageElement {
  id: string;
  type: 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  zIndex: number;
  /** base64 data URL 或 data:image/png;base64,... */
  src: string;
  fit: 'cover' | 'contain';
  isPlaceholder?: boolean;
  hidden?: boolean;
  name?: string;
}

export interface TextElement {
  id: string;
  type: 'text';
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  zIndex: number;
  content: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: 'normal' | 'bold' | 'italic' | 'bold italic';
  fill: string;
  textAlign: 'left' | 'center' | 'right';
  lineHeight: number;
  hidden?: boolean;
  name?: string;
}

export type CanvasElement = RectElement | ImageElement | TextElement;

export interface RenderRequest {
  canvas: CanvasMeta;
  elements: CanvasElement[];
  format: 'jpg' | 'pdf';
  /** 1 = 标准，2 = 高清（2x 像素），最大 4 */
  scale?: 1 | 2 | 4;
  /** JPEG 质量 1-100 */
  quality?: number;
  /** 文件名（用于下载） */
  filename?: string;
}
