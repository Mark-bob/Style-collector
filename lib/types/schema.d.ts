/**
 * DirectorPack —— 以「可溯源证据」为骨架的导演风格包。
 *
 * 与早期的卡片模型不同，这里不存一段现成提示词，而是把风格拆成可核验的层：
 * meta（锚点作品 + 来源）→ expression_dna（镜头样本 / 色彩 / 镜头语法 / 剪辑 / 声音）
 * → mental_models / decision_heuristics / anti_patterns / honest_limits。
 *
 * 这一层是纯函数：字段上限、嵌套校验、增量合并（merge）与落盘读取校验都在
 * 这里，store 只负责持久化，工具层只负责参数与渲染。
 */
/** 包文件格式版本（不是导演包自己的 version）。 */
export declare const PACK_FILE_VERSION = 1;
export interface PackSources {
    works: string[];
    interviews: string[];
    critics: string[];
    collaborators: string[];
    technical_records: string[];
    timeline: string[];
}
export interface DirectorPackMeta {
    director: string;
    anchor_works: string[];
    sources: PackSources;
    version: string;
    created_at: string;
}
/** 照片模式：每张照片只关注 focus 列出的要素。 */
export declare const PHOTO_FOCUS: readonly ["light_direction", "color_palette", "composition", "perspective", "setting", "material", "texture", "atmosphere", "subject", "props", "note"];
export type PhotoFocus = (typeof PHOTO_FOCUS)[number];
/** 照片在参考包里的用途；仅用于 guide §6 与色板分组，不参与 AI 观察。 */
export declare const PHOTO_ROLES: readonly ["style", "lighting", "color", "composition", "camera", "setting", "material", "texture", "atmosphere", "subject", "props", "note", "prop"];
export type PhotoRole = (typeof PHOTO_ROLES)[number];
export interface PhotoObservations {
    light_direction?: string;
    key_colors?: string[];
    composition?: string;
    perspective?: string;
    setting?: string;
    material?: string;
    texture?: string;
    atmosphere?: string;
    subject?: string;
    props?: string;
    note?: string;
}
export interface PhotoRecord {
    photo_id: string;
    path: string;
    focus: PhotoFocus[];
    observations: PhotoObservations;
    evidence_level: 'observed';
    path_verified?: boolean;
    role?: PhotoRole;
}
export interface DecisionHeuristic {
    situation: string;
    choice: string;
    rationale?: string;
}
export interface ExpressionDna {
    color_palette: string[];
    lens_grammar: Record<string, unknown>;
    editing_rhythm: Record<string, unknown>;
    sound_design: Record<string, unknown>;
}
export interface DirectorPack {
    meta: DirectorPackMeta;
    expression_dna: ExpressionDna;
    mental_models: string[];
    decision_heuristics: DecisionHeuristic[];
    anti_patterns: string[];
    honest_limits: string[];
    photos?: PhotoRecord[];
}
export declare function emptyPack(director: string, anchorWorks: string[]): DirectorPack;
declare const SOURCE_KINDS: readonly ["works", "interviews", "critics", "collaborators", "technical_records", "timeline"];
export type SourceKind = (typeof SOURCE_KINDS)[number];
/** 工具提交的增量输入：只带要更新的层，缺省字段不参与合并。 */
export interface PackSaveInput {
    director: string;
    anchor_works?: string[];
    sources?: Partial<PackSources>;
    expression_dna?: Partial<ExpressionDna>;
    mental_models?: string[];
    decision_heuristics?: DecisionHeuristic[];
    anti_patterns?: string[];
    honest_limits?: string[];
    version?: string;
}
export interface ValidationSuccess<T> {
    ok: true;
    value: T;
}
export interface ValidationFailure {
    ok: false;
    issues: string[];
}
export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;
export declare function isPlainObject(value: unknown): value is Record<string, unknown>;
export declare function observationForFocus(photo: PhotoRecord, focus: PhotoFocus): string | string[] | undefined;
/** 校验一张照片记录（photo_append 与落盘读取共用）。 */
export declare function validatePhotoInput(raw: unknown): ValidationResult<PhotoRecord>;
/** 校验一张**完整**包（落盘读取与 replace 写入都用它）。 */
export declare function parseStoredPack(raw: unknown): DirectorPack | null;
/** 校验工具提交的增量输入；未知字段直接报错，避免拼写错误被静默吞掉。 */
export declare function normalizeSaveInput(raw: unknown): ValidationResult<PackSaveInput>;
export declare function bumpPatchVersion(version: string): string;
/**
 * 把增量输入应用到一张包上。base 为 undefined 时新建；
 * 合并规则：数组去重追加、对象浅合并。
 */
export declare function applySave(input: PackSaveInput, base: DirectorPack | undefined, now: Date): DirectorPack;
export interface PackStats {
    anchor_works: number;
    mental_models: number;
    decision_heuristics: number;
    anti_patterns: number;
    honest_limits: number;
    sources: number;
}
export declare function packStats(pack: DirectorPack): PackStats;
/** 全文搜索：导演、作品、来源、照片观察、心智模型……整包序列化后分词匹配。 */
export declare function matchesPack(pack: DirectorPack, query: string): boolean;
export {};
