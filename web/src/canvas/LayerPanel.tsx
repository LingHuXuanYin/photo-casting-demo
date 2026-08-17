/**
 * 左侧图层面板
 *
 * 列出所有元素（按 zIndex 倒序，顶部 = 最上层）
 * 支持：选中 / 显隐 / 锁定 / 重排 / 删除
 */

import { useCanvasStore } from './store';
import type { CanvasElement, ElementId } from './types';

const ICONS = {
  rect: '▭',
  image: '🖼',
  text: 'T',
};

function elementLabel(el: CanvasElement): string {
  if (el.name) return el.name;
  if (el.type === 'text') return `"${el.content.slice(0, 12)}${el.content.length > 12 ? '…' : ''}"`;
  if (el.type === 'image') return '图片';
  return '矩形';
}

export function LayerPanel() {
  const elements = useCanvasStore((s) => s.elements);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const setSelected = useCanvasStore((s) => s.setSelected);
  const updateElement = useCanvasStore((s) => s.updateElement);
  const removeElements = useCanvasStore((s) => s.removeElements);
  const bringToFront = useCanvasStore((s) => s.bringToFront);
  const sendToBack = useCanvasStore((s) => s.sendToBack);
  const bringForward = useCanvasStore((s) => s.bringForward);
  const sendBackward = useCanvasStore((s) => s.sendBackward);

  // 倒序：zIndex 大的在顶
  const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex);

  const handleClick = (id: ElementId, e: React.MouseEvent) => {
    if (e.shiftKey) {
      setSelected(
        selectedIds.includes(id)
          ? selectedIds.filter((x) => x !== id)
          : [...selectedIds, id],
      );
    } else {
      setSelected([id]);
    }
  };

  const toggleHidden = (el: CanvasElement) => {
    updateElement(el.id, { hidden: !el.hidden });
  };

  const toggleLock = (el: CanvasElement) => {
    updateElement(el.id, { locked: !el.locked });
  };

  const rename = (el: CanvasElement) => {
    const name = window.prompt('重命名图层：', el.name ?? '');
    if (name !== null) {
      updateElement(el.id, { name: name.trim() || undefined });
    }
  };

  return (
    <aside className="layer-panel">
      <header className="panel-header">
        <h3>图层</h3>
        <span className="panel-count">{elements.length}</span>
      </header>

      {sorted.length === 0 && (
        <div className="panel-empty">
          <div className="empty-icon">📭</div>
          <p>还没有元素</p>
          <p className="empty-hint">用工具栏添加矩形 / 文字 / 图片</p>
        </div>
      )}

      <ul className="layer-list">
        {sorted.map((el) => {
          const isSelected = selectedIds.includes(el.id);
          return (
            <li
              key={el.id}
              className={`layer-item ${isSelected ? 'selected' : ''} ${el.hidden ? 'hidden' : ''} ${el.locked ? 'locked' : ''}`}
              onClick={(e) => handleClick(el.id, e)}
            >
              <span className="layer-icon">{ICONS[el.type]}</span>
              <span className="layer-name" onDoubleClick={() => rename(el)} title="双击重命名">
                {elementLabel(el)}
              </span>
              <div className="layer-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="icon-btn"
                  title={el.hidden ? '显示' : '隐藏'}
                  onClick={() => toggleHidden(el)}
                >
                  {el.hidden ? '🙈' : '👁'}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title={el.locked ? '解锁' : '锁定'}
                  onClick={() => toggleLock(el)}
                >
                  {el.locked ? '🔒' : '🔓'}
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="删除"
                  onClick={() => removeElements([el.id])}
                >
                  🗑
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {selectedIds.length > 0 && (
        <div className="layer-order">
          <div className="panel-subheader">调整层级</div>
          <div className="order-buttons">
            <button type="button" onClick={() => selectedIds.forEach((id) => sendToBack(id))} title="置底">
              ⤓
            </button>
            <button type="button" onClick={() => selectedIds.forEach((id) => sendBackward(id))} title="下移">
              ↓
            </button>
            <button type="button" onClick={() => selectedIds.forEach((id) => bringForward(id))} title="上移">
              ↑
            </button>
            <button type="button" onClick={() => selectedIds.forEach((id) => bringToFront(id))} title="置顶">
              ⤒
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
