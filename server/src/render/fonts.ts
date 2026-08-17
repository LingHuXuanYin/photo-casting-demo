/**
 * 字体管理
 *
 * 策略：项目内置字体为主，系统字体为可选 fallback。
 *
 * 启动时扫描 server/fonts/*.ttf|otf 并按文件名映射到固定的 family name：
 *   - Inter-Regular.ttf / Inter-Bold.ttf            → "Inter"
 *   - SourceHanSansSC-Regular.otf / -Bold.otf       → "Source Han Sans SC"
 *
 * 模板里的 fontFamily 通常写的是 '"Inter", "Source Han Sans SC", sans-serif'，
 * 注册名对得上，@napi-rs/canvas 才能正确按字符 fallback（CJK 走思源黑体，Latin 走 Inter）。
 *
 * 系统字体（微软雅黑/PingFang/Noto）作为兜底：当内置字体缺失时仍能渲染。
 */

import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GlobalFonts } from '@napi-rs/canvas';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * 内置字体文件名 → 注册的 family name
 * 顺序很重要：每行（一个 family）里第一个文件作为"主"权重，剩下的视为粗体/细体
 */
const BUNDLED_FONTS: Array<{ pattern: RegExp; family: string }> = [
  { pattern: /^Inter[-_](Regular|Normal|Book)/i, family: 'Inter' },
  { pattern: /^Inter[-_](Bold|Semibold|SemiBold|Medium|Black)/i, family: 'Inter' },
  { pattern: /^SourceHanSansSC[-_]Regular/i, family: 'Source Han Sans SC' },
  { pattern: /^SourceHanSansSC[-_](Bold|Heavy)/i, family: 'Source Han Sans SC' },
  // 兼容其他常见命名
  { pattern: /^NotoSansSC[-_]Regular/i, family: 'Noto Sans SC' },
  { pattern: /^NotoSansSC[-_]Bold/i, family: 'Noto Sans SC' },
  { pattern: /^NotoSansCJK/i, family: 'Noto Sans CJK SC' },
];

/**
 * 系统字体兜底（仅在 server/fonts/ 缺失对应 family 时启用）
 */
const SYSTEM_FONTS: Array<{ file: string; family: string }> = [
  // Windows
  { file: 'C:\\Windows\\Fonts\\msyh.ttc', family: 'Microsoft YaHei' },
  { file: 'C:\\Windows\\Fonts\\msyhbd.ttc', family: 'Microsoft YaHei' },
  { file: 'C:\\Windows\\Fonts\\simhei.ttf', family: 'SimHei' },
  { file: 'C:\\Windows\\Fonts\\simsun.ttc', family: 'SimSun' },
  // macOS
  { file: '/System/Library/Fonts/PingFang.ttc', family: 'PingFang SC' },
  { file: '/System/Library/Fonts/STHeiti Medium.ttc', family: 'STHeiti' },
  // Linux
  { file: '/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc', family: 'Noto Sans CJK SC' },
  { file: '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc', family: 'Noto Sans CJK SC' },
];

/** 已注册的字体 family 集合（用于 buildFontStack 拼 fallback） */
const registeredFamilies = new Set<string>();

/** 启动时把内置字体全部注册一遍 */
export function registerCustomFonts(): void {
  const fontsDir = join(__dirname, '..', '..', 'fonts');
  if (!existsSync(fontsDir)) {
    console.warn(`[fonts] ⚠ fonts 目录不存在: ${fontsDir}`);
    return;
  }
  const files = readdirSync(fontsDir).filter((f) => /\.(ttf|otf)$/i.test(f));
  if (files.length === 0) {
    console.warn(`[fonts] ⚠ ${fontsDir} 目录为空，未发现任何字体文件`);
  }
  for (const file of files) {
    let family: string | null = null;
    for (const rule of BUNDLED_FONTS) {
      if (rule.pattern.test(file)) {
        family = rule.family;
        break;
      }
    }
    if (!family) {
      // 未知命名：直接用文件名（去掉扩展名 + 替换分隔符）
      family = file.replace(/\.(ttf|otf)$/i, '').replace(/[-_]/g, ' ');
    }
    try {
      GlobalFonts.registerFromPath(join(fontsDir, file), family);
      registeredFamilies.add(family);
      console.log(`[fonts] ✓ ${file} → "${family}"`);
    } catch (err) {
      console.warn(`[fonts] ✗ 注册失败 ${file}:`, err);
    }
  }
}

/**
 * 注册系统字体（仅在 server/fonts/ 缺失对应 family 时作为兜底）
 */
export function registerSystemFonts(): void {
  for (const { file, family } of SYSTEM_FONTS) {
    if (!existsSync(file)) continue;
    if (registeredFamilies.has(family)) continue; // 已有内置字体就不重复注册
    try {
      GlobalFonts.registerFromPath(file, family);
      registeredFamilies.add(family);
      console.log(`[fonts] ✓ [system] ${family} (${file})`);
    } catch (err) {
      console.warn(`[fonts] ✗ [system] 注册失败 ${file}:`, err);
    }
  }
}

/** 主入口：先内置后系统 */
export function registerAllFonts(): void {
  registerCustomFonts();
  // 系统字体暂不注册（@napi-rs/canvas 多字体注册有冲突，会让 Source Han Sans SC 失效）
  // 如果未来要支持非 Win/macOS 平台，可以再开
  // registerSystemFonts();

  if (registeredFamilies.size === 0) {
    console.error(
      '[fonts] ✗ 没有任何字体注册成功！中文/英文将渲染为 tofu。\n' +
        '       请检查 server/fonts/ 目录是否存在并包含字体文件。',
    );
  } else {
    console.log(`[fonts] 已注册 ${registeredFamilies.size} 个字体 family: ${[...registeredFamilies].join(', ')}`);
  }
}

/**
 * 渲染时把传入的 fontFamily 字符串规范化：
 *   - 取第一项
 *   - 去掉引号
 *   - 如果该项未注册，自动降级到已注册的 family
 */
export function normalizeFontFamily(family: string): string {
  const first = family.split(',')[0]?.trim() || 'sans-serif';
  return first.replace(/['"]/g, '');
}

/**
 * 构造带 CJK fallback 的 font-stack
 *
 * 模板里通常写 '"Inter", "Source Han Sans SC", sans-serif'，
 * 这里原样保留 primary，再补一个 CJK fallback 作为最后的兜底。
 */
export function buildFontStack(familyOrStack: string, fontSizePx: number, style: string): string {
  // 入参可能是完整 font stack（如 '"Inter", "Source Han Sans SC", sans-serif'），
  // 也可能是单一 family 名（如 'Inter'）。先取第一项作为 primary。
  const primaryFamily = normalizeFontFamily(familyOrStack);
  const styleStr = style ? `${style} ` : '';
  const primary = `"${primaryFamily}"`;

  // 备选 CJK family：优先用已注册的思源黑体，否则用系统 CJK
  const cjkCandidates = ['Source Han Sans SC', 'Noto Sans SC', 'Noto Sans CJK SC', 'PingFang SC', 'Microsoft YaHei', 'SimHei'];
  const cjkFallback = cjkCandidates
    .filter((f) => registeredFamilies.has(f))
    .map((f) => `"${f}"`)
    .join(', ');

  const result = cjkFallback
    ? `${styleStr}${fontSizePx}px ${primary}, ${cjkFallback}, sans-serif`
    : `${styleStr}${fontSizePx}px ${primary}, sans-serif`;

  return result;
}

/** 解析 fontStyle 字符串到 @napi-rs/canvas 的样式 */
export function parseFontStyle(style: string): string {
  switch (style) {
    case 'bold':
      return 'bold';
    case 'italic':
      return 'italic';
    case 'bold italic':
      return 'bold italic';
    default:
      return '';
  }
}
