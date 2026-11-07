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
export const PACK_FILE_VERSION = 1;
/** 照片模式：每张照片只关注 focus 列出的要素。 */
export const PHOTO_FOCUS = [
    'light_direction',
    'color_palette',
    'composition',
    'perspective',
    'setting',
    'material',
    'texture',
    'atmosphere',
    'subject',
    'props',
    'note',
];
/** 照片在参考包里的用途；仅用于 guide §6 与色板分组，不参与 AI 观察。 */
export const PHOTO_ROLES = [
    'style',
    'lighting',
    'color',
    'composition',
    'camera',
    'setting',
    'material',
    'texture',
    'atmosphere',
    'subject',
    'props',
    'note',
    'prop',
];
/** 旧值兼容：prop 归一为 props。 */
const ROLE_ALIAS = { prop: 'props' };
export function emptyPack(director, anchorWorks) {
    return {
        meta: {
            director,
            anchor_works: anchorWorks,
            sources: {
                works: [],
                interviews: [],
                critics: [],
                collaborators: [],
                technical_records: [],
                timeline: [],
            },
            version: '0.1.0',
            created_at: new Date().toISOString(),
        },
        expression_dna: {
            color_palette: [],
            lens_grammar: {},
            editing_rhythm: {},
            sound_design: {},
        },
        mental_models: [],
        decision_heuristics: [],
        anti_patterns: [],
        honest_limits: [],
    };
}
const LIMITS = {
    director: 120,
    listItem: 400,
    listCount: 300,
    palette: 32,
    heuristics: 120,
    objectBytes: 16000,
};
const SOURCE_KINDS = ['works', 'interviews', 'critics', 'collaborators', 'technical_records', 'timeline'];
const DNA_KEYS = ['color_palette', 'lens_grammar', 'editing_rhythm', 'sound_design'];
export function isPlainObject(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value))
        return false;
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}
function isJsonValue(value, depth = 0) {
    if (depth > 6)
        return false;
    if (value === null)
        return true;
    const type = typeof value;
    if (type === 'string' || type === 'boolean')
        return true;
    if (type === 'number')
        return Number.isFinite(value);
    if (Array.isArray(value))
        return value.every(entry => isJsonValue(entry, depth + 1));
    if (type === 'object') {
        if (!isPlainObject(value))
            return false;
        return Object.values(value).every(entry => isJsonValue(entry, depth + 1));
    }
    return false;
}
function textField(raw, name, max, issues, required = false) {
    if (raw === undefined || raw === null) {
        if (required)
            issues.push(`${name} 不能为空`);
        return undefined;
    }
    if (typeof raw !== 'string') {
        issues.push(`${name} 必须是字符串`);
        return undefined;
    }
    const value = raw.trim();
    if (value.length === 0) {
        if (required)
            issues.push(`${name} 不能为空`);
        return undefined;
    }
    if (value.length > max) {
        issues.push(`${name} 超过 ${max} 字符（当前 ${value.length}）`);
        return undefined;
    }
    return value;
}
function stringList(raw, name, issues, maxItems = LIMITS.listCount, itemMax = LIMITS.listItem) {
    if (raw === undefined || raw === null)
        return [];
    if (!Array.isArray(raw)) {
        issues.push(`${name} 必须是字符串数组`);
        return [];
    }
    const result = [];
    for (const entry of raw) {
        if (typeof entry !== 'string') {
            issues.push(`${name} 里有非字符串项（已跳过）`);
            continue;
        }
        const value = entry.trim();
        if (value.length === 0)
            continue;
        if (value.length > itemMax) {
            issues.push(`${name} 单项超过 ${itemMax} 字符（已跳过）：${value.slice(0, 16)}…`);
            continue;
        }
        if (!result.includes(value))
            result.push(value);
    }
    if (result.length > maxItems) {
        issues.push(`${name} 最多 ${maxItems} 项（当前 ${result.length}，多余项已丢弃）`);
        result.length = maxItems;
    }
    return result;
}
function jsonObject(raw, name, issues) {
    if (raw === undefined || raw === null)
        return undefined;
    if (!isPlainObject(raw)) {
        issues.push(`${name} 必须是对象`);
        return undefined;
    }
    if (!isJsonValue(raw, 1)) {
        issues.push(`${name} 只能包含 JSON 值（字符串/数字/布尔/null/数组/对象）`);
        return undefined;
    }
    const bytes = JSON.stringify(raw).length;
    if (bytes > LIMITS.objectBytes) {
        issues.push(`${name} 序列化后 ${bytes} 字符，超过 ${LIMITS.objectBytes}`);
        return undefined;
    }
    return raw;
}
function heuristicsField(raw, name, issues) {
    if (raw === undefined || raw === null)
        return [];
    if (!Array.isArray(raw)) {
        issues.push(`${name} 必须是数组`);
        return [];
    }
    const result = [];
    for (const [index, entry] of raw.entries()) {
        const where = `${name}[${index}]`;
        if (!isPlainObject(entry)) {
            issues.push(`${where} 必须是对象`);
            continue;
        }
        const situation = textField(entry['situation'], `${where}.situation`, 400, issues, true);
        const choice = textField(entry['choice'], `${where}.choice`, 400, issues, true);
        const rationale = textField(entry['rationale'], `${where}.rationale`, 600, issues);
        if (situation === undefined || choice === undefined)
            continue;
        result.push({ situation, choice, ...(rationale === undefined ? {} : { rationale }) });
    }
    if (result.length > LIMITS.heuristics) {
        issues.push(`${name} 最多 ${LIMITS.heuristics} 条（当前 ${result.length}）`);
        result.length = LIMITS.heuristics;
    }
    return result;
}
const FOCUS_OBSERVATION = {
    light_direction: 'light_direction',
    color_palette: 'key_colors',
    composition: 'composition',
    perspective: 'perspective',
    setting: 'setting',
    material: 'material',
    texture: 'texture',
    atmosphere: 'atmosphere',
    subject: 'subject',
    props: 'props',
    note: 'note',
};
export function observationForFocus(photo, focus) {
    return photo.observations[FOCUS_OBSERVATION[focus]];
}
/** 校验一张照片记录（photo_append 与落盘读取共用）。 */
export function validatePhotoInput(raw) {
    if (!isPlainObject(raw))
        return { ok: false, issues: ['photo 必须是对象'] };
    const issues = [];
    const photoId = textField(raw['photo_id'], 'photo_id', 40, issues, true);
    const path = textField(raw['path'], 'path', 500, issues, true);
    if (path !== undefined && !/^([A-Za-z]:[\\/]|\\\\|\/)/.test(path)) {
        issues.push('path 必须是绝对路径');
    }
    const focusRaw = raw['focus'];
    const focus = [];
    if (!Array.isArray(focusRaw) || focusRaw.length === 0) {
        issues.push('focus 必须是非空数组');
    }
    else {
        for (const entry of focusRaw) {
            if (typeof entry !== 'string' || !PHOTO_FOCUS.includes(entry)) {
                issues.push(`focus 非法：${String(entry)}`);
                continue;
            }
            const typed = entry;
            if (!focus.includes(typed))
                focus.push(typed);
        }
    }
    const observations = {};
    const obsRaw = raw['observations'];
    if (!isPlainObject(obsRaw)) {
        issues.push('observations 必须是对象');
    }
    else {
        for (const field of PHOTO_FOCUS) {
            const key = FOCUS_OBSERVATION[field];
            const value = obsRaw[key];
            if (focus.includes(field)) {
                if (field === 'color_palette') {
                    const colors = stringList(value, `observations.${key}`, issues, 12, 16);
                    if (colors.length === 0) {
                        issues.push('focus 含 color_palette 时 observations.key_colors 不能为空');
                    }
                    else {
                        for (const color of colors) {
                            if (!/^#[0-9A-Fa-f]{6}$/.test(color))
                                issues.push(`key_colors 非法 hex：${color}`);
                        }
                        observations.key_colors = colors;
                    }
                }
                else {
                    const text = textField(value, `observations.${key}`, 600, issues, true);
                    if (text !== undefined)
                        observations[key] = text;
                }
            }
            else if (value !== undefined && value !== null) {
                issues.push(`focus 未含 ${field}，observations.${key} 必须为 null 或省略`);
            }
        }
    }
    const level = raw['evidence_level'];
    if (level !== undefined && level !== 'observed')
        issues.push('evidence_level 只能为 observed');
    const pathVerified = typeof raw['path_verified'] === 'boolean' ? raw['path_verified'] : undefined;
    if (raw['path_verified'] !== undefined && pathVerified === undefined)
        issues.push('path_verified 必须是布尔值');
    const roleRaw = raw['role'];
    let role;
    if (roleRaw !== undefined && roleRaw !== null) {
        if (typeof roleRaw !== 'string' || !PHOTO_ROLES.includes(roleRaw)) {
            issues.push(`role 非法：${String(roleRaw)}（允许：${PHOTO_ROLES.join(', ')}）`);
        }
        else {
            role = ROLE_ALIAS[roleRaw] ?? roleRaw;
        }
    }
    if (issues.length > 0)
        return { ok: false, issues };
    if (photoId === undefined || path === undefined)
        return { ok: false, issues: ['photo_id / path 不能为空'] };
    return {
        ok: true,
        value: {
            photo_id: photoId,
            path,
            focus,
            observations,
            evidence_level: 'observed',
            ...(pathVerified === undefined ? {} : { path_verified: pathVerified }),
            ...(role === undefined ? {} : { role }),
        },
    };
}
/** 校验一张**完整**包（落盘读取与 replace 写入都用它）。 */
export function parseStoredPack(raw) {
    if (!isPlainObject(raw))
        return null;
    const issues = [];
    const metaRaw = raw['meta'];
    const dnaRaw = raw['expression_dna'];
    if (!isPlainObject(metaRaw) || !isPlainObject(dnaRaw))
        return null;
    const director = textField(metaRaw['director'], 'meta.director', LIMITS.director, issues, true);
    const version = textField(metaRaw['version'], 'meta.version', 40, issues, true);
    const createdAt = textField(metaRaw['created_at'], 'meta.created_at', 80, issues, true);
    const anchorWorks = stringList(metaRaw['anchor_works'], 'meta.anchor_works', issues, 60);
    const sourcesRaw = metaRaw['sources'];
    const sources = { works: [], interviews: [], critics: [], collaborators: [], technical_records: [], timeline: [] };
    if (sourcesRaw !== undefined && sourcesRaw !== null) {
        if (!isPlainObject(sourcesRaw)) {
            issues.push('meta.sources 必须是对象');
        }
        else {
            for (const kind of SOURCE_KINDS) {
                sources[kind] = stringList(sourcesRaw[kind], `meta.sources.${kind}`, issues);
            }
        }
    }
    const colorPalette = stringList(dnaRaw['color_palette'], 'expression_dna.color_palette', issues, LIMITS.palette, 80);
    const lensGrammar = jsonObject(dnaRaw['lens_grammar'], 'expression_dna.lens_grammar', issues) ?? {};
    const editingRhythm = jsonObject(dnaRaw['editing_rhythm'], 'expression_dna.editing_rhythm', issues) ?? {};
    const soundDesign = jsonObject(dnaRaw['sound_design'], 'expression_dna.sound_design', issues) ?? {};
    const mentalModels = stringList(raw['mental_models'], 'mental_models', issues);
    const heuristics = heuristicsField(raw['decision_heuristics'], 'decision_heuristics', issues);
    const antiPatterns = stringList(raw['anti_patterns'], 'anti_patterns', issues);
    const honestLimits = stringList(raw['honest_limits'], 'honest_limits', issues);
    const photosRaw = raw['photos'];
    let photos;
    if (photosRaw !== undefined && photosRaw !== null) {
        if (!Array.isArray(photosRaw)) {
            issues.push('photos 必须是数组');
        }
        else {
            const list = [];
            const seen = new Set();
            for (const [index, entry] of photosRaw.entries()) {
                const result = validatePhotoInput(entry);
                if (!result.ok) {
                    issues.push(...result.issues.map(issue => `photos[${index}].${issue}`));
                    continue;
                }
                if (seen.has(result.value.photo_id)) {
                    issues.push(`photos[${index}].photo_id 重复：${result.value.photo_id}`);
                    continue;
                }
                seen.add(result.value.photo_id);
                list.push(result.value);
            }
            photos = list;
        }
    }
    if (issues.length > 0)
        return null;
    if (director === undefined || version === undefined || createdAt === undefined)
        return null;
    return {
        meta: {
            director,
            anchor_works: anchorWorks,
            sources,
            version,
            created_at: createdAt,
        },
        expression_dna: {
            color_palette: colorPalette,
            lens_grammar: lensGrammar,
            editing_rhythm: editingRhythm,
            sound_design: soundDesign,
        },
        mental_models: mentalModels,
        decision_heuristics: heuristics,
        anti_patterns: antiPatterns,
        honest_limits: honestLimits,
        ...(photos === undefined ? {} : { photos }),
    };
}
/** 校验工具提交的增量输入；未知字段直接报错，避免拼写错误被静默吞掉。 */
export function normalizeSaveInput(raw) {
    if (!isPlainObject(raw))
        return { ok: false, issues: ['参数必须是对象'] };
    const issues = [];
    const known = new Set([
        'director',
        'anchor_works',
        'sources',
        'expression_dna',
        'mental_models',
        'decision_heuristics',
        'anti_patterns',
        'honest_limits',
        'version',
    ]);
    for (const key of Object.keys(raw)) {
        if (!known.has(key))
            issues.push(`未知字段：${key}（允许：${[...known].join(', ')}）`);
    }
    const director = textField(raw['director'], 'director', LIMITS.director, issues, true);
    const anchorWorks = raw['anchor_works'] === undefined ? undefined : stringList(raw['anchor_works'], 'anchor_works', issues, 60);
    const mentalModels = raw['mental_models'] === undefined ? undefined : stringList(raw['mental_models'], 'mental_models', issues);
    const antiPatterns = raw['anti_patterns'] === undefined ? undefined : stringList(raw['anti_patterns'], 'anti_patterns', issues);
    const honestLimits = raw['honest_limits'] === undefined ? undefined : stringList(raw['honest_limits'], 'honest_limits', issues);
    const heuristics = raw['decision_heuristics'] === undefined
        ? undefined
        : heuristicsField(raw['decision_heuristics'], 'decision_heuristics', issues);
    let version;
    if (raw['version'] !== undefined && raw['version'] !== null) {
        const candidate = textField(raw['version'], 'version', 40, issues);
        if (candidate !== undefined) {
            if (!/^\d+\.\d+\.\d+$/.test(candidate))
                issues.push('version 必须形如 0.1.0');
            else
                version = candidate;
        }
    }
    let sources;
    if (raw['sources'] !== undefined && raw['sources'] !== null) {
        if (!isPlainObject(raw['sources'])) {
            issues.push('sources 必须是对象');
        }
        else {
            sources = {};
            for (const key of Object.keys(raw['sources'])) {
                if (!SOURCE_KINDS.includes(key)) {
                    issues.push(`sources 未知分类：${key}（允许：${SOURCE_KINDS.join(', ')}）`);
                    continue;
                }
                const list = stringList(raw['sources'][key], `sources.${key}`, issues);
                sources[key] = list;
            }
        }
    }
    let expressionDna;
    if (raw['expression_dna'] !== undefined && raw['expression_dna'] !== null) {
        if (!isPlainObject(raw['expression_dna'])) {
            issues.push('expression_dna 必须是对象');
        }
        else {
            expressionDna = {};
            for (const key of Object.keys(raw['expression_dna'])) {
                if (!DNA_KEYS.includes(key)) {
                    issues.push(`expression_dna 未知字段：${key}（允许：${DNA_KEYS.join(', ')}）`);
                    continue;
                }
            }
            const dnaRaw = raw['expression_dna'];
            if (dnaRaw['color_palette'] !== undefined) {
                expressionDna.color_palette = stringList(dnaRaw['color_palette'], 'expression_dna.color_palette', issues, LIMITS.palette, 80);
            }
            const grammar = jsonObject(dnaRaw['lens_grammar'], 'expression_dna.lens_grammar', issues);
            if (grammar !== undefined)
                expressionDna.lens_grammar = grammar;
            const rhythm = jsonObject(dnaRaw['editing_rhythm'], 'expression_dna.editing_rhythm', issues);
            if (rhythm !== undefined)
                expressionDna.editing_rhythm = rhythm;
            const sound = jsonObject(dnaRaw['sound_design'], 'expression_dna.sound_design', issues);
            if (sound !== undefined)
                expressionDna.sound_design = sound;
        }
    }
    if (issues.length > 0)
        return { ok: false, issues };
    if (director === undefined)
        return { ok: false, issues: ['director 不能为空'] };
    return {
        ok: true,
        value: {
            director,
            ...(anchorWorks === undefined ? {} : { anchor_works: anchorWorks }),
            ...(sources === undefined ? {} : { sources }),
            ...(expressionDna === undefined ? {} : { expression_dna: expressionDna }),
            ...(mentalModels === undefined ? {} : { mental_models: mentalModels }),
            ...(heuristics === undefined ? {} : { decision_heuristics: heuristics }),
            ...(antiPatterns === undefined ? {} : { anti_patterns: antiPatterns }),
            ...(honestLimits === undefined ? {} : { honest_limits: honestLimits }),
            ...(version === undefined ? {} : { version }),
        },
    };
}
function union(base, extra) {
    const result = [...base];
    for (const item of extra)
        if (!result.includes(item))
            result.push(item);
    return result;
}
function mergeHeuristics(base, extra) {
    const map = new Map();
    const keyOf = (item) => `${item.situation}\u0000${item.choice}`;
    for (const item of base)
        map.set(keyOf(item), item);
    for (const item of extra)
        map.set(keyOf(item), item);
    return [...map.values()];
}
export function bumpPatchVersion(version) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
    if (match === null)
        return version;
    const major = Number(match[1]);
    const minor = Number(match[2]);
    const patch = Number(match[3]);
    return `${major}.${minor}.${patch + 1}`;
}
/**
 * 把增量输入应用到一张包上。base 为 undefined 时新建；
 * 合并规则：数组去重追加、对象浅合并。
 */
export function applySave(input, base, now) {
    const current = base ?? emptyPack(input.director, []);
    const director = base?.meta.director ?? input.director;
    const version = input.version ?? (base === undefined ? '0.1.0' : bumpPatchVersion(base.meta.version));
    const created_at = base?.meta.created_at ?? now.toISOString();
    const anchorWorks = union(current.meta.anchor_works, input.anchor_works ?? []);
    const sources = {
        works: union(current.meta.sources.works, input.sources?.works ?? []),
        interviews: union(current.meta.sources.interviews, input.sources?.interviews ?? []),
        critics: union(current.meta.sources.critics, input.sources?.critics ?? []),
        collaborators: union(current.meta.sources.collaborators, input.sources?.collaborators ?? []),
        technical_records: union(current.meta.sources.technical_records, input.sources?.technical_records ?? []),
        timeline: union(current.meta.sources.timeline, input.sources?.timeline ?? []),
    };
    const dnaIn = input.expression_dna;
    return {
        meta: {
            director,
            anchor_works: anchorWorks,
            sources,
            version,
            created_at,
        },
        expression_dna: {
            color_palette: union(current.expression_dna.color_palette, dnaIn?.color_palette ?? []),
            lens_grammar: { ...current.expression_dna.lens_grammar, ...(dnaIn?.lens_grammar ?? {}) },
            editing_rhythm: { ...current.expression_dna.editing_rhythm, ...(dnaIn?.editing_rhythm ?? {}) },
            sound_design: { ...current.expression_dna.sound_design, ...(dnaIn?.sound_design ?? {}) },
        },
        mental_models: union(current.mental_models, input.mental_models ?? []),
        decision_heuristics: mergeHeuristics(current.decision_heuristics, input.decision_heuristics ?? []),
        anti_patterns: union(current.anti_patterns, input.anti_patterns ?? []),
        honest_limits: union(current.honest_limits, input.honest_limits ?? []),
        ...(current.photos === undefined ? {} : { photos: current.photos }),
    };
}
export function packStats(pack) {
    const sources = Object.values(pack.meta.sources).reduce((total, list) => total + list.length, 0);
    return {
        anchor_works: pack.meta.anchor_works.length,
        mental_models: pack.mental_models.length,
        decision_heuristics: pack.decision_heuristics.length,
        anti_patterns: pack.anti_patterns.length,
        honest_limits: pack.honest_limits.length,
        sources,
    };
}
/** 全文搜索：导演、作品、来源、照片观察、心智模型……整包序列化后分词匹配。 */
export function matchesPack(pack, query) {
    const tokens = query.toLowerCase().split(/\s+/).filter(token => token.length > 0);
    if (tokens.length === 0)
        return true;
    const haystack = JSON.stringify(pack).toLowerCase();
    return tokens.every(token => haystack.includes(token));
}
