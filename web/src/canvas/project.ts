/**
 * Project 数据模型
 *
 * 一个 Project = 一张模卡的所有状态：画布元数据 + 元素列表 + 模特信息
 * 项目存到 IndexedDB，关浏览器不丢
 */

import type { CanvasElement, CanvasMeta } from './types';

export interface ModelInfo {
  name?: string;
  englishName?: string;
  height?: number; // cm
  weight?: number; // kg
  bust?: number;
  waist?: number;
  hips?: number;
  shoe?: number;
  hairColor?: string;
  eyeColor?: string;
  skinTone?: string;
  agency?: string;
  agentName?: string;
  agentPhone?: string;
  email?: string;
  city?: string;
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  /** 画布缩略图 dataURL（导出后存的） */
  thumbnail?: string;
  canvas: CanvasMeta;
  elements: CanvasElement[];
  model: ModelInfo;
}

export const emptyProject = (id: string, name: string): Project => ({
  id,
  name,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  canvas: { width: 595, height: 842, background: '#FFFFFF', unit: 'pt', name: 'A4 竖版' },
  elements: [],
  model: {},
});

export const genProjectId = (): string =>
  `proj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * 根据 model 字段和 linkedField 生成实际展示文本
 */
export function getModelLinkedText(
  field:
    | 'name'
    | 'englishName'
    | 'height'
    | 'weight'
    | 'bwh'
    | 'shoe'
    | 'stats'
    | 'contact',
  model: ModelInfo,
): string {
  switch (field) {
    case 'name':
      return model.name?.trim() || '模特姓名';
    case 'englishName':
      return model.englishName?.trim() || 'English Name';
    case 'height':
      return model.height ? `${model.height}cm` : '167cm';
    case 'weight':
      return model.weight ? `${model.weight}kg` : '47kg';
    case 'bwh': {
      if (model.bust && model.waist && model.hips) {
        return `${model.bust}-${model.waist}-${model.hips}`;
      }
      return '73-62-83';
    }
    case 'shoe':
      return model.shoe ? `${model.shoe}` : '38';
    case 'stats': {
      const parts: string[] = [];
      if (model.height) parts.push(`身高 ${model.height}cm`);
      if (model.bust) parts.push(`胸 ${model.bust}`);
      if (model.waist) parts.push(`腰 ${model.waist}`);
      if (model.hips) parts.push(`臀 ${model.hips}`);
      if (model.shoe) parts.push(`鞋 ${model.shoe}`);
      return parts.join(' / ') || '身高 / 三围 / 鞋码';
    }
    case 'contact': {
      const parts: string[] = [];
      if (model.agency) parts.push(model.agency);
      if (model.agentName) parts.push(model.agentName);
      if (model.agentPhone) parts.push(model.agentPhone);
      if (model.email) parts.push(model.email);
      if (parts.length === 0) {
        return '联系方式 · 经纪公司';
      }
      return parts.join(' · ');
    }
  }
}
