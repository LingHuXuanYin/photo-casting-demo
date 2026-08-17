/**
 * 工具栏 - 顶部
 *
 * 提供：项目操作（新建/重命名/模特信息/模板）、
 *       添加元素、画布尺寸切换、撤销/重做、
 *       编辑器设置（栅格/吸附/辅助线）
 */

import { useRef, useState } from 'react';
import { useCanvasStore, genId } from './store';
import {
  CANVAS_PRESETS,
  type CanvasMeta,
  type ImageElement,
  type RectElement,
  type TextElement,
} from './types';
import { saveNow } from './useAutoSave';
import { TemplateGallery } from './TemplateGallery';

interface ToolbarProps {
  onOpenModelInfo: () => void;
  onOpenExport: () => void;
  onBackToDashboard?: () => void;
}

export function Toolbar({ onOpenModelInfo, onOpenExport, onBackToDashboard }: ToolbarProps) {
  const meta = useCanvasStore((s) => s.meta);
  const setMeta = useCanvasStore((s) => s.setMeta);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s.canUndo());
  const canRedo = useCanvasStore((s) => s.canRedo());
  const elementsCount = useCanvasStore((s) => s.elements.length);
  const addElement = useCanvasStore((s) => s.addElement);
  const setSelected = useCanvasStore((s) => s.setSelected);
  const projectName = useCanvasStore((s) => s.projectName);
  const setProjectName = useCanvasStore((s) => s.setProjectName);
  const newProject = useCanvasStore((s) => s.newProject);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customSizeOpen, setCustomSizeOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [customW, setCustomW] = useState(800);
  const [customH, setCustomH] = useState(600);

  const addRect = () => {
    const el: RectElement = {
      id: genId(),
      type: 'rect',
      x: meta.width / 2 - 100,
      y: meta.height / 2 - 75,
      w: 200,
      h: 150,
      rotation: 0,
      zIndex: elementsCount + 1,
      fill: '#667eea',
      stroke: '#4c5fb8',
      strokeWidth: 0,
      cornerRadius: 4,
    };
    addElement(el);
  };

  const addText = () => {
    const el: TextElement = {
      id: genId(),
      type: 'text',
      x: meta.width / 2 - 100,
      y: meta.height / 2 - 20,
      w: 200,
      h: 40,
      rotation: 0,
      zIndex: elementsCount + 1,
      content: '双击编辑文字',
      fontSize: 24,
      fontFamily: '"Inter", "Source Han Sans SC", sans-serif',
      fontStyle: 'normal',
      fill: '#1a1d24',
      textAlign: 'center',
      lineHeight: 1.2,
    };
    addElement(el);
  };

  const addImage = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        const maxW = meta.width * 0.6;
        const w = Math.min(maxW, img.width);
        const h = (img.height * w) / img.width;
        const el: ImageElement = {
          id: genId(),
          type: 'image',
          x: (meta.width - w) / 2,
          y: (meta.height - h) / 2,
          w,
          h,
          rotation: 0,
          zIndex: elementsCount + 1,
          src,
          fit: 'cover',
        };
        addElement(el);
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const onPresetChange = (id: string) => {
    if (id === '__custom__') {
      setCustomSizeOpen(true);
      return;
    }
    const preset = CANVAS_PRESETS.find((p) => p.id === id);
    if (preset) {
      setMeta({
        width: preset.width,
        height: preset.height,
        name: preset.name,
      } as Partial<CanvasMeta>);
      setSelected([]);
    }
  };

  const applyCustomSize = () => {
    if (customW < 50 || customH < 50 || customW > 4000 || customH > 4000) {
      alert('画布尺寸需在 50-4000pt 之间');
      return;
    }
    setMeta({
      width: customW,
      height: customH,
      name: `自定义 ${customW}×${customH}`,
    } as Partial<CanvasMeta>);
    setSelected([]);
    setCustomSizeOpen(false);
  };

  const handleNewProject = () => {
    if (
      elementsCount > 0 &&
      !window.confirm('当前项目有内容，新建会清空画布（已自动保存）。继续吗？')
    ) {
      return;
    }
    newProject();
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            title="返回项目列表"
            className="toolbar-back-btn"
          >
            ← 我的项目
          </button>
        )}
        <button type="button" onClick={handleNewProject} title="新建项目 (Ctrl+N)">
          📄 新建
        </button>
        <input
          type="text"
          className="project-name-input"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="未命名项目"
          title="项目名（自动保存）"
        />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button type="button" onClick={addRect} title="添加矩形">
          ▭ 矩形
        </button>
        <button type="button" onClick={addText} title="添加文字">
          T 文字
        </button>
        <button type="button" onClick={addImage} title="添加图片">
          🖼 图片
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <button type="button" onClick={undo} disabled={!canUndo} title="撤销 (Ctrl+Z)">
          ↶ 撤销
        </button>
        <button type="button" onClick={redo} disabled={!canRedo} title="重做 (Ctrl+Shift+Z)">
          ↷ 重做
        </button>
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group">
        <SettingsToggles />
      </div>

      <div className="toolbar-divider" />

      <div className="toolbar-group toolbar-size">
        <span className="toolbar-label">画布:</span>
        <select
          value={
            CANVAS_PRESETS.find((p) => p.width === meta.width && p.height === meta.height)?.id ??
            '__custom__'
          }
          onChange={(e) => onPresetChange(e.target.value)}
        >
          {CANVAS_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.width}×{p.height})
            </option>
          ))}
          <option value="__custom__">自定义…</option>
        </select>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group">
        <button type="button" onClick={() => setTemplateOpen(true)} title="应用模板">
          📐 模板
        </button>
        <button type="button" onClick={onOpenModelInfo} title="编辑模特信息">
          👤 模特信息
        </button>
        <button type="button" onClick={() => void saveNow()} title="立即保存 (Ctrl+S)">
          💾 保存
        </button>
        <button
          type="button"
          className="export-btn"
          onClick={onOpenExport}
          title="导出 JPG / PDF"
        >
          🚀 导出
        </button>
      </div>

      {customSizeOpen && (
        <div className="custom-size-modal" onClick={() => setCustomSizeOpen(false)}>
          <div className="custom-size-box" onClick={(e) => e.stopPropagation()}>
            <h3>自定义画布尺寸</h3>
            <p className="hint">单位：pt (1pt = 1/72 inch ≈ 0.353mm)</p>
            <div className="size-inputs">
              <label>
                宽度
                <input
                  type="number"
                  value={customW}
                  min={50}
                  max={4000}
                  onChange={(e) => setCustomW(Number(e.target.value))}
                />
              </label>
              <span className="size-x">×</span>
              <label>
                高度
                <input
                  type="number"
                  value={customH}
                  min={50}
                  max={4000}
                  onChange={(e) => setCustomH(Number(e.target.value))}
                />
              </label>
            </div>
            <p className="hint">
              📐 当前比例:{' '}
              {customW / customH < 1
                ? `${(customH / customW).toFixed(2)}:1 (竖版)`
                : `${(customW / customH).toFixed(2)}:1 (横版)`}
            </p>
            <div className="modal-actions">
              <button type="button" onClick={() => setCustomSizeOpen(false)}>
                取消
              </button>
              <button type="button" className="primary-btn" onClick={applyCustomSize}>
                确定
              </button>
            </div>
          </div>
        </div>
      )}

      {templateOpen && <TemplateGallery onClose={() => setTemplateOpen(false)} />}
    </div>
  );
}

function SettingsToggles() {
  const settings = useCanvasStore((s) => s.settings);
  const updateSettings = useCanvasStore((s) => s.updateSettings);

  return (
    <>
      <button
        type="button"
        className={settings.showGrid ? 'active' : ''}
        onClick={() => updateSettings({ showGrid: !settings.showGrid })}
        title="显示栅格"
      >
        ⊞
      </button>
      <button
        type="button"
        className={settings.snapToGrid ? 'active' : ''}
        onClick={() => updateSettings({ snapToGrid: !settings.snapToGrid })}
        title="拖拽时吸附到栅格"
      >
        🧲
      </button>
      <button
        type="button"
        className={settings.showGuides ? 'active' : ''}
        onClick={() => updateSettings({ showGuides: !settings.showGuides })}
        title="元素间对齐辅助线"
      >
        ⫶
      </button>
    </>
  );
}
