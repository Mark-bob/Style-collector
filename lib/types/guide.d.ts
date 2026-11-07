/**
 * guide 生成（photo-only）：把已结构化的照片参考包映射成母版 7 节的 `guide-*.md`。
 *
 * 这是**确定性映射**，不是第二次 AI 提取：只读 pack.json 里已有的字段，
 * 原样引用；没有的字段标 [待采集] / [未采集]，不推导、不补全、不拆解。
 */
import type { DirectorPack } from './schema.js';
export interface GuideResult {
    markdown: string;
    warnings: string[];
}
export declare function renderGuide(pack: DirectorPack, packId: string): GuideResult;
