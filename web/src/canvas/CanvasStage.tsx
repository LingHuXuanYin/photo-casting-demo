/**
 * 画布主组件 - Konva Stage
 *
 * P0-2a+b+c 实现：
 *   ✅ Stage / Layer 渲染
 *   ✅ 元素渲染（Rect / Image / Text）
 *   ✅ 拖拽
 *   ✅ 单击选中 / 背景点击取消选中
 *   ✅ 多选（Shift+点击）
 *   ✅ 缩放 + 旋转（Konva Transformer）
 *   ✅ Delete 键删除
 *   ✅ 撤销/重做（键盘 + 工具栏）
 *   ✅ 复制（Ctrl+D）
 *   ✅ 全选（Ctrl+A）/ 取消选中（Esc）
 *   ✅ 方向键微调（1pt，Shift = 10pt）
 *   ✅ 拖拽时栅格吸附（snapToGrid 开启时）
 *   ✅ 元素间对齐辅助线（showGuides 开启时）
 *   ✅ 栅格背景显示（showGrid 开启时）
 *   ⏳ 鼠标框选（拖空白处多选，P0-2d 后续）
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Rect, Line, Transformer, Text, Image as KImage } from 'react-konva';
import type Konva from 'konva';
import { useCanvasStore } from './store';
import type { CanvasElement, ElementId, ImageElement, RectElement, TextElement } from './types';

const STAGE_PADDING = 60;
const MIN_SIZE = 20;
const GUIDE_COLOR = '#ff3b8a';
const GUIDE_THRESHOLD = 4; // pt，吸附阈值

export function CanvasStage() {
  const meta = useCanvasStore((s) => s.meta);
  const elements = useCanvasStore((s) => s.elements);
  const selectedIds = useCanvasStore((s) => s.selectedIds);
  const settings = useCanvasStore((s) => s.settings);
  const setSelected = useCanvasStore((s) => s.setSelected);
  const updateElement = useCanvasStore((s) => s.updateElement);
  const removeElements = useCanvasStore((s) => s.removeElements);
  const duplicateElements = useCanvasStore((s) => s.duplicateElements);
  const replaceWithImage = useCanvasStore((s) => s.replaceWithImage);
  const pushHistory = useCanvasStore((s) => s._pushHistory);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImageIdRef = useRef<ElementId | null>(null);

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const layerRef = useRef<Konva.Layer>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });

  // 容器尺寸自适应
  useEffect(() => {
    const update = () => {
      const el = document.getElementById('canvas-host');
      if (!el) return;
      setStageSize({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Transformer 跟随选中元素
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const stage = stageRef.current;
    if (!stage) return;
    const nodes = selectedIds
      .map((id) => stage.findOne(`#${id}`))
      .filter((n): n is Konva.Node => Boolean(n));
    tr.nodes(nodes);
    tr.getLayer()?.batchDraw();
  }, [selectedIds, elements]);

  // 缩放比例
  const scale = Math.min(
    (stageSize.width - STAGE_PADDING * 2) / meta.width,
    (stageSize.height - STAGE_PADDING * 2) / meta.height,
  );
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 0.5;
  const offsetX = (stageSize.width - meta.width * safeScale) / 2;
  const offsetY = (stageSize.height - meta.height * safeScale) / 2;

  // 按 zIndex 排序
  const sorted = useMemo(
    () => [...elements].filter((el) => !el.hidden).sort((a, b) => a.zIndex - b.zIndex),
    [elements],
  );

  // 当前拖拽中的元素，用于辅助线计算
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number; w: number; h: number } | null>(
    null,
  );

  // 计算对齐辅助线
  const guides = useMemo(() => {
    if (!settings.showGuides || !draggingId || !dragPos) return [];
    const other = elements.filter((e) => e.id !== draggingId && !e.hidden);
    const lines: Array<{ type: 'v' | 'h'; pos: number; from: number; to: number }> = [];
    const dragCenter = {
      x: dragPos.x + dragPos.w / 2,
      y: dragPos.y + dragPos.h / 2,
    };

    for (const el of other) {
      const cx = el.x + el.w / 2;
      const cy = el.y + el.h / 2;
      // 垂直辅助线
      for (const v of [el.x, cx, el.x + el.w]) {
        if (Math.abs(v - dragPos.x) < GUIDE_THRESHOLD) {
          lines.push({ type: 'v', pos: v, from: Math.min(el.y, dragPos.y) - 20, to: Math.max(el.y + el.h, dragPos.y + dragPos.h) + 20 });
        } else if (Math.abs(v - dragPos.x - dragPos.w) < GUIDE_THRESHOLD) {
          lines.push({ type: 'v', pos: v, from: Math.min(el.y, dragPos.y) - 20, to: Math.max(el.y + el.h, dragPos.y + dragPos.h) + 20 });
        } else if (Math.abs(v - dragCenter.x) < GUIDE_THRESHOLD) {
          lines.push({ type: 'v', pos: v, from: Math.min(el.y, dragPos.y) - 20, to: Math.max(el.y + el.h, dragPos.y + dragPos.h) + 20 });
        }
      }
      // 水平辅助线
      for (const h of [el.y, cy, el.y + el.h]) {
        if (Math.abs(h - dragPos.y) < GUIDE_THRESHOLD) {
          lines.push({ type: 'h', pos: h, from: Math.min(el.x, dragPos.x) - 20, to: Math.max(el.x + el.w, dragPos.x + dragPos.w) + 20 });
        } else if (Math.abs(h - dragPos.y - dragPos.h) < GUIDE_THRESHOLD) {
          lines.push({ type: 'h', pos: h, from: Math.min(el.x, dragPos.x) - 20, to: Math.max(el.x + el.w, dragPos.x + dragPos.w) + 20 });
        } else if (Math.abs(h - dragCenter.y) < GUIDE_THRESHOLD) {
          lines.push({ type: 'h', pos: h, from: Math.min(el.x, dragPos.x) - 20, to: Math.max(el.x + el.w, dragPos.x + dragPos.w) + 20 });
        }
      }
    }
    return lines;
  }, [draggingId, dragPos, elements, settings.showGuides]);

  // 吸附到栅格
  const snap = (n: number) =>
    settings.snapToGrid ? Math.round(n / settings.gridSize) * settings.gridSize : n;

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (e.target === e.target.getStage()) {
      setSelected([]);
    }
  };

  const handleElementClick = (id: string, e: Konva.KonvaEventObject<MouseEvent>) => {
    e.cancelBubble = true;
    const isMulti = e.evt.shiftKey;
    if (isMulti) {
      setSelected(
        selectedIds.includes(id)
          ? selectedIds.filter((x) => x !== id)
          : [...selectedIds, id],
      );
    } else {
      setSelected([id]);
    }
  };

  const handleDragStart = (id: string, _e: Konva.KonvaEventObject<DragEvent>) => {
    setDraggingId(id);
    const el = elements.find((x) => x.id === id);
    if (el) setDragPos({ x: el.x, y: el.y, w: el.w, h: el.h });
  };

  const handleDragMove = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    const node = e.target;
    const el = elements.find((x) => x.id === id);
    if (!el) return;
    setDragPos({
      x: node.x(),
      y: node.y(),
      w: el.w,
      h: el.h,
    });
  };

  const handleDragEnd = (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
    setDraggingId(null);
    setDragPos(null);
    const node = e.target;
    pushHistory();
    const newX = snap(node.x());
    const newY = snap(node.y());
    node.position({ x: newX, y: newY });
    updateElement(id, { x: newX, y: newY });
  };

  const handleTransformEnd = () => {
    pushHistory();
    const tr = transformerRef.current;
    if (!tr) return;
    tr.nodes().forEach((node) => {
      const id = node.id();
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      const newW = Math.max(MIN_SIZE, node.width() * scaleX);
      const newH = Math.max(MIN_SIZE, node.height() * scaleY);
      node.scaleX(1);
      node.scaleY(1);
      updateElement(id, {
        x: snap(node.x()),
        y: snap(node.y()),
        w: newW,
        h: newH,
        rotation: node.rotation(),
      });
    });
  };

  // 双击占位元素（Rect / Image）→ 打开文件选择器
  const handlePlaceholderDblClick = (id: ElementId) => {
    const el = elements.find((x) => x.id === id);
    if (!el) return;
    // Image 占位（isPlaceholder=true）或 Rect 名字带"占位"
    const isPlaceholder =
      (el.type === 'image' && el.isPlaceholder) ||
      (el.name ?? '').includes('占位');
    if (!isPlaceholder) return;
    pendingImageIdRef.current = id;
    fileInputRef.current?.click();
  };

  const onPlaceholderFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const id = pendingImageIdRef.current;
    pendingImageIdRef.current = null;
    e.target.value = '';
    if (!file || !id) return;
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      replaceWithImage(id, src);
    };
    reader.readAsDataURL(file);
  };

  // 快捷键
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA';
      if (inField) return;

      const mod = e.ctrlKey || e.metaKey;

      // Ctrl+Z / Ctrl+Shift+Z
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) get().redo();
        else get().undo();
        return;
      }
      // Ctrl+Y 重做
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        get().redo();
        return;
      }
      // Ctrl+D 复制
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateElements(get().selectedIds);
        return;
      }
      // Ctrl+A 全选
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelected(elements.map((el) => el.id));
        return;
      }
      // Ctrl+S 保存（在 App 层处理，不重复）
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        return;
      }
      // Esc 取消选中
      if (e.key === 'Escape') {
        setSelected([]);
        return;
      }
      // Delete / Backspace
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          removeElements(selectedIds);
        }
        return;
      }
      // 方向键微调
      if (selectedIds.length > 0) {
        const step = e.shiftKey ? 10 : 1;
        const patch: Array<{ id: string; patch: Partial<CanvasElement> }> = [];
        for (const id of selectedIds) {
          const el = elements.find((x) => x.id === id);
          if (!el || el.locked) continue;
          const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
          const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
          if (dx || dy) {
            patch.push({ id, patch: { x: el.x + dx, y: el.y + dy } });
            e.preventDefault();
          }
        }
        if (patch.length > 0) {
          get().updateElements(patch);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds, elements, setSelected, removeElements, duplicateElements]);

  // 暴露 store get（快捷键里要用）
  const get = useCanvasStore.getState;

  return (
    <div id="canvas-host" className="canvas-host">
      <Stage
        ref={stageRef}
        width={stageSize.width}
        height={stageSize.height}
        onMouseDown={handleStageClick}
        onTouchStart={handleStageClick}
        scaleX={safeScale}
        scaleY={safeScale}
        x={offsetX}
        y={offsetY}
      >
        {/* 画布底色 + 栅格背景 */}
        <Layer listening={false}>
          <Rect
            x={0}
            y={0}
            width={meta.width}
            height={meta.height}
            fill={meta.background}
            shadowColor="#000"
            shadowBlur={20}
            shadowOpacity={0.15}
            shadowOffsetY={4}
          />
          {settings.showGrid && <GridBackground width={meta.width} height={meta.height} size={settings.gridSize} />}
        </Layer>

        {/* 元素层 */}
        <Layer ref={layerRef}>
          {sorted.map((el) => (
            <RenderElement
              key={el.id}
              element={el}
              onSelect={(e) => handleElementClick(el.id, e)}
              onDragStart={(e) => handleDragStart(el.id, e)}
              onDragMove={(e) => handleDragMove(el.id, e)}
              onDragEnd={(e) => handleDragEnd(el.id, e)}
              onPlaceholderDblClick={handlePlaceholderDblClick}
            />
          ))}

          {/* 对齐辅助线 */}
          {guides.map((g, i) => (
            <Line
              key={i}
              points={
                g.type === 'v'
                  ? [g.pos, g.from, g.pos, g.to]
                  : [g.from, g.pos, g.to, g.pos]
              }
              stroke={GUIDE_COLOR}
              strokeWidth={1 / safeScale}
              dash={[4 / safeScale, 4 / safeScale]}
              listening={false}
            />
          ))}

          <Transformer
            ref={transformerRef}
            visible={selectedIds.length > 0}
            rotateEnabled
            anchorSize={8}
            anchorStroke="#667eea"
            anchorFill="#fff"
            borderStroke="#667eea"
            borderStrokeWidth={1.5}
            borderDash={[4, 4]}
            keepRatio={false}
            boundBoxFunc={(_oldBox, newBox) => {
              if (Math.abs(newBox.width) < MIN_SIZE || Math.abs(newBox.height) < MIN_SIZE) {
                return _oldBox;
              }
              return newBox;
            }}
            onTransformEnd={handleTransformEnd}
          />
        </Layer>
      </Stage>

      <div className="canvas-hud">
        {meta.name} · {meta.width}×{meta.height}pt · 缩放 {Math.round(safeScale * 100)}%
        {settings.snapToGrid && ' · 吸附开'}
        {settings.showGrid && ' · 栅格开'}
      </div>

      {/* 隐藏的文件输入 - 用于占位矩形双击上传 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onPlaceholderFileChange}
      />
    </div>
  );
}

// 栅格背景（多个 Line 比用一个 Rect 画 stripes 更省内存）
function GridBackground({ width, height, size }: { width: number; height: number; size: number }) {
  const lines: Array<[number, number, number, number]> = [];
  for (let x = size; x < width; x += size) {
    lines.push([x, 0, x, height]);
  }
  for (let y = size; y < height; y += size) {
    lines.push([0, y, width, y]);
  }
  return (
    <>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} stroke="#d0d4dc" strokeWidth={0.5} listening={false} />
      ))}
    </>
  );
}

interface RenderElementProps {
  element: CanvasElement;
  onSelect: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onDragStart: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => void;
  onPlaceholderDblClick: (id: ElementId) => void;
}

function RenderElement({
  element,
  onSelect,
  onDragStart,
  onDragMove,
  onDragEnd,
  onPlaceholderDblClick,
}: RenderElementProps) {
  // 通用事件 / 变换属性
  const common = {
    id: element.id,
    x: element.x,
    y: element.y,
    rotation: element.rotation,
    draggable: !element.locked,
    onMouseDown: onSelect,
    onTouchStart: onSelect,
    onDragStart,
    onDragMove,
    onDragEnd,
  };

  if (element.type === 'rect') {
    return (
      <RectShape
        el={element}
        common={common}
        onDblClick={() => onPlaceholderDblClick(element.id)}
      />
    );
  }
  if (element.type === 'image') {
    return (
      <ImageShape
        el={element}
        common={common}
        onDblClick={() => onPlaceholderDblClick(element.id)}
      />
    );
  }
  return <TextShape el={element} common={common} />;
}

function RectShape({
  el,
  common,
  onDblClick,
}: {
  el: RectElement;
  common: Record<string, unknown>;
  onDblClick: () => void;
}) {
  return (
    <Rect
      {...common}
      width={el.w}
      height={el.h}
      fill={el.fill}
      stroke={el.stroke}
      strokeWidth={el.strokeWidth}
      cornerRadius={el.cornerRadius}
      onDblClick={onDblClick}
      onDblTap={onDblClick}
    />
  );
}

function ImageShape({
  el,
  common,
  onDblClick,
}: {
  el: ImageElement;
  common: Record<string, unknown>;
  onDblClick: () => void;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.src = el.src;
    img.onload = () => setImage(img);
    return () => {
      img.onload = null;
    };
  }, [el.src]);

  return (
    <KImage
      {...common}
      image={image ?? undefined}
      width={el.w}
      height={el.h}
      onDblClick={onDblClick}
      onDblTap={onDblClick}
    />
  );
}

function TextShape({
  el,
  common,
}: {
  el: TextElement;
  common: Record<string, unknown>;
}) {
  // 视觉高度：字号 × 行高 × 行数（用于 bounding box 参考）
  const lineCount = el.content.split('\n').length;
  const visualHeight = Math.max(el.h, el.fontSize * el.lineHeight * lineCount);

  return (
    <Text
      {...common}
      width={el.w}
      height={visualHeight}
      text={el.content}
      fontSize={el.fontSize}
      fontFamily={el.fontFamily}
      fontStyle={el.fontStyle}
      fill={el.fill}
      align={el.textAlign}
      lineHeight={el.lineHeight}
      verticalAlign="top"
    />
  );
}
