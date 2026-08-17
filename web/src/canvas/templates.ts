/**
 * 内置模板
 *
 * 每个模板是一个完整的画布状态（含 elements）。
 * 图片位置是带 isPlaceholder 标记的 Image 元素，
 * 应用模板时自动生成白底+文字的占位图，dataURL 填到 src。
 * 用户双击占位图或用属性面板的"替换图片"按钮上传真图。
 *
 * v1 极简：5 个模板，覆盖主要场景
 * v2 会加：用户自定义模板
 */

import type { CanvasElement, CanvasMeta, ImageElement } from './types';
import { generatePlaceholderDataURL } from './placeholderImage';

export interface Template {
  id: string;
  name: string;
  description: string;
  thumbnail: string; // emoji 或描述
  canvas: CanvasMeta;
  elements: CanvasElement[];
}

const genId = (seed: string) => `tpl_${seed}_${Math.random().toString(36).slice(2, 6)}`;

/**
 * 图片占位元素（带 isPlaceholder 标记的 Image）
 * src 在 apply 模板时由 generatePlaceholderDataURL 生成
 */
const imagePlaceholder = (
  x: number,
  y: number,
  w: number,
  h: number,
  zIndex: number,
  seed: string,
  _text: string = '双击上传照片',
): ImageElement => ({
  id: genId(seed),
  type: 'image',
  x,
  y,
  w,
  h,
  rotation: 0,
  zIndex,
  src: '', // apply 时填充
  fit: 'cover',
  isPlaceholder: true,
  name: '图片占位',
});

/**
 * 应用模板时为所有占位元素生成 dataURL
 */
export function fillPlaceholders(elements: CanvasElement[]): CanvasElement[] {
  return elements.map((el) => {
    if (el.type === 'image' && el.isPlaceholder) {
      return {
        ...el,
        src: generatePlaceholderDataURL(el.w, el.h, '双击上传照片'),
      };
    }
    return el;
  });
}

const text = (
  x: number,
  y: number,
  w: number,
  h: number,
  content: string,
  fontSize: number,
  zIndex: number,
  seed: string,
  fill: string = '#1a1d24',
  textAlign: 'left' | 'center' | 'right' = 'left',
  fontStyle: 'normal' | 'bold' | 'italic' | 'bold italic' = 'normal',
  linkedField?:
    | 'name'
    | 'englishName'
    | 'height'
    | 'weight'
    | 'bwh'
    | 'shoe'
    | 'stats'
    | 'contact',
  fontFamily: string = '"Inter", "Source Han Sans SC", sans-serif',
  lineHeight: number = 1.2,
): CanvasElement => ({
  id: genId(seed),
  type: 'text',
  x,
  y,
  w,
  h,
  rotation: 0,
  zIndex,
  content,
  fontSize,
  fontFamily,
  fontStyle,
  fill,
  textAlign,
  lineHeight,
  linkedField,
});

const line = (
  x: number,
  y: number,
  w: number,
  zIndex: number,
  seed: string,
): CanvasElement => ({
  id: genId(seed),
  type: 'rect',
  x,
  y,
  w: w,
  h: 1,
  rotation: 0,
  zIndex,
  fill: '#1a1d24',
  stroke: '#1a1d24',
  strokeWidth: 0,
  cornerRadius: 0,
});

// ============== 模板 1：经典竖版 ==============
// A4 竖版 595×842
// 上方主图 + 下方 3 张辅图 + 底部模特信息
const classicPortrait: Template = {
  id: 'classic-portrait',
  name: '经典竖版',
  description: '1 张主图 + 3 张辅图 + 模特信息',
  thumbnail: '📇',
  canvas: { width: 595, height: 842, background: '#FFFFFF', unit: 'pt', name: 'A4 竖版' },
  elements: [
    // 主图：上方居中
    imagePlaceholder(45, 45, 505, 480, 1, 'main'),
    // 辅图 1
    imagePlaceholder(45, 545, 165, 200, 3, 'aux1'),
    // 辅图 2
    imagePlaceholder(215, 545, 165, 200, 3, 'aux2'),
    // 辅图 3
    imagePlaceholder(385, 545, 165, 200, 3, 'aux3'),

    // 分隔线
    line(45, 760, 505, 5, 'divider'),

    // 模特信息（linkedField 自动同步）
    text(45, 770, 250, 28, '模特姓名', 20, 6, 'name', '#1a1d24', 'left', 'bold', 'name'),
    text(45, 800, 280, 18, '身高 172cm / 胸 86 / 腰 60 / 臀 88', 11, 6, 'stats', '#4a4f5a', 'left', 'normal', 'stats'),
    text(300, 770, 250, 18, '经纪公司 / 联系方式', 11, 6, 'contact', '#4a4f5a', 'right', 'normal', 'contact'),
  ],
};

// ============== 模板 2：现代横版 ==============
// A4 横版 842×595
// 左侧大图 + 右侧 2 张小图 + 信息
const modernLandscape: Template = {
  id: 'modern-landscape',
  name: '现代横版',
  description: '左侧主图 + 右侧双图 + 信息',
  thumbnail: '🌄',
  canvas: { width: 842, height: 595, background: '#FFFFFF', unit: 'pt', name: 'A4 横版' },
  elements: [
    // 左侧大图
    imagePlaceholder(40, 40, 480, 515, 1, 'main'),
    // 右上 1
    imagePlaceholder(540, 40, 262, 250, 3, 'aux1'),
    // 右下 2
    imagePlaceholder(540, 305, 262, 250, 3, 'aux2'),

    // 右侧文字
    text(540, 565, 262, 22, '模特姓名', 16, 6, 'name', '#1a1d24', 'right', 'bold', 'name'),
  ],
};

// ============== 模板 3：极简 1:1 ==============
// 800×800 方形
// 整张大图 + 底部小信息条
const minimal: Template = {
  id: 'minimal-1-1',
  name: '极简方形',
  description: '整图 + 底部一行信息',
  thumbnail: '◾',
  canvas: { width: 800, height: 800, background: '#FFFFFF', unit: 'pt', name: '1:1 方形' },
  elements: [
    // 大图
    imagePlaceholder(40, 40, 720, 620, 1, 'main'),

    // 底部信息条（linkedField 自动同步）
    text(40, 690, 500, 30, '模特姓名', 22, 4, 'name', '#1a1d24', 'left', 'bold', 'name'),
    text(40, 725, 720, 18, '身高 172cm / 胸 86 / 腰 60 / 臀 88 / 鞋 39', 12, 4, 'stats', '#4a4f5a', 'left', 'normal', 'stats'),
    text(40, 745, 720, 18, '联系方式 · 经纪公司', 12, 4, 'contact', '#4a4f5a', 'left', 'normal', 'contact'),
  ],
};

// ============== 模板 4：大片风格 ==============
// A4 竖版 595×842
// 顶部大图 + 中部双图 + 底部模特名
const magazine: Template = {
  id: 'magazine',
  name: '大片风格',
  description: '顶部主图 + 中部双图 + 底部品牌',
  thumbnail: '📸',
  canvas: { width: 595, height: 842, background: '#0f1115', unit: 'pt', name: 'A4 竖版' },
  elements: [
    // 顶部主图
    imagePlaceholder(0, 0, 595, 500, 1, 'main'),
    // 中部双图
    imagePlaceholder(30, 520, 265, 220, 3, 'aux1'),
    imagePlaceholder(300, 520, 265, 220, 3, 'aux2'),

    // 底部标题（linkedField 自动同步）
    text(30, 760, 535, 30, 'MODEL NAME', 24, 6, 'name', '#FFFFFF', 'left', 'bold', 'name'),
    text(30, 795, 535, 14, 'HEIGHT 172cm / BUST 86 / WAIST 60 / HIPS 88', 10, 6, 'stats', '#9ca3af', 'left', 'normal', 'stats'),
    text(30, 815, 535, 14, 'AGENCY · EMAIL · PHONE', 10, 6, 'contact', '#6b7488', 'left', 'normal', 'contact'),
  ],
};

// ============== 模板 5：黑白大片（参考图）==============
// 1600×800 横版 (2:1)
// 左：22% 黑色信息栏（姓名 + 4 行中英双语 stats）
// 中：30% 全身照
// 右：48% 2×2 头像网格
const blackWhite: Template = {
  id: 'black-white',
  name: '黑白大片',
  description: '左黑右白 · 全身+2×2头像 · 中英双语 stats',
  thumbnail: '🖤',
  canvas: { width: 1600, height: 800, background: '#FFFFFF', unit: 'pt', name: '黑白大片 1600×800' },
  elements: [
    // ===== 底层：整画布黑色背景（1600×800）=====
    {
      id: genId('bg-black'),
      type: 'rect',
      x: 0,
      y: 0,
      w: 1600,
      h: 800,
      rotation: 0,
      zIndex: 0,
      fill: '#000000',
      stroke: '#000000',
      strokeWidth: 0,
      cornerRadius: 0,
      name: '黑色背景',
    },
    // ===== 右侧白色面板（覆盖非信息栏区域）=====
    {
      id: genId('bg-white'),
      type: 'rect',
      x: 350,
      y: 0,
      w: 1250,
      h: 800,
      rotation: 0,
      zIndex: 0,
      fill: '#FFFFFF',
      stroke: '#FFFFFF',
      strokeWidth: 0,
      cornerRadius: 0,
      name: '白色面板',
    },

    // 模特姓名（大字、白色、粗体）
    text(40, 60, 270, 90, '模特姓名', 64, 1, 'name', '#FFFFFF', 'left', 'bold', 'name', '"Source Han Sans SC", "Inter", sans-serif', 1),

    // 身高
    text(40, 220, 270, 22, '身高 height', 16, 1, 'lh1', '#FFFFFF', 'left', 'normal', undefined, '"Inter", "Source Han Sans SC", sans-serif', 1),
    text(40, 246, 270, 46, '167cm', 36, 1, 'hv1', '#FFFFFF', 'left', 'bold', 'height', '"Inter", "Source Han Sans SC", sans-serif', 1),

    // 体重
    text(40, 320, 270, 22, '体重 weight', 16, 1, 'lh2', '#FFFFFF', 'left', 'normal', undefined, '"Inter", "Source Han Sans SC", sans-serif', 1),
    text(40, 346, 270, 46, '47kg', 36, 1, 'hv2', '#FFFFFF', 'left', 'bold', 'weight', '"Inter", "Source Han Sans SC", sans-serif', 1),

    // 三围
    text(40, 420, 270, 22, '三围 BWH', 16, 1, 'lh3', '#FFFFFF', 'left', 'normal', undefined, '"Inter", "Source Han Sans SC", sans-serif', 1),
    text(40, 446, 270, 46, '73-62-83', 36, 1, 'hv3', '#FFFFFF', 'left', 'bold', 'bwh', '"Inter", "Source Han Sans SC", sans-serif', 1),

    // 鞋码
    text(40, 520, 270, 22, '鞋码 shoe size', 16, 1, 'lh4', '#FFFFFF', 'left', 'normal', undefined, '"Inter", "Source Han Sans SC", sans-serif', 1),
    text(40, 546, 270, 46, '38', 36, 1, 'hv4', '#FFFFFF', 'left', 'bold', 'shoe', '"Inter", "Source Han Sans SC", sans-serif', 1),

    // ===== 中间全身照 =====
    imagePlaceholder(380, 20, 460, 760, 1, 'main'),

    // ===== 右侧 2×2 头像网格 =====
    imagePlaceholder(860, 20, 350, 370, 3, 'aux1'),
    imagePlaceholder(1230, 20, 350, 370, 3, 'aux2'),
    imagePlaceholder(860, 410, 350, 370, 3, 'aux3'),
    imagePlaceholder(1230, 410, 350, 370, 3, 'aux4'),
  ],
};

export const TEMPLATES: Template[] = [
  classicPortrait,
  modernLandscape,
  minimal,
  magazine,
  blackWhite,
];
