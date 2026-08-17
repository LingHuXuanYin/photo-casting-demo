import { GlobalFonts, createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

// 再注册一次
GlobalFonts.registerFromPath('./fonts/SourceHanSansSC-Regular.otf', 'Source Han Sans SC');
GlobalFonts.registerFromPath('./fonts/Inter-Regular.ttf', 'Inter');

const canvas = createCanvas(800, 200);
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#fff';
ctx.fillRect(0, 0, 800, 200);

ctx.fillStyle = '#000';
ctx.font = '64px "Source Han Sans SC", "Inter", sans-serif';
ctx.textBaseline = 'top';
ctx.fillText('模特姓名 测试', 10, 10);

ctx.font = '32px "Inter", "Source Han Sans SC", sans-serif';
ctx.fillText('height 165cm 体重', 10, 100);

writeFileSync('../test-min.jpg', canvas.toBuffer('image/jpeg', 90));
console.log('saved test-min.jpg');
