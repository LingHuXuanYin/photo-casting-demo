/**
 * 画布状态管理 (Zustand)
 *
 * 单一 store 管理：
 *   - 画布元数据 (meta)
 *   - 元素列表 (elements)
 *   - 选中状态 (selectedIds)
 *   - 当前工具 (tool)
 *   - 编辑器设置 (settings: 网格、吸附、辅助线)
 *   - 当前项目 (projectId, projectName, model info)
 *   - 保存状态 (saveStatus)
 *
 * 所有 mutator 在修改 elements 时通过 pushHistory() 记录快照，
 * undo/redo 通过切换 past/future 栈实现。
 *
 * 拖拽等高频更新不每次 pushHistory，调用方在结束时 push 一次。
 */

import { create } from 'zustand';
import {
  type CanvasElement,
  type CanvasMeta,
  type ElementId,
  type ImageElement,
  type Selection,
  type Tool,
} from './types';
import type { ModelInfo } from './project';
import { emptyProject, genProjectId, getModelLinkedText } from './project';

interface HistorySnapshot {
  elements: CanvasElement[];
  meta: CanvasMeta;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface EditorSettings {
  showGrid: boolean;
  snapToGrid: boolean;
  showGuides: boolean;
  gridSize: number;
}

interface CanvasState {
  // ---- data ----
  meta: CanvasMeta;
  elements: CanvasElement[];
  selectedIds: Selection;
  tool: Tool;
  settings: EditorSettings;

  // ---- project ----
  projectId: string;
  projectName: string;
  model: ModelInfo;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;

  // ---- history ----
  past: HistorySnapshot[];
  future: HistorySnapshot[];

  // ---- mutators ----
  setMeta: (meta: Partial<CanvasMeta>) => void;
  addElement: (el: CanvasElement) => void;
  updateElement: (id: ElementId, patch: Partial<CanvasElement>) => void;
  updateElements: (patches: Array<{ id: ElementId; patch: Partial<CanvasElement> }>) => void;
  removeElements: (ids: ElementId[]) => void;
  duplicateElements: (ids: ElementId[]) => void;
  replaceWithImage: (id: ElementId, src: string) => void;
  setSelected: (ids: Selection) => void;
  setTool: (tool: Tool) => void;
  updateSettings: (patch: Partial<EditorSettings>) => void;

  // ---- project ops ----
  newProject: (name?: string) => void;
  loadProject: (project: {
    id: string;
    name: string;
    canvas: CanvasMeta;
    elements: CanvasElement[];
    model: ModelInfo;
  }) => void;
  setProjectName: (name: string) => void;
  setModel: (patch: Partial<ModelInfo>) => void;
  setSaveStatus: (status: SaveStatus, lastSavedAt?: number) => void;

  // ---- layer ops ----
  bringToFront: (id: ElementId) => void;
  sendToBack: (id: ElementId) => void;
  bringForward: (id: ElementId) => void;
  sendBackward: (id: ElementId) => void;

  // ---- history ops ----
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // ---- internal ----
  _pushHistory: () => void;
}

const genId = (): ElementId =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? `el_${crypto.randomUUID().slice(0, 8)}`
    : `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

const cloneElement = (el: CanvasElement): CanvasElement =>
  JSON.parse(JSON.stringify(el)) as CanvasElement;

const initialProject = emptyProject(genProjectId(), '未命名项目');

export const useCanvasStore = create<CanvasState>((set, get) => ({
  meta: initialProject.canvas,
  elements: [],
  selectedIds: [],
  tool: 'select',
  settings: {
    showGrid: false,
    snapToGrid: false,
    showGuides: true,
    gridSize: 8,
  },

  projectId: initialProject.id,
  projectName: initialProject.name,
  model: {},
  saveStatus: 'idle',
  lastSavedAt: null,

  past: [],
  future: [],

  setMeta: (patch) => {
    get()._pushHistory();
    set((s) => ({ meta: { ...s.meta, ...patch } }));
  },

  addElement: (el) => {
    get()._pushHistory();
    set((s) => ({
      elements: [...s.elements, el],
      selectedIds: [el.id],
    }));
  },

  updateElement: (id, patch) => {
    set((s) => ({
      elements: s.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as CanvasElement) : el)),
    }));
  },

  updateElements: (patches) => {
    set((s) => {
      const map = new Map(patches.map((p) => [p.id, p.patch]));
      return {
        elements: s.elements.map((el) => {
          const patch = map.get(el.id);
          return patch ? ({ ...el, ...patch } as CanvasElement) : el;
        }),
      };
    });
  },

  removeElements: (ids) => {
    if (ids.length === 0) return;
    get()._pushHistory();
    set((s) => ({
      elements: s.elements.filter((el) => !ids.includes(el.id)),
      selectedIds: s.selectedIds.filter((id) => !ids.includes(id)),
    }));
  },

  duplicateElements: (ids) => {
    if (ids.length === 0) return;
    const { elements } = get();
    const sources = elements.filter((el) => ids.includes(el.id));
    if (sources.length === 0) return;
    get()._pushHistory();
    const newIds: ElementId[] = [];
    const dupes = sources.map((src) => {
      const copy = cloneElement(src);
      copy.id = genId();
      copy.x += 16;
      copy.y += 16;
      newIds.push(copy.id);
      return copy;
    });
    const maxZ = elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
    dupes.forEach((d, i) => {
      d.zIndex = maxZ + 1 + i;
    });
    set((s) => ({
      elements: [...s.elements, ...dupes],
      selectedIds: newIds,
    }));
  },

  setSelected: (ids) => set({ selectedIds: ids }),
  setTool: (tool) => set({ tool }),
  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  newProject: (name) => {
    const fresh = emptyProject(genProjectId(), name ?? '未命名项目');
    set({
      projectId: fresh.id,
      projectName: fresh.name,
      meta: fresh.canvas,
      elements: [],
      model: {},
      selectedIds: [],
      past: [],
      future: [],
      saveStatus: 'idle',
      lastSavedAt: null,
    });
  },

  loadProject: (project) => {
    set({
      projectId: project.id,
      projectName: project.name,
      meta: project.canvas,
      elements: project.elements,
      model: project.model ?? {},
      selectedIds: [],
      past: [],
      future: [],
      saveStatus: 'saved',
      lastSavedAt: Date.now(),
    });
  },

  setProjectName: (name) => set({ projectName: name }),
  setModel: (patch) => {
    set((s) => {
      const newModel = { ...s.model, ...patch };
      // 自动同步：把画布上带 linkedField 的文本元素内容更新
      const newElements = s.elements.map((el) => {
        if (el.type === 'text' && el.linkedField) {
          const newContent = getModelLinkedText(el.linkedField, newModel);
          if (el.content === newContent) return el;
          return { ...el, content: newContent };
        }
        return el;
      });
      return { model: newModel, elements: newElements };
    });
  },
  setSaveStatus: (status, lastSavedAt) =>
    set((s) => ({
      saveStatus: status,
      lastSavedAt: lastSavedAt ?? s.lastSavedAt,
    })),

  replaceWithImage: (id, src) => {
    get()._pushHistory();
    set((s) => ({
      elements: s.elements.map((el) => {
        if (el.id !== id) return el;
        // 用同位置 / 同尺寸的 Image 替换（清掉 placeholder 标记）
        const next: ImageElement = {
          id: el.id,
          type: 'image',
          x: el.x,
          y: el.y,
          w: el.w,
          h: el.h,
          rotation: el.rotation,
          zIndex: el.zIndex,
          locked: el.locked,
          hidden: el.hidden,
          name: el.name && (el.name.includes('占位') || el.name === '图片') ? '图片' : el.name,
          src,
          fit: 'cover',
          isPlaceholder: false,
        };
        return next;
      }),
      selectedIds: [id],
    }));
  },

  bringToFront: (id) => {
    get()._pushHistory();
    set((s) => {
      const maxZ = s.elements.reduce((m, e) => Math.max(m, e.zIndex), 0);
      return {
        elements: s.elements.map((el) => (el.id === id ? { ...el, zIndex: maxZ + 1 } : el)),
      };
    });
  },

  sendToBack: (id) => {
    get()._pushHistory();
    set((s) => {
      const minZ = s.elements.reduce((m, e) => Math.min(m, e.zIndex), Infinity);
      return {
        elements: s.elements.map((el) => (el.id === id ? { ...el, zIndex: minZ - 1 } : el)),
      };
    });
  },

  bringForward: (id) => {
    get()._pushHistory();
    set((s) => {
      const target = s.elements.find((e) => e.id === id);
      if (!target) return s;
      const above = s.elements
        .filter((e) => e.zIndex > target.zIndex)
        .sort((a, b) => a.zIndex - b.zIndex)[0];
      if (!above) return s;
      return {
        elements: s.elements.map((el) => {
          if (el.id === id) return { ...el, zIndex: above.zIndex };
          if (el.id === above.id) return { ...el, zIndex: target.zIndex };
          return el;
        }),
      };
    });
  },

  sendBackward: (id) => {
    get()._pushHistory();
    set((s) => {
      const target = s.elements.find((e) => e.id === id);
      if (!target) return s;
      const below = s.elements
        .filter((e) => e.zIndex < target.zIndex)
        .sort((a, b) => b.zIndex - a.zIndex)[0];
      if (!below) return s;
      return {
        elements: s.elements.map((el) => {
          if (el.id === id) return { ...el, zIndex: below.zIndex };
          if (el.id === below.id) return { ...el, zIndex: target.zIndex };
          return el;
        }),
      };
    });
  },

  undo: () => {
    const { past, elements, meta, future } = get();
    if (past.length === 0) return;
    const prev = past[past.length - 1]!;
    set({
      past: past.slice(0, -1),
      elements: prev.elements,
      meta: prev.meta,
      future: [{ elements, meta }, ...future],
      selectedIds: [],
    });
  },

  redo: () => {
    const { past, elements, meta, future } = get();
    if (future.length === 0) return;
    const next = future[0]!;
    set({
      past: [...past, { elements, meta }],
      elements: next.elements,
      meta: next.meta,
      future: future.slice(1),
      selectedIds: [],
    });
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,

  _pushHistory: () => {
    const { elements, meta, past } = get();
    const next = [...past, { elements, meta }];
    if (next.length > 100) next.shift();
    set({ past: next, future: [] });
  },
}));

export { genId };
