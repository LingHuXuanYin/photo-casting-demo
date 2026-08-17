/**
 * Dashboard（项目列表）组件
 *
 * v1 极简：网格卡片 + 搜索 + 新建/打开/删除
 * 缩略图 = project.thumbnail（导出时存），没有时显示占位
 *
 * 交互：
 *   - 顶部：标题 + 搜索框 + [+ 新建项目] 按钮
 *   - 网格：项目卡片（缩略图 + 名字 + 模特名 + 更新时间）
 *   - 卡片右上角悬停：显示 [编辑] [删除] 按钮
 *   - 卡片点击：进入 editor
 *   - 空状态：欢迎 + 大号新建按钮
 */

import { useMemo, useState } from 'react';
import { deleteProject } from './db';
import { genProjectId } from './project';
import type { Project } from './project';

interface DashboardProps {
  projects: Project[];
  onRefresh: () => Promise<Project[]>;
  onOpenProject: (project: Project) => void;
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  if (diff < min) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / min)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function Dashboard({ projects, onRefresh, onOpenProject }: DashboardProps) {
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => {
      if (p.name.toLowerCase().includes(q)) return true;
      if (p.model.name?.toLowerCase().includes(q)) return true;
      if (p.model.englishName?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [projects, query]);

  const handleNew = () => {
    const fresh = {
      id: genProjectId(),
      name: `未命名项目 ${projects.length + 1}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      canvas: { width: 595, height: 842, background: '#FFFFFF', unit: 'pt' as const, name: 'A4 竖版' },
      elements: [],
      model: {},
    };
    onOpenProject(fresh);
  };

  const handleDelete = async (project: Project) => {
    await deleteProject(project.id);
    await onRefresh();
    setConfirmDelete(null);
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="dashboard-title">
          <span className="dashboard-logo">📇</span>
          <h1>模特卡片生成器</h1>
          <span className="dashboard-tagline">为模特群体打造的极简模卡工具</span>
        </div>
        <div className="dashboard-actions">
          <input
            type="search"
            className="dashboard-search"
            placeholder="🔍 搜索项目名 / 模特名"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="primary-btn dashboard-new-btn" onClick={handleNew}>
            + 新建项目
          </button>
        </div>
      </header>

      <main className="dashboard-body">
        {projects.length === 0 ? (
          <div className="dashboard-empty">
            <div className="empty-icon">📸</div>
            <h2>还没有任何项目</h2>
            <p>点击下面的按钮，从空白画布开始</p>
            <button type="button" className="primary-btn dashboard-empty-btn" onClick={handleNew}>
              + 新建第一个项目
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="dashboard-empty">
            <div className="empty-icon">🔍</div>
            <h2>没找到匹配 "{query}" 的项目</h2>
            <p>试试别的关键词</p>
          </div>
        ) : (
          <div className="dashboard-grid">
            {/* 第一张是新建项目卡 */}
            <button type="button" className="project-card project-card-new" onClick={handleNew}>
              <div className="project-card-new-inner">
                <div className="project-card-new-icon">+</div>
                <div className="project-card-new-text">新建项目</div>
              </div>
            </button>
            {filtered.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={() => onOpenProject(p)}
                onDelete={() => setConfirmDelete(p)}
              />
            ))}
          </div>
        )}
      </main>

      {confirmDelete && (
        <div className="modal-backdrop" onClick={() => setConfirmDelete(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>删除项目？</h3>
            <p>
              确定删除 <strong>{confirmDelete.name}</strong> 吗？此操作不可恢复。
            </p>
            <div className="modal-actions">
              <button type="button" onClick={() => setConfirmDelete(null)}>
                取消
              </button>
              <button
                type="button"
                className="danger-btn"
                onClick={() => handleDelete(confirmDelete)}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const modelName = project.model.name?.trim() || '';
  return (
    <div className="project-card" onClick={onOpen}>
      <div className="project-card-thumb">
        {project.thumbnail ? (
          <img src={project.thumbnail} alt={project.name} />
        ) : (
          <div className="project-card-thumb-placeholder">
            <span>📷</span>
            <span className="thumb-hint">尚未导出</span>
          </div>
        )}
        <div className="project-card-actions">
          <button
            type="button"
            className="icon-btn"
            title="删除"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            🗑
          </button>
        </div>
      </div>
      <div className="project-card-info">
        <div className="project-card-name">{project.name}</div>
        <div className="project-card-meta">
          {modelName ? <span className="project-card-model">{modelName}</span> : null}
          <span className="project-card-time">{formatRelative(project.updatedAt)}</span>
        </div>
        <div className="project-card-stats">
          {project.elements.length} 个元素 · {project.canvas.width}×{project.canvas.height}
        </div>
      </div>
    </div>
  );
}
