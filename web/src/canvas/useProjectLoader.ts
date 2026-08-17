/**
 * 项目加载 hook
 *
 * 组件挂载时：
 *   1. 从 IndexedDB 拿最近的项目列表
 *   2. 如果有 currentProjectId 对应的项目，加载它到 store
 *   3. 把列表返回，让调用方决定初始 view（dashboard / editor）
 *
 * 返回值：
 *   - ready: 初始化完成（不论有没有项目）
 *   - hasProjects: 库里有没有项目
 *   - refresh: 重新拉一次列表（新建/删除/重命名后用）
 */

import { useCallback, useEffect, useState } from 'react';
import { useCanvasStore } from './store';
import { getCurrentProjectId, listProjects } from './db';
import type { Project } from './project';

export function useProjectLoader() {
  const loadProject = useCanvasStore((s) => s.loadProject);
  const [ready, setReady] = useState(false);
  const [hasProjects, setHasProjects] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);

  const refresh = useCallback(async () => {
    const list = await listProjects();
    setProjects(list);
    setHasProjects(list.length > 0);
    return list;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await refresh();
        if (cancelled) return;

        const id = getCurrentProjectId();
        const match = list.find((p) => p.id === id) ?? list[0];
        if (match) {
          loadProject(match);
        }
      } catch (err) {
        console.error('加载项目失败：', err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProject, refresh]);

  return { ready, hasProjects, projects, refresh };
}
