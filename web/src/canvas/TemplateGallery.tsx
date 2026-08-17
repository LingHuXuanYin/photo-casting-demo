/**
 * 模板选择弹层
 *
 * 显示所有内置模板，点击"应用"后替换当前画布内容。
 * 应用时会记录一次历史，用户可以撤销回原状态。
 */

import { useState } from 'react';
import { useCanvasStore, genId } from './store';
import { TEMPLATES, fillPlaceholders, type Template } from './templates';
import type { CanvasElement } from './types';

interface TemplateGalleryProps {
  onClose: () => void;
}

export function TemplateGallery({ onClose }: TemplateGalleryProps) {
  const [selected, setSelected] = useState<Template | null>(null);
  const setMeta = useCanvasStore((s) => s.setMeta);
  const _pushHistory = useCanvasStore((s) => s._pushHistory);

  const applyTemplate = (tpl: Template) => {
    if (
      useCanvasStore.getState().elements.length > 0 &&
      !window.confirm('应用模板会替换当前画布内容（可在历史中撤销），继续？')
    ) {
      return;
    }
    // 直接走 loadProject 会重置历史，更安全的方式是：
    // 1) push history (保留旧状态)
    // 2) setMeta + 用 addElement 风格的方式替换 elements
    // 但 store 没有 "replaceAll elements" 的接口。
    // 这里简化：直接 setMeta + 通过 _pushHistory 后整体覆盖。

    _pushHistory();
    setMeta({
      width: tpl.canvas.width,
      height: tpl.canvas.height,
      background: tpl.canvas.background,
      unit: tpl.canvas.unit,
      name: tpl.canvas.name,
    });
    // 应用模板：生成新 id + 为占位图填充 dataURL
    const elements = fillPlaceholders(
      tpl.elements.map((el) => ({
        ...el,
        id: genId(), // 应用模板时重新生成 id，避免 id 冲突
      })) as CanvasElement[],
    );
    useCanvasStore.setState((s) => ({
      elements,
      past: [...s.past, { elements: s.elements, meta: s.meta }],
      future: [],
      selectedIds: [],
    }));

    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box template-gallery" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>📐 选择模板</h2>
          <button type="button" className="close-btn" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="template-grid">
          {TEMPLATES.map((tpl) => (
            <div
              key={tpl.id}
              className={`template-card ${selected?.id === tpl.id ? 'selected' : ''}`}
              onClick={() => setSelected(tpl)}
            >
              <div className="template-thumb">
                <span className="template-icon">{tpl.thumbnail}</span>
              </div>
              <div className="template-info">
                <div className="template-name">{tpl.name}</div>
                <div className="template-desc">{tpl.description}</div>
                <div className="template-meta">
                  {tpl.canvas.name} · {tpl.elements.length} 个元素
                </div>
              </div>
            </div>
          ))}
        </div>

        <footer className="modal-footer">
          <span className="modal-hint">
            {selected ? `已选中：${selected.name}` : '点击上方卡片选择模板'}
          </span>
          <div className="modal-actions-row">
            <button type="button" onClick={onClose}>
              取消
            </button>
            <button
              type="button"
              className="primary-btn"
              disabled={!selected}
              onClick={() => selected && applyTemplate(selected)}
            >
              应用模板
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
