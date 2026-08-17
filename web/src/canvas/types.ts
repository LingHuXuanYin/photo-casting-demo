/**
 * 画布元素类型定义
 *
 * 所有画布元素共享基础字段 (x, y, w, h, rotation, etc.)
 * 具体类型 (Rect / Image / Text) 在此基础上扩展
 */

export type ElementId = string;

export type ElementType = 'rect' | 'image' | 'text';

interface ElementBase {
  id: ElementId;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number; // 度
  zIndex: number;
  locked?: boolean;
  hidden?: boolean;
  name?: string; // 用户可重命名（图层面板会用到）
}

export interface RectElement extends ElementBase {
  type: 'rect';
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
}

export interface ImageElement extends ElementBase {
  type: 'image';
  /** base64 data URL（v1 本地部署走 IndexedDB / 直接传给后端） */
  src: string;
  /** 'cover' 裁剪填满 / 'contain' 完整显示 */
  fit: 'cover' | 'contain';
  /** 模板占位标记：true 时双击会打开文件选择器，用户上传后转为 false */
  isPlaceholder?: boolean;
}

export interface TextElement extends ElementBase {
  type: 'text';
  content: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: 'normal' | 'bold' | 'italic' | 'bold italic';
  fill: string;
  textAlign: 'left' | 'center' | 'right';
  lineHeight: number;
  /**
   * 链接到 model 字段。设置后，content 会根据当前 model 自动更新。
   *  - 'name'         : 模特姓名
   *  - 'englishName'  : 英文名/艺名
   *  - 'height'       : 身高（含单位，如 "167cm"）
   *  - 'weight'       : 体重（含单位，如 "47kg"）
   *  - 'bwh'          : 三围（"73-62-83" 格式）
   *  - 'shoe'         : 鞋码（如 "38"）
   *  - 'stats'        : 身高/三围/鞋码 合并显示（兼容老模板）
   *  - 'contact'      : 经纪公司/电话/邮箱
   */
  linkedField?:
    | 'name'
    | 'englishName'
    | 'height'
    | 'weight'
    | 'bwh'
    | 'shoe'
    | 'stats'
    | 'contact';
}

export type CanvasElement = RectElement | ImageElement | TextElement;

/**
 * 画布元数据：尺寸、背景、单位
 */
export interface CanvasMeta {
  width: number;  // pt
  height: number; // pt
  background: string;
  unit: 'pt';
  name: string; // 例如 "A4 竖版"
}

/**
 * 画布预设尺寸
 */
export const CANVAS_PRESETS: Array<CanvasMeta & { id: string }> = [
  { id: 'a4-portrait',  name: 'A4 竖版',  width: 595,  height: 842,  background: '#FFFFFF', unit: 'pt' },
  { id: 'a4-landscape', name: 'A4 横版',  width: 842,  height: 595,  background: '#FFFFFF', unit: 'pt' },
  { id: 'square-1-1',   name: '1:1 方形', width: 800,  height: 800,  background: '#FFFFFF', unit: 'pt' },
  { id: 'portrait-3-4', name: '3:4 竖版', width: 600,  height: 800,  background: '#FFFFFF', unit: 'pt' },
  { id: 'landscape-4-3',name: '4:3 横版', width: 800,  height: 600,  background: '#FFFFFF', unit: 'pt' },
  { id: 'a5-portrait',  name: 'A5 竖版',  width: 420,  height: 595,  background: '#FFFFFF', unit: 'pt' },
  { id: 'card-business',name: '名片横版', width: 290,  height: 200,  background: '#FFFFFF', unit: 'pt' },
];

export const DEFAULT_CANVAS = CANVAS_PRESETS[0]!;

/**
 * 选中状态：支持单选 / 多选
 */
export type Selection = ElementId[];

/**
 * 工具栏当前工具
 */
export type Tool = 'select' | 'rect' | 'text';
