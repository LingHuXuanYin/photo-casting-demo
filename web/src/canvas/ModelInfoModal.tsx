/**
 * 模特信息编辑弹层
 *
 * 录入/编辑模特基础信息，提交后写回 store
 * 模特信息会显示在画布上（v2 接入自动排版，v1 用户自己加文字元素）
 */

import { useState } from 'react';
import { useCanvasStore } from './store';
import type { ModelInfo } from './project';

interface ModelInfoModalProps {
  onClose: () => void;
}

export function ModelInfoModal({ onClose }: ModelInfoModalProps) {
  const model = useCanvasStore((s) => s.model);
  const setModel = useCanvasStore((s) => s.setModel);
  const [draft, setDraft] = useState<ModelInfo>({ ...model });
  const [unit, setUnit] = useState<'cm' | 'inch'>(model.height ? (model.height > 100 ? 'cm' : 'inch') : 'cm');

  // 实时同步：每次输入即写回 store（不用再手动点"保存"）
  const update = <K extends keyof ModelInfo>(key: K, value: ModelInfo[K]) => {
    const newDraft = { ...draft, [key]: value };
    setDraft(newDraft);
    setModel(newDraft);
  };

  const handleClose = () => {
    // 关闭前再同步一次（防止 setState 还没生效）
    setModel(draft);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-box model-info-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>👤 模特信息</h2>
          <button type="button" className="close-btn" onClick={handleClose}>
            ×
          </button>
        </header>

        <div className="modal-body">
          <div className="unit-toggle">
            <span>单位：</span>
            <button
              type="button"
              className={unit === 'cm' ? 'active' : ''}
              onClick={() => {
                setUnit('cm');
                // 简单换算：从 inch 转 cm
                if (unit === 'inch') {
                  const converted = {
                    ...draft,
                    height: draft.height ? Math.round(draft.height * 2.54) : draft.height,
                    weight: draft.weight ? Math.round(draft.weight * 0.4536) : draft.weight,
                    bust: draft.bust ? Math.round(draft.bust * 2.54) : draft.bust,
                    waist: draft.waist ? Math.round(draft.waist * 2.54) : draft.waist,
                    hips: draft.hips ? Math.round(draft.hips * 2.54) : draft.hips,
                  };
                  setDraft(converted);
                  setModel(converted);
                }
              }}
            >
              cm / kg
            </button>
            <button
              type="button"
              className={unit === 'inch' ? 'active' : ''}
              onClick={() => {
                setUnit('inch');
                if (unit === 'cm') {
                  const converted = {
                    ...draft,
                    height: draft.height ? Math.round(draft.height / 2.54) : draft.height,
                    weight: draft.weight ? Math.round(draft.weight / 0.4536) : draft.weight,
                    bust: draft.bust ? Math.round(draft.bust / 2.54) : draft.bust,
                    waist: draft.waist ? Math.round(draft.waist / 2.54) : draft.waist,
                    hips: draft.hips ? Math.round(draft.hips / 2.54) : draft.hips,
                  };
                  setDraft(converted);
                  setModel(converted);
                }
              }}
            >
              inch / lb
            </button>
          </div>

          <section className="form-section">
            <div className="form-section-title">基础信息</div>
            <div className="form-row">
              <label>姓名 *</label>
              <input
                type="text"
                value={draft.name ?? ''}
                onChange={(e) => update('name', e.target.value)}
                placeholder="模特姓名"
              />
            </div>
            <div className="form-row">
              <label>艺名 / 英文名</label>
              <input
                type="text"
                value={draft.englishName ?? ''}
                onChange={(e) => update('englishName', e.target.value)}
                placeholder="Optional"
              />
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-title">身体数据</div>
            <div className="form-grid">
              <label>
                身高
                <div className="input-with-unit">
                  <input
                    type="number"
                    value={draft.height ?? ''}
                    onChange={(e) => update('height', e.target.value ? Number(e.target.value) : undefined)}
                  />
                  <span>{unit === 'cm' ? 'cm' : 'in'}</span>
                </div>
              </label>
              <label>
                体重
                <div className="input-with-unit">
                  <input
                    type="number"
                    value={draft.weight ?? ''}
                    onChange={(e) => update('weight', e.target.value ? Number(e.target.value) : undefined)}
                  />
                  <span>{unit === 'cm' ? 'kg' : 'lb'}</span>
                </div>
              </label>
              <label>
                胸围
                <div className="input-with-unit">
                  <input
                    type="number"
                    value={draft.bust ?? ''}
                    onChange={(e) => update('bust', e.target.value ? Number(e.target.value) : undefined)}
                  />
                  <span>{unit}</span>
                </div>
              </label>
              <label>
                腰围
                <div className="input-with-unit">
                  <input
                    type="number"
                    value={draft.waist ?? ''}
                    onChange={(e) => update('waist', e.target.value ? Number(e.target.value) : undefined)}
                  />
                  <span>{unit}</span>
                </div>
              </label>
              <label>
                臀围
                <div className="input-with-unit">
                  <input
                    type="number"
                    value={draft.hips ?? ''}
                    onChange={(e) => update('hips', e.target.value ? Number(e.target.value) : undefined)}
                  />
                  <span>{unit}</span>
                </div>
              </label>
              <label>
                鞋码
                <div className="input-with-unit">
                  <input
                    type="number"
                    step="0.5"
                    value={draft.shoe ?? ''}
                    onChange={(e) => update('shoe', e.target.value ? Number(e.target.value) : undefined)}
                  />
                  <span>码</span>
                </div>
              </label>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-title">其他特征</div>
            <div className="form-grid">
              <label>
                发色
                <input
                  type="text"
                  value={draft.hairColor ?? ''}
                  onChange={(e) => update('hairColor', e.target.value)}
                  placeholder="黑/棕/金…"
                />
              </label>
              <label>
                瞳色
                <input
                  type="text"
                  value={draft.eyeColor ?? ''}
                  onChange={(e) => update('eyeColor', e.target.value)}
                  placeholder="黑/棕/蓝…"
                />
              </label>
              <label>
                肤色
                <input
                  type="text"
                  value={draft.skinTone ?? ''}
                  onChange={(e) => update('skinTone', e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className="form-section">
            <div className="form-section-title">联系方式</div>
            <div className="form-row">
              <label>经纪公司</label>
              <input
                type="text"
                value={draft.agency ?? ''}
                onChange={(e) => update('agency', e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>经纪人</label>
              <input
                type="text"
                value={draft.agentName ?? ''}
                onChange={(e) => update('agentName', e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>经纪人电话</label>
              <input
                type="text"
                value={draft.agentPhone ?? ''}
                onChange={(e) => update('agentPhone', e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>邮箱</label>
              <input
                type="email"
                value={draft.email ?? ''}
                onChange={(e) => update('email', e.target.value)}
              />
            </div>
            <div className="form-row">
              <label>城市</label>
              <input
                type="text"
                value={draft.city ?? ''}
                onChange={(e) => update('city', e.target.value)}
              />
            </div>
          </section>
        </div>

        <footer className="modal-footer">
          <span className="modal-hint">💡 改动实时自动保存，关闭即可</span>
          <div className="modal-actions-row">
            <button type="button" className="primary-btn" onClick={handleClose}>
              完成
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
