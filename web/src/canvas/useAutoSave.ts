/**
 * 自动保存 hook
 *
 * 监听 store 中 elements / meta / model 的变化，
 * 防抖 2s 后写入 IndexedDB。
 *
 * 同时暴露手动保存函数 saveNow（Ctrl+S / 保存按钮调用）。
 */

import { useEffect, useRef } from 'react';
import { useCanvasStore } from './store';
import { saveProject } from './db';
import type { Project } from './project';

const DEBOUNCE_MS = 2000;

// 模块级 timer 句柄（手动保存时清掉防抖计时器）
let debounceTimer: number | null = null;

export function useAutoSave() {
  const lastSerialized = useRef<string>('');
  const initialized = useRef(false);

  useEffect(() => {
    // 等一帧再开始监听，避免初始状态被当作"修改"保存
    requestAnimationFrame(() => {
      initialized.current = true;
    });

    const unsubscribe = useCanvasStore.subscribe((state, prev) => {
      if (!initialized.current) return;

      // 只关心数据字段变化
      if (
        state.elements === prev.elements &&
        state.meta === prev.meta &&
        state.model === prev.model &&
        state.projectName === prev.projectName &&
        state.projectId === prev.projectId
      ) {
        return;
      }

      // 序列化对比，避免无意义的"空操作"（如 pushHistory）触发保存
      const snapshot = JSON.stringify({
        elements: state.elements,
        meta: state.meta,
        model: state.model,
        name: state.projectName,
        id: state.projectId,
      });
      if (snapshot === lastSerialized.current) return;
      lastSerialized.current = snapshot;

      // 防抖
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
      }
      useCanvasStore.getState().setSaveStatus('saving');
      debounceTimer = window.setTimeout(() => {
        void doSave();
      }, DEBOUNCE_MS);
    });

    return () => {
      unsubscribe();
      if (debounceTimer !== null) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    };
  }, []);
}

async function doSave() {
  const s = useCanvasStore.getState();
  const project: Project = {
    id: s.projectId,
    name: s.projectName,
    createdAt: 0, // 第一次创建时是 0，下次 save 会更新
    updatedAt: Date.now(),
    canvas: s.meta,
    elements: s.elements,
    model: s.model,
  };
  try {
    await saveProject(project);
    localStorage.setItem('model-card:currentProjectId', s.projectId);
    s.setSaveStatus('saved', Date.now());
  } catch (err) {
    console.error('保存失败：', err);
    s.setSaveStatus('error');
  }
}

/** 手动保存（Ctrl+S / 保存按钮） */
export async function saveNow() {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  await doSave();
}
