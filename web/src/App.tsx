import { useEffect, useState } from 'react';
import { CanvasStage } from './canvas/CanvasStage';
import { Toolbar } from './canvas/Toolbar';
import { LayerPanel } from './canvas/LayerPanel';
import { PropertiesPanel } from './canvas/PropertiesPanel';
import { ModelInfoModal } from './canvas/ModelInfoModal';
import { ExportModal } from './canvas/ExportModal';
import { Dashboard } from './canvas/Dashboard';
import { useCanvasStore } from './canvas/store';
import { useProjectLoader } from './canvas/useProjectLoader';
import { useAutoSave, saveNow } from './canvas/useAutoSave';
import { saveCurrentProjectId } from './canvas/db';
import type { Project } from './canvas/project';
import './App.css';

type View = 'dashboard' | 'editor';

interface PingResponse {
  status: string;
  message: string;
  timestamp: string;
  version: string;
}

const API_BASE = '/api';

async function callPing(): Promise<PingResponse> {
  const res = await fetch(`${API_BASE}/ping`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export default function App() {
  // 加载最近的项目 + 启动自动保存
  const { ready, projects, refresh } = useProjectLoader();
  useAutoSave();

  const [view, setView] = useState<View>('dashboard');
  const [pingResult, setPingResult] = useState<PingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showApiPanel, setShowApiPanel] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const selectedCount = useCanvasStore((s) => s.selectedIds.length);
  const projectName = useCanvasStore((s) => s.projectName);
  const model = useCanvasStore((s) => s.model);
  const saveStatus = useCanvasStore((s) => s.saveStatus);
  const lastSavedAt = useCanvasStore((s) => s.lastSavedAt);

  // 默认始终显示 dashboard，让用户每次打开都看到项目列表
  // （点项目卡片 / 新建项目 才切到 editor）
  useEffect(() => {
    if (!ready) return;
    setView('dashboard');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const handlePing = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await callPing();
      setPingResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // 全局快捷键：Ctrl+S 保存（在 App 层，不依赖画布焦点）
  if (typeof window !== 'undefined') {
    window.onkeydown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveNow();
      }
    };
  }

  const handleOpenProject = async (project: Project) => {
    // 先存当前（如果 dirty）—— 这里简化为直接覆盖，反正有自动保存
    await saveNow();
    useCanvasStore.getState().loadProject(project);
    saveCurrentProjectId(project.id);
    setView('editor');
  };

  const handleBackToDashboard = async () => {
    await saveNow();
    setView('dashboard');
    await refresh();
  };

  const lastSavedText = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '尚未保存';

  // 没初始化好之前显示加载占位
  if (!ready) {
    return (
      <div className="app-loading">
        <div className="app-loading-icon">📇</div>
        <div>正在加载项目…</div>
      </div>
    );
  }

  // Dashboard 视图
  if (view === 'dashboard') {
    return (
      <div className="app">
        <Dashboard
          projects={projects}
          onRefresh={refresh}
          onOpenProject={handleOpenProject}
        />
        {showApiPanel && (
          <div className="api-panel">
            <div className="api-card">
              <h3>前后端联通测试</h3>
              <button type="button" onClick={handlePing} disabled={loading} className="primary-btn">
                {loading ? '连接中…' : '🚀 测试连接'}
              </button>
              {error && <div className="result error">❌ {error}</div>}
              {pingResult && (
                <div className="result success">
                  ✅ 联通正常
                  <pre>{JSON.stringify(pingResult, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>
        )}
        <footer className="status-bar">
          <div className="status-left">
            <span className="status-pill">P0-7</span>
            <span className="status-hint">{projects.length} 个项目</span>
          </div>
          <div className="status-right">
            <button type="button" className="link-btn" onClick={() => setShowApiPanel((v) => !v)}>
              {showApiPanel ? '关闭' : '查看'}联通测试
            </button>
          </div>
        </footer>
      </div>
    );
  }

  // Editor 视图
  return (
    <div className="app">
      <Toolbar
        onOpenModelInfo={() => setShowModelModal(true)}
        onOpenExport={() => setShowExportModal(true)}
        onBackToDashboard={handleBackToDashboard}
      />
      <div className="workspace">
        <LayerPanel />
        <div className="canvas-area">
          <CanvasStage />
          {selectedCount > 0 && (
            <div className="selection-badge">
              已选中 {selectedCount} 个元素 · Delete 删除 · Ctrl+D 复制
            </div>
          )}
        </div>
        <PropertiesPanel />
      </div>
      <footer className="status-bar">
        <div className="status-left">
          <span className="status-pill">P0-7</span>
          <span className="status-hint">
            {projectName} · {model.name ? `${model.name} · ` : ''}元素 {useCanvasStore.getState().elements.length}
          </span>
        </div>
        <div className="status-right">
          <SaveStatusIndicator status={saveStatus} text={lastSavedText} />
          <button type="button" className="link-btn" onClick={() => setShowApiPanel((v) => !v)}>
            {showApiPanel ? '关闭' : '查看'}联通测试
          </button>
        </div>
      </footer>

      {showApiPanel && (
        <div className="api-panel">
          <div className="api-card">
            <h3>前后端联通测试</h3>
            <button type="button" onClick={handlePing} disabled={loading} className="primary-btn">
              {loading ? '连接中…' : '🚀 测试连接'}
            </button>
            {error && <div className="result error">❌ {error}</div>}
            {pingResult && (
              <div className="result success">
                ✅ 联通正常
                <pre>{JSON.stringify(pingResult, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {showModelModal && <ModelInfoModal onClose={() => setShowModelModal(false)} />}
      {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} />}
    </div>
  );
}

function SaveStatusIndicator({ status, text }: { status: string; text: string }) {
  const map: Record<string, { icon: string; color: string; label: string }> = {
    idle:    { icon: '⚪', color: '#6b7488', label: text },
    saving:  { icon: '🔄', color: '#667eea', label: '保存中…' },
    saved:   { icon: '✅', color: '#5eeaa3', label: `已保存 · ${text}` },
    error:   { icon: '❌', color: '#ff8a80', label: '保存失败' },
  };
  const item = map[status] ?? map.idle!;
  return (
    <span className="save-status" style={{ color: item.color }}>
      <span className="save-icon">{item.icon}</span> {item.label}
    </span>
  );
}
