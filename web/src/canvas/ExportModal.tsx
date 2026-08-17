/**
 * 导出弹层
 *
 * 选项：格式（JPG / PDF） + 分辨率（1x / 2x）
 * 点"导出" → POST /api/cards/render → 接收二进制 → 浏览器下载
 */

import { useState } from 'react';
import { useCanvasStore } from './store';
import { saveProject } from './db';
import { saveCurrentProjectId } from './db';
import { saveNow } from './useAutoSave';

interface ExportModalProps {
  onClose: () => void;
}

type Format = 'jpg' | 'pdf';
type Scale = 1 | 2;

interface ExportState {
  status: 'idle' | 'rendering' | 'success' | 'error';
  message?: string;
  filename?: string;
  size?: number;
  ms?: number;
}

export function ExportModal({ onClose }: ExportModalProps) {
  const meta = useCanvasStore((s) => s.meta);
  const elements = useCanvasStore((s) => s.elements);
  const projectName = useCanvasStore((s) => s.projectName);
  const projectId = useCanvasStore((s) => s.projectId);
  const model = useCanvasStore((s) => s.model);

  const [format, setFormat] = useState<Format>('jpg');
  const [scale, setScale] = useState<Scale>(1);
  const [state, setState] = useState<ExportState>({ status: 'idle' });

  const filename = projectName.trim() || 'model-card';
  const placeholderCount = elements.filter((e) => e.type === 'image' && e.isPlaceholder).length;
  const hasContent = elements.length > 0;

  const handleExport = async () => {
    if (!hasContent) {
      setState({ status: 'error', message: '画布为空，没东西可导出' });
      return;
    }
    if (placeholderCount > 0) {
      const ok = window.confirm(
        `画布上还有 ${placeholderCount} 个图片占位没上传，确定要导出吗？\n（占位位置会显示为白底+文字"双击上传照片"）`,
      );
      if (!ok) return;
    }
    setState({ status: 'rendering', message: '正在渲染...' });
    try {
      const res = await fetch('/api/cards/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canvas: meta,
          elements,
          format,
          scale,
          quality: 92,
          filename,
        }),
      });
      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        setState({ status: 'error', message: `服务器错误 (${res.status}): ${errText}` });
        return;
      }
      const blob = await res.blob();
      const downloadName = `${filename}.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setState({
        status: 'success',
        message: `已下载 ${downloadName}`,
        filename: downloadName,
        size: blob.size,
        ms: Number(res.headers.get('X-Render-Ms') ?? '0'),
      });

      // 导出成功后另发一个 1x 请求存缩略图（用客户端画布快速生成，不走 server）
      void generateThumbnail().catch((err) => console.warn('缩略图生成失败：', err));
    } catch (err) {
      setState({
        status: 'error',
        message: `请求失败: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  /**
   * 用客户端 canvas 快速生成缩略图（避免再发一次 server 请求）
   * 缩略图 = 画布整体缩到 400x...，压缩成 jpeg dataURL
   * 写到 project.thumbnail 存到 IndexedDB
   */
  const generateThumbnail = async () => {
    await saveNow(); // 先把当前最新状态写盘
    const thumbnail = await renderCanvasToThumbnail();
    if (!thumbnail) return;
    const now = Date.now();
    await saveProject({
      id: projectId,
      name: projectName,
      createdAt: 0,
      updatedAt: now,
      thumbnail,
      canvas: meta,
      elements,
      model,
    });
    saveCurrentProjectId(projectId);
  };

  /**
   * 用 Konva stage 直接导出一张缩略图 dataURL
   * 找出页面里的 Konva stage DOM（Konva 内部用 canvas），导出 toDataURL
   * Konva.Stage 暴露在 window 上不太好找，所以直接复用 server 渲染 1x 图作为缩略图
   * —— 简单点：直接复用本次导出的 blob，缩小一下
   */
  const renderCanvasToThumbnail = async (): Promise<string | null> => {
    try {
      // 用 fetch 走 1x 渲染拿一张小图当缩略图（避免前端重新组装元素）
      const res = await fetch('/api/cards/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canvas: meta,
          elements,
          format: 'jpg',
          scale: 1,
          quality: 70,
          filename: '__thumbnail__',
        }),
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const formatBytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="modal-backdrop" onClick={state.status === 'rendering' ? undefined : onClose}>
      <div className="modal-box export-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>🚀 导出模卡</h2>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            disabled={state.status === 'rendering'}
          >
            ×
          </button>
        </header>

        <div className="modal-body">
          <section className="export-info">
            <div className="info-row">
              <span className="info-label">项目名</span>
              <span className="info-value">{projectName || '未命名'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">画布尺寸</span>
              <span className="info-value">
                {meta.width} × {meta.height} pt
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">元素数</span>
              <span className="info-value">{elements.length}</span>
            </div>
            {placeholderCount > 0 && (
              <div className="info-row warn">
                <span className="info-label">⚠️ 占位</span>
                <span className="info-value">{placeholderCount} 个图片未上传</span>
              </div>
            )}
          </section>

          <section className="export-section">
            <div className="export-section-title">格式</div>
            <div className="format-options">
              <label className={`format-option ${format === 'jpg' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="format"
                  value="jpg"
                  checked={format === 'jpg'}
                  onChange={() => setFormat('jpg')}
                />
                <div>
                  <div className="format-name">JPG</div>
                  <div className="format-hint">屏幕查看 / 社交分享 / 微信</div>
                </div>
              </label>
              <label className={`format-option ${format === 'pdf' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="format"
                  value="pdf"
                  checked={format === 'pdf'}
                  onChange={() => setFormat('pdf')}
                />
                <div>
                  <div className="format-name">PDF</div>
                  <div className="format-hint">印刷投递 / 正式提交</div>
                </div>
              </label>
            </div>
          </section>

          <section className="export-section">
            <div className="export-section-title">分辨率</div>
            <div className="scale-options">
              <label className={`scale-option ${scale === 1 ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="scale"
                  value="1"
                  checked={scale === 1}
                  onChange={() => setScale(1)}
                />
                <div>
                  <div className="scale-name">1x 标准</div>
                  <div className="scale-hint">
                    {Math.round(meta.width)} × {Math.round(meta.height)} px
                  </div>
                </div>
              </label>
              <label className={`scale-option ${scale === 2 ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="scale"
                  value="2"
                  checked={scale === 2}
                  onChange={() => setScale(2)}
                />
                <div>
                  <div className="scale-name">2x 高清</div>
                  <div className="scale-hint">
                    {Math.round(meta.width * 2)} × {Math.round(meta.height * 2)} px
                  </div>
                </div>
              </label>
            </div>
          </section>

          {state.status === 'success' && (
            <section className="export-result success">
              <div className="result-icon">✅</div>
              <div>
                <div className="result-title">{state.message}</div>
                <div className="result-meta">
                  {state.size && formatBytes(state.size)} · 渲染耗时 {state.ms}ms
                </div>
              </div>
            </section>
          )}
          {state.status === 'error' && (
            <section className="export-result error">
              <div className="result-icon">❌</div>
              <div>
                <div className="result-title">导出失败</div>
                <div className="result-meta">{state.message}</div>
              </div>
            </section>
          )}
        </div>

        <footer className="modal-footer">
          <span className="modal-hint">
            {state.status === 'rendering' ? '正在生成图片...' : '渲染在前端发起，下载到本地'}
          </span>
          <div className="modal-actions-row">
            <button type="button" onClick={onClose} disabled={state.status === 'rendering'}>
              {state.status === 'success' ? '完成' : '取消'}
            </button>
            <button
              type="button"
              className="primary-btn"
              onClick={handleExport}
              disabled={state.status === 'rendering'}
            >
              {state.status === 'rendering' ? '导出中...' : '🚀 导出'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
