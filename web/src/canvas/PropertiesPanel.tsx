/**
 * 右侧属性面板
 *
 * 根据选中元素类型显示对应字段：
 *   - 通用：x / y / w / h / rotation / opacity（v2）
 *   - Rect：fill / stroke / strokeWidth / cornerRadius
 *   - Image：fit
 *   - Text：content / fontSize / fontFamily / fontStyle / fill / textAlign
 *
 * 多选时显示通用字段，更改应用到所有选中元素。
 */

import { useRef, useState } from 'react';
import { useCanvasStore } from './store';
import type { CanvasElement, ElementId, ImageElement, RectElement, TextElement } from './types';

export function PropertiesPanel() {
  const elements = useCanvasStore((s) => s.elements);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const updateElement = useCanvasStore((s) => s.updateElement);
  const updateElements = useCanvasStore((s) => s.updateElements);
  const pushHistory = useCanvasStore((s) => s._pushHistory);
  const replaceWithImage = useCanvasStore((s) => s.replaceWithImage);

  // 锁定的宽高比（仅对单选图片有效；null = 自由）
  const [lockedRatio, setLockedRatio] = useState<number | null>(null);

  const selected = elements.filter((el) => selectedIds.includes(el.id));

  if (selected.length === 0) {
    return (
      <aside className="properties-panel">
        <header className="panel-header">
          <h3>属性</h3>
        </header>
        <div className="panel-empty">
          <div className="empty-icon">👈</div>
          <p>选中元素以编辑属性</p>
          <p className="empty-hint">画布上点击 / Shift+点击多选</p>
        </div>
      </aside>
    );
  }

  // 多选：只显示通用字段
  if (selected.length > 1) {
    return (
      <aside className="properties-panel">
        <header className="panel-header">
          <h3>属性</h3>
          <span className="panel-count">{selected.length} 个</span>
        </header>
        <CommonFields elements={selected} updateElement={updateElement} updateElements={updateElements} pushHistory={pushHistory} />
      </aside>
    );
  }

  // 单选
  const el = selected[0]!;
  // 图片等比例缩放用的 w/h 处理器
  const imageWidthChange = el.type === 'image' && lockedRatio
    ? (value: number) => {
        pushHistory();
        updateElement(el.id, { w: value, h: value / lockedRatio });
      }
    : undefined;
  const imageHeightChange = el.type === 'image' && lockedRatio
    ? (value: number) => {
        pushHistory();
        updateElement(el.id, { w: value * lockedRatio, h: value });
      }
    : undefined;

  return (
    <aside className="properties-panel">
      <header className="panel-header">
        <h3>属性</h3>
        <span className="panel-count">{labelOf(el)}</span>
      </header>

      <CommonFields
        elements={[el]}
        updateElement={updateElement}
        updateElements={updateElements}
        pushHistory={pushHistory}
        onWidthChange={imageWidthChange}
        onHeightChange={imageHeightChange}
      />

      {el.type === 'rect' && (
        <RectFields
          el={el}
          update={updateElement}
          pushHistory={pushHistory}
          replaceWithImage={replaceWithImage}
        />
      )}
      {el.type === 'image' && (
        <ImageFields
          el={el}
          update={updateElement}
          pushHistory={pushHistory}
          replaceWithImage={replaceWithImage}
          lockedRatio={lockedRatio}
          setLockedRatio={setLockedRatio}
        />
      )}
      {el.type === 'text' && <TextFields el={el} update={updateElement} pushHistory={pushHistory} />}
    </aside>
  );
}

function labelOf(el: CanvasElement): string {
  if (el.name) return el.name;
  if (el.type === 'text') return '文字';
  if (el.type === 'image') return '图片';
  return '矩形';
}

// ============== 通用字段 ==============
function CommonFields({
  elements,
  updateElement,
  updateElements,
  pushHistory,
  onWidthChange,
  onHeightChange,
}: {
  elements: CanvasElement[];
  updateElement: (id: ElementId, patch: Partial<CanvasElement>) => void;
  updateElements: (patches: Array<{ id: ElementId; patch: Partial<CanvasElement> }>) => void;
  pushHistory: () => void;
  onWidthChange?: (value: number) => void;
  onHeightChange?: (value: number) => void;
}) {
  const isMulti = elements.length > 1;
  const first = elements[0]!;

  const change = (field: 'x' | 'y' | 'w' | 'h' | 'rotation', value: number) => {
    if (Number.isNaN(value)) return;
    // 图片等比例缩放：交给调用方处理
    if (field === 'w' && onWidthChange) { onWidthChange(value); return; }
    if (field === 'h' && onHeightChange) { onHeightChange(value); return; }
    pushHistory();
    if (isMulti) {
      // 多选：只改同字段，其它用各自原值
      updateElements(elements.map((el) => ({ id: el.id, patch: { [field]: value } as Partial<CanvasElement> })));
    } else {
      updateElement(first.id, { [field]: value } as Partial<CanvasElement>);
    }
  };

  return (
    <section className="prop-section">
      <div className="prop-section-title">位置 / 尺寸</div>
      <div className="prop-row">
        <label>X</label>
        <input type="number" value={Math.round(first.x)} onChange={(e) => change('x', Number(e.target.value))} />
        <label>Y</label>
        <input type="number" value={Math.round(first.y)} onChange={(e) => change('y', Number(e.target.value))} />
      </div>
      <div className="prop-row">
        <label>宽</label>
        <input
          type="number"
          min={1}
          value={Math.round(first.w)}
          onChange={(e) => change('w', Number(e.target.value))}
        />
        <span className="prop-unit">pt</span>
        <label>高</label>
        <input
          type="number"
          min={1}
          value={Math.round(first.h)}
          onChange={(e) => change('h', Number(e.target.value))}
        />
        <span className="prop-unit">pt</span>
      </div>
      <div className="prop-row">
        <label>旋转</label>
        <input
          type="number"
          value={Math.round(first.rotation)}
          step={1}
          onChange={(e) => change('rotation', Number(e.target.value))}
        />
        <span className="prop-unit">°</span>
      </div>
    </section>
  );
}

// ============== Rect 专属 ==============
function RectFields({
  el,
  update,
  pushHistory,
  replaceWithImage,
}: {
  el: RectElement;
  update: (id: ElementId, patch: Partial<RectElement>) => void;
  pushHistory: () => void;
  replaceWithImage: (id: ElementId, src: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPlaceholder = (el.name ?? '').includes('占位');

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      replaceWithImage(el.id, src);
    };
    reader.readAsDataURL(file);
  };

  const change = <K extends keyof RectElement>(key: K, value: RectElement[K]) => {
    pushHistory();
    update(el.id, { [key]: value } as Partial<RectElement>);
  };

  return (
    <>
      {isPlaceholder && (
        <section className="prop-section">
          <div className="prop-section-title">📷 上传图片</div>
          <div className="prop-row">
            <button
              type="button"
              className="prop-action-btn prop-action-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              选择图片替换
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onFileChange}
            />
          </div>
          <p className="prop-hint">💡 也可以在画布上双击此矩形直接上传</p>
        </section>
      )}
      <section className="prop-section">
        <div className="prop-section-title">填充</div>
        <div className="prop-row">
          <label>颜色</label>
          <input type="color" value={el.fill} onChange={(e) => change('fill', e.target.value)} />
          <input type="text" value={el.fill} onChange={(e) => change('fill', e.target.value)} />
        </div>
      </section>
      <section className="prop-section">
        <div className="prop-section-title">描边</div>
        <div className="prop-row">
          <label>颜色</label>
          <input type="color" value={el.stroke || '#000000'} onChange={(e) => change('stroke', e.target.value)} />
        </div>
        <div className="prop-row">
          <label>宽度</label>
          <input
            type="number"
            min={0}
            value={el.strokeWidth}
            onChange={(e) => change('strokeWidth', Number(e.target.value))}
          />
          <span className="prop-unit">pt</span>
        </div>
        <div className="prop-row">
          <label>圆角</label>
          <input
            type="number"
            min={0}
            value={el.cornerRadius}
            onChange={(e) => change('cornerRadius', Number(e.target.value))}
          />
          <span className="prop-unit">pt</span>
        </div>
      </section>
    </>
  );
}

// 常用宽高比预设
const ASPECT_RATIOS: Array<{ value: number; label: string }> = [
  { value: 1, label: '1:1' },
  { value: 3 / 4, label: '3:4' },
  { value: 2 / 3, label: '2:3' },
  { value: 5 / 7, label: '5:7' },
  { value: 9 / 16, label: '9:16' },
  { value: 4 / 3, label: '4:3' },
  { value: 3 / 2, label: '3:2' },
  { value: 16 / 9, label: '16:9' },
];

// ============== Image 专属 ==============
function ImageFields({
  el,
  update,
  pushHistory,
  replaceWithImage,
  lockedRatio,
  setLockedRatio,
}: {
  el: ImageElement;
  update: (id: ElementId, patch: Partial<ImageElement>) => void;
  pushHistory: () => void;
  replaceWithImage: (id: ElementId, src: string) => void;
  lockedRatio: number | null;
  setLockedRatio: (r: number | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      replaceWithImage(el.id, src);
    };
    reader.readAsDataURL(file);
  };

  // 切换到指定比例：把当前高度按比例调整
  const applyRatio = (ratio: number) => {
    pushHistory();
    const newH = el.w / ratio;
    update(el.id, { w: el.w, h: newH });
    setLockedRatio(ratio);
  };

  // 解除锁定
  const unlockRatio = () => {
    setLockedRatio(null);
  };

  const currentRatio = el.w / el.h;
  const activeRatio = ASPECT_RATIOS.find((r) => r.value === lockedRatio);

  return (
    <>
      {el.isPlaceholder && (
        <section className="prop-section">
          <div className="prop-section-title">📷 上传图片</div>
          <div className="prop-row">
            <button
              type="button"
              className="prop-action-btn prop-action-primary"
              onClick={() => fileInputRef.current?.click()}
            >
              选择图片替换
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onFileChange}
            />
          </div>
          <p className="prop-hint">💡 也可以在画布上双击占位图直接上传</p>
        </section>
      )}
      <section className="prop-section">
        <div className="prop-section-title">图片</div>
        {!el.isPlaceholder && (
          <div className="prop-row">
            <button
              type="button"
              className="prop-action-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              🖼 替换图片
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={onFileChange}
            />
          </div>
        )}
        <div className="prop-row">
          <label>适配</label>
          <select
            value={el.fit}
            onChange={(e) => {
              pushHistory();
              update(el.id, { fit: e.target.value as 'cover' | 'contain' });
            }}
          >
            <option value="cover">cover（填满裁剪）</option>
            <option value="contain">contain（完整显示）</option>
          </select>
        </div>
      </section>
      <section className="prop-section">
        <div className="prop-section-title">宽高比</div>
        <div className="aspect-grid">
          {ASPECT_RATIOS.map((r) => (
            <button
              key={r.value}
              type="button"
              className={`aspect-btn ${lockedRatio === r.value ? 'active' : ''}`}
              onClick={() => applyRatio(r.value)}
              title={`锁定为 ${r.label}（改宽自动算高）`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="prop-row" style={{ marginTop: 8 }}>
          <label>当前</label>
          <span className="aspect-info">{currentRatio.toFixed(3)} : 1</span>
          {lockedRatio !== null && (
            <button
              type="button"
              className="aspect-unlock"
              onClick={unlockRatio}
              title="解除锁定（自由缩放）"
            >
              🔓 解锁
            </button>
          )}
        </div>
        {activeRatio && (
          <p className="prop-hint">🔒 已锁定 {activeRatio.label}，改宽/高会自动联动</p>
        )}
      </section>
    </>
  );
}

// ============== Text 专属 ==============
function TextFields({
  el,
  update,
  pushHistory,
}: {
  el: TextElement;
  update: (id: ElementId, patch: Partial<TextElement>) => void;
  pushHistory: () => void;
}) {
  const change = <K extends keyof TextElement>(key: K, value: TextElement[K]) => {
    pushHistory();
    update(el.id, { [key]: value } as Partial<TextElement>);
  };

  return (
    <>
      <section className="prop-section">
        <div className="prop-section-title">文字内容</div>
        <textarea
          className="prop-textarea"
          value={el.content}
          rows={3}
          onChange={(e) => change('content', e.target.value)}
        />
      </section>
      <section className="prop-section">
        <div className="prop-section-title">字体</div>
        <div className="prop-row">
          <label>字体</label>
          <select value={el.fontFamily} onChange={(e) => change('fontFamily', e.target.value)}>
            <option value='"Inter", "Source Han Sans SC", sans-serif'>Inter / 思源黑体（推荐）</option>
            <option value='"Source Han Sans SC", "Inter", sans-serif'>思源黑体（中文为主）</option>
            <option value='"Inter", sans-serif'>Inter（纯英文）</option>
            <option value='"Georgia", serif'>Georgia</option>
            <option value='"Courier New", monospace'>Courier New</option>
          </select>
        </div>
        <div className="prop-row">
          <label>字号</label>
          <input
            type="number"
            min={6}
            max={200}
            value={el.fontSize}
            onChange={(e) => change('fontSize', Number(e.target.value))}
          />
          <span className="prop-unit">pt</span>
        </div>
        <div className="prop-row">
          <label>字重</label>
          <select value={el.fontStyle} onChange={(e) => change('fontStyle', e.target.value as TextElement['fontStyle'])}>
            <option value="normal">常规</option>
            <option value="bold">粗体</option>
            <option value="italic">斜体</option>
            <option value="bold italic">粗斜体</option>
          </select>
        </div>
        <div className="prop-row">
          <label>对齐</label>
          <select value={el.textAlign} onChange={(e) => change('textAlign', e.target.value as TextElement['textAlign'])}>
            <option value="left">左对齐</option>
            <option value="center">居中</option>
            <option value="right">右对齐</option>
          </select>
        </div>
        <div className="prop-row">
          <label>颜色</label>
          <input type="color" value={el.fill} onChange={(e) => change('fill', e.target.value)} />
        </div>
      </section>
    </>
  );
}
