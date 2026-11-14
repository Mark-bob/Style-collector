/**
 * style-collector — 照片参考包收集器（纯 Host 插件，无 Client 半区）。
 *
 * 工作流：`director_pack_init` 建包 → `photo_append` 逐张追加到 photos.jsonl →
 * `director_pack_validate` / `photo_validate` 检查完整性 → `director_pack_export`
 * 把照片合并回 pack.json 并生成 guide → `director_pack_get` 读取。
 *
 * 包目录：`$DSH_HOME/director-style-packs/<pack_id>/`，内含 pack.json 与
 * photos.jsonl；pack_id 由导演名 slugify 得到（保留中文）。
 */
import { defineTool } from '@deepseek-ai/dsh-tools';
import z from '@deepseek-ai/schemastery';
import { access, readFile, readdir, rmdir, stat, unlink, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { appendPhoto, configureStore, createPack, packDir, packExists, packFile, packRoot, photosFile, readPack, slugify, writePack, } from './store.js';
import { renderGuide } from './guide.js';
import { PHOTO_FOCUS, PHOTO_ROLES, observationForFocus, validatePhotoInput } from './schema.js';
export const name = '@local/style-collector';
export const inject = ['tools'];
/** 插件配置：数据根目录的显式覆盖。 */
export const Config = z.object({
    dsh_home: z
        .string()
        .default('')
        .description('导演包数据根目录的 DSH_HOME；留空时依次使用环境变量 DSH_HOME、~/.dsh'),
});
function text(content) {
    return [{ type: 'text', text: content }];
}
/** 把包对象转成 lossless JSON 值（工具输出的 canonical value）。 */
function asJson(value) {
    return JSON.parse(JSON.stringify(value));
}
/** 文件是否存在（用于 guide 覆盖提示）。 */
async function fileExists(path) {
    try {
        await access(path);
        return true;
    }
    catch {
        return false;
    }
}
/** 读取 photos.jsonl；坏行跳过。 */
async function readPhotoLines(packId) {
    const raw = await readFile(photosFile(packId), 'utf8');
    const photos = [];
    for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.length === 0)
            continue;
        try {
            const parsed = JSON.parse(trimmed);
            if (parsed !== null && typeof parsed === 'object' && typeof parsed.photo_id === 'string')
                photos.push(parsed);
        }
        catch {
            // 坏行跳过
        }
    }
    return photos;
}
/** pack.json 里的照片 + JSONL 新追加的照片：按 photo_id 后者覆盖。 */
function mergePhotos(base, extra) {
    const map = new Map();
    for (const photo of base)
        map.set(photo.photo_id, photo);
    for (const photo of extra)
        map.set(photo.photo_id, photo);
    return [...map.values()];
}
/** 照片校验：photos 非空、每条 focus 有 observation、anti_patterns / honest_limits 非空。 */
async function validatePackState(packId) {
    const pack = await readPack(packId);
    if (!pack)
        return { error: 'pack_not_found', pack_id: packId };
    let photos = pack.photos ?? [];
    try {
        photos = mergePhotos(photos, await readPhotoLines(packId));
    }
    catch {
        // photos.jsonl 可能还没创建
    }
    const missing = [];
    if (photos.length === 0)
        missing.push('photos');
    for (const photo of photos) {
        for (const field of photo.focus) {
            const value = observationForFocus(photo, field);
            const empty = value === undefined || (Array.isArray(value) ? value.length === 0 : value.trim().length === 0);
            if (empty)
                missing.push(`${photo.photo_id}.${field}`);
        }
    }
    if (pack.anti_patterns.length === 0)
        missing.push('anti_patterns');
    if (pack.honest_limits.length === 0)
        missing.push('honest_limits');
    return { pack_id: packId, photo_count: photos.length, missing, valid: missing.length === 0 };
}
function pathKey(path) {
    const resolved = resolve(path);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}
async function walkFiles(root, skip = new Set()) {
    const out = [];
    let entries;
    try {
        entries = await readdir(root, { withFileTypes: true });
    }
    catch {
        return out;
    }
    for (const entry of entries) {
        const full = join(root, entry.name);
        if (entry.isDirectory()) {
            if (skip.has(entry.name))
                continue;
            out.push(...(await walkFiles(full, skip)));
        }
        else if (entry.isFile())
            out.push(full);
    }
    return out;
}
async function collectReferencedUploads() {
    const refs = new Set();
    const add = (value) => {
        if (typeof value === 'string' && isAbsolute(value))
            refs.add(pathKey(value));
    };
    for (const file of await walkFiles(packRoot(), new Set(['_ui-uploads', 'node_modules', '.git']))) {
        if (file.split(/[\\/]/).includes('_ui-uploads'))
            continue;
        if (file.endsWith('photos.jsonl')) {
            const raw = await readFile(file, 'utf8').catch(() => '');
            for (const line of raw.split('\n')) {
                const trimmed = line.trim();
                if (trimmed.length === 0)
                    continue;
                try {
                    const record = JSON.parse(trimmed);
                    add(record.path);
                    add(record.source_path);
                }
                catch {
                    // 坏行跳过
                }
            }
        }
        else if (file.endsWith('pack.json')) {
            try {
                const pack = JSON.parse(await readFile(file, 'utf8'));
                for (const photo of pack.photos ?? []) {
                    add(photo.path);
                    add(photo.source_path);
                }
            }
            catch {
                // 非包 JSON 跳过
            }
        }
    }
    return refs;
}
async function removeEmptyDirs(root) {
    const dirs = [];
    const collect = async (dir) => {
        let entries;
        try {
            entries = await readdir(dir, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const entry of entries) {
            if (entry.isDirectory())
                await collect(join(dir, entry.name));
        }
        if (dir !== root)
            dirs.push(dir);
    };
    await collect(root);
    dirs.sort((left, right) => right.length - left.length);
    for (const dir of dirs) {
        try {
            await rmdir(dir);
        }
        catch {
            // 非空目录保留
        }
    }
}
/** 扫描 _ui-uploads，只删除没有被任何 pack 引用的文件。默认 dry-run。 */
export async function cleanupUploads(confirm) {
    const root = join(packRoot(), '_ui-uploads');
    const files = await walkFiles(root);
    const referenced = await collectReferencedUploads();
    const unreferenced = [];
    let bytes = 0;
    for (const file of files) {
        if (referenced.has(pathKey(file)))
            continue;
        unreferenced.push(file);
        try {
            bytes += (await stat(file)).size;
        }
        catch {
            // 文件消失时忽略大小
        }
    }
    const deleted = [];
    if (confirm) {
        for (const file of unreferenced) {
            try {
                await unlink(file);
                deleted.push(file);
            }
            catch {
                // 已删除或占用时跳过
            }
        }
        if (deleted.length > 0)
            await removeEmptyDirs(root);
    }
    return {
        dry_run: !confirm,
        upload_root: root,
        scanned: files.length,
        referenced: files.length - unreferenced.length,
        unreferenced_count: unreferenced.length,
        bytes,
        unreferenced: unreferenced.slice(0, 20),
        deleted,
    };
}
export function apply(ctx, config = {}) {
    configureStore({ dshHome: config.dsh_home });
    // 1. 初始化导演包
    ctx.tools.register(defineTool({
        name: 'director_pack_init',
        description: 'Initialize a director style pack. Creates a local pack directory under $DSH_HOME/director-style-packs/<pack_id>/. Returns pack_id for use in other tools.',
        parameters: {
            director: { type: 'string', required: true, description: 'Director name, e.g. "Wong Kar-wai".' },
            anchor_works: {
                type: 'array',
                items: { type: 'string' },
                required: true,
                description: 'Anchor works used for fine-grained breakdown, e.g. ["In the Mood for Love"].',
            },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const packId = String(value['pack_id'] ?? '');
                if (value['status'] === 'invalid_director') {
                    return text('无法从导演名生成 pack_id：至少需要一个字母或汉字。');
                }
                const path = String(value['path'] ?? '');
                return value['status'] === 'already_exists'
                    ? text(`导演包已存在：${packId}（${path}）`)
                    : text(`已初始化导演包：${packId} → ${path}`);
            },
        },
        async execute(args) {
            const packId = slugify(args.director);
            if (packId.length === 0)
                return { pack_id: '', status: 'invalid_director' };
            const exists = await packExists(packId);
            if (exists) {
                return { pack_id: packId, status: 'already_exists', path: packDir(packId) };
            }
            await createPack(packId, args.director, args.anchor_works);
            return { pack_id: packId, status: 'initialized', path: packDir(packId) };
        },
    }));
    // 3. 校验照片参考包
    ctx.tools.register(defineTool({
        name: 'director_pack_validate',
        description: 'Validate a photo reference pack: photos non-empty, every focus field has its observation, and anti_patterns / honest_limits are non-empty. Returns valid/missing lists; does not throw on incompleteness.',
        parameters: {
            pack_id: { type: 'string', required: true },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                if (value['error'] === 'pack_not_found') {
                    return text(`没有找到导演包：${String(value['pack_id'])}。`);
                }
                const missing = Array.isArray(value['missing']) ? value['missing'].map(String).join(', ') : '';
                const head = value['valid'] === true ? '校验通过' : '校验未通过';
                return text(`${head}：${String(value['pack_id'])}（照片 ${String(value['photo_count'])}）` +
                    (missing.length > 0 ? `；缺失：${missing}` : '；无缺失项') +
                    '。');
            },
        },
        async execute(args) {
            return (await validatePackState(args.pack_id));
        },
    }));
    // 3.5 照片参考包：追加 / 列表 / 校验
    ctx.tools.register(defineTool({
        name: 'photo_append',
        description: 'Append one photo reference record to a director pack. Writes to photos.jsonl. focus lists the fields to observe; observations must provide exactly those fields (unlisted fields must be null or omitted). One call per photo.',
        parameters: {
            pack_id: { type: 'string', required: true },
            photo_id: { type: 'string', required: true, description: 'e.g. "P01".' },
            path: { type: 'string', required: true, description: '照片绝对路径。' },
            role: {
                type: 'string',
                enum: [...PHOTO_ROLES],
                description: '用途：style（画风）/ lighting（灯光）/ color（色彩）/ composition（构图）/ camera（视角）/ setting（场景）/ material（材质）/ texture（质感）/ atmosphere（氛围）/ subject（人物）/ props（道具）/ note（备注）；省略则不标注。',
            },
            subject_id: {
                type: 'string',
                description: '同一主体的编号；多张图填相同值时 guide §4 人物/主体聚合。可选。',
            },
            focus: {
                type: 'array',
                items: { type: 'string', enum: [...PHOTO_FOCUS] },
                required: true,
                description: '关注要素：light_direction / color_palette / composition / perspective / setting / material / texture / atmosphere / subject / props / note。',
            },
            observations: {
                type: 'object',
                additionalProperties: true,
                required: true,
                description: 'focus 对应字段；未列出的字段必须为 null 或省略。',
                properties: {
                    light_direction: { type: 'string' },
                    key_colors: { type: 'array', items: { type: 'string' } },
                    composition: { type: 'string' },
                    perspective: { type: 'string' },
                    setting: { type: 'string' },
                    material: { type: 'string' },
                    texture: { type: 'string' },
                    atmosphere: { type: 'string' },
                    subject: { type: 'string' },
                    props: { type: 'string' },
                    note: { type: 'string' },
                },
            },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                if (value['error'] === 'pack_not_found')
                    return text(`没有找到导演包：${String(value['pack_id'])}。`);
                if (value['error'] === 'invalid_photo') {
                    const issues = Array.isArray(value['issues']) ? value['issues'].map(String) : [];
                    return text(`照片记录不合法：\n- ${issues.join('\n- ')}`);
                }
                return text(`已追加照片 ${String(value['photo_id'])} 到 ${String(value['pack_id'])}，photos.jsonl 现有 ${String(value['photo_count'])} 条。` +
                    (value['path_verified'] === true ? ' 路径已验证。' : ' 路径未验证（文件不存在）。'));
            },
        },
        async execute(args) {
            const verified = await fileExists(args.path);
            const validated = validatePhotoInput({
                photo_id: args.photo_id,
                path: args.path,
                focus: args.focus,
                observations: args.observations,
                path_verified: verified,
                role: args.role,
                subject_id: args.subject_id,
            });
            if (!validated.ok) {
                return { appended: false, error: 'invalid_photo', issues: validated.issues, pack_id: args.pack_id };
            }
            if (!(await packExists(args.pack_id))) {
                return { appended: false, error: 'pack_not_found', pack_id: args.pack_id };
            }
            const count = await appendPhoto(args.pack_id, validated.value);
            return {
                appended: true,
                pack_id: args.pack_id,
                photo_id: validated.value.photo_id,
                focus: validated.value.focus,
                path_verified: validated.value.path_verified ?? false,
                photo_count: count,
            };
        },
    }));
    ctx.tools.register(defineTool({
        name: 'photo_list',
        description: 'List photo reference records of a director pack (photo_id / focus / has_note).',
        parameters: {
            pack_id: { type: 'string', required: true },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                if (value['error'] === 'pack_not_found')
                    return text(`没有找到导演包：${String(value['pack_id'])}。`);
                const total = Number(value['total'] ?? 0);
                const lines = [`照片共 ${total} 条：`];
                const photos = Array.isArray(value['photos']) ? value['photos'] : [];
                for (const entry of photos) {
                    const photo = entry;
                    const focus = Array.isArray(photo['focus']) ? photo['focus'].map(String).join(' / ') : '';
                    lines.push(`- ${String(photo['photo_id'])}：${focus}｜note：${photo['has_note'] === true ? '有' : '无'}`);
                }
                return text(lines.join('\n'));
            },
        },
        async execute(args) {
            const pack = await readPack(args.pack_id);
            if (!pack)
                return { error: 'pack_not_found', pack_id: args.pack_id, total: 0, photos: [] };
            let photos = pack.photos ?? [];
            try {
                photos = mergePhotos(photos, await readPhotoLines(args.pack_id));
            }
            catch {
                // photos.jsonl 不存在时只用 pack.json 里的照片
            }
            return {
                pack_id: args.pack_id,
                total: photos.length,
                photos: photos.map(photo => ({
                    photo_id: photo.photo_id,
                    focus: photo.focus,
                    has_note: photo.observations.note !== undefined,
                })),
            };
        },
    }));
    ctx.tools.register(defineTool({
        name: 'photo_validate',
        description: 'Alias of director_pack_validate for photo packs: validates photos (every focus field) plus anti_patterns / honest_limits; mental_models is optional for photo-only packs.',
        parameters: {
            pack_id: { type: 'string', required: true },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                if (value['error'] === 'pack_not_found')
                    return text(`没有找到导演包：${String(value['pack_id'])}。`);
                const missing = Array.isArray(value['missing']) ? value['missing'].map(String) : [];
                const head = value['valid'] === true ? '照片校验通过' : '照片校验未通过';
                return text(`${head}：${String(value['pack_id'])}，照片 ${String(value['photo_count'])} 条` +
                    (missing.length > 0 ? `；缺失：${missing.join(', ')}` : '；无缺失项') +
                    '。');
            },
        },
        async execute(args) {
            return (await validatePackState(args.pack_id));
        },
    }));
    // 4. 导出导演包（pack.json 与/或 guide-*.md）
    ctx.tools.register(defineTool({
        name: 'director_pack_export',
        description: 'Export a photo reference pack. format="pack" writes pack.json only; format="guide" writes guide-<guide_name|pack_id>.md only; format="both" (default) writes both. Merges photos.jsonl into photos. Run director_pack_validate / photo_validate first.',
        parameters: {
            pack_id: { type: 'string', required: true },
            format: {
                type: 'string',
                enum: ['pack', 'guide', 'both'],
                description: 'pack = 仅 pack.json；guide = 仅 guide md；both = 两者都写（默认）。',
            },
            guide_name: {
                type: 'string',
                description: 'guide 文件名（英文、不含扩展名）；省略时用 pack_id。严禁从作品名/年份推断。',
            },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                if (value['error'] === 'pack_not_found') {
                    return text(`没有找到导演包：${String(value['pack_id'])}。`);
                }
                const lines = [`已导出 ${String(value['pack_id'])}（format=${String(value['format'])}）`];
                if (typeof value['pack_path'] === 'string')
                    lines.push(`pack：${value['pack_path']}`);
                if (typeof value['guide_path'] === 'string')
                    lines.push(`guide：${value['guide_path']}`);
                const warnings = Array.isArray(value['warnings']) ? value['warnings'].map(String) : [];
                if (warnings.length > 0)
                    lines.push(`warnings：${warnings.join('；')}`);
                const info = Array.isArray(value['info']) ? value['info'].map(String) : [];
                if (info.length > 0)
                    lines.push(`info：${info.join('；')}`);
                return text(lines.join('\n'));
            },
        },
        async execute(args) {
            const format = args.format ?? 'both';
            const pack = await readPack(args.pack_id);
            if (!pack) {
                return { exported: false, error: 'pack_not_found', pack_id: args.pack_id };
            }
            try {
                pack.photos = mergePhotos(pack.photos ?? [], await readPhotoLines(args.pack_id));
            }
            catch {
                // photos.jsonl 不存在时保留 pack.json 里已有的照片
            }
            const warnings = [];
            const info = [];
            const wantPack = format === 'pack' || format === 'both';
            const wantGuide = format === 'guide' || format === 'both';
            let packPath;
            let guidePath;
            if (wantPack) {
                await writePack(args.pack_id, pack);
                packPath = packFile(args.pack_id);
            }
            if (wantGuide) {
                const requested = args.guide_name?.trim();
                const nameIsValid = requested === undefined || requested.length === 0 || /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(requested);
                if (!nameIsValid) {
                    info.push(`guide_name 非法（仅允许字母/数字/._-）：${requested ?? ''}，未生成 guide`);
                }
                else {
                    const name = requested === undefined || requested.length === 0 ? args.pack_id : requested;
                    try {
                        const guide = renderGuide(pack, args.pack_id);
                        warnings.push(...guide.warnings);
                        const target = join(packDir(args.pack_id), `guide-${name}.md`);
                        const existed = await fileExists(target);
                        await writeFile(target, guide.markdown, 'utf8');
                        guidePath = target;
                        if (existed)
                            info.push('guide 已覆盖');
                    }
                    catch (error) {
                        info.push(`guide 生成失败：${error.message}`);
                    }
                }
            }
            const result = {
                exported: wantPack || guidePath !== undefined,
                pack_id: args.pack_id,
                format,
                warnings,
            };
            if (packPath !== undefined)
                result.pack_path = packPath;
            if (guidePath !== undefined)
                result.guide_path = guidePath;
            if (info.length > 0)
                result.info = info;
            return result;
        },
    }));
    // 5. 读取当前导演包
    ctx.tools.register(defineTool({
        name: 'director_pack_get',
        description: 'Read a director pack from disk. Returns the pack JSON, or null if not found.',
        parameters: {
            pack_id: { type: 'string', required: true },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const pack = value.pack;
                if (pack === undefined || pack === null) {
                    return text(`没有找到导演包：${String(value['pack_id'])}。`);
                }
                const sources = Object.values(pack.meta.sources).reduce((total, list) => total + list.length, 0);
                const photos = pack.photos?.length ?? 0;
                return text([
                    `【${pack.meta.director}】v${pack.meta.version} · pack_id: ${String(value['pack_id'])}`,
                    `锚点作品（${pack.meta.anchor_works.length}）：${pack.meta.anchor_works.join('、') || '（未填）'}`,
                    `照片 ${photos} · 心智模型 ${pack.mental_models.length} · 启发式 ${pack.decision_heuristics.length} · 反模式 ${pack.anti_patterns.length} · 边界 ${pack.honest_limits.length} · 来源 ${sources} 条`,
                    `创建：${pack.meta.created_at}`,
                ].join('\n'));
            },
        },
        async execute(args) {
            const pack = await readPack(args.pack_id);
            return { pack_id: args.pack_id, pack: pack === null ? null : asJson(pack) };
        },
    }));
    // 6. 清理未引用的上传原图（默认 dry-run）
    ctx.tools.register(defineTool({
        name: 'cleanup_uploads',
        description: 'Scan _ui-uploads for files not referenced by any pack. Dry-run by default; pass confirm=true to delete. Referenced files and archived packs are never removed.',
        parameters: {
            confirm: { type: 'boolean', description: 'true 才真删；默认只报告。' },
        },
        output: {
            schema: { type: 'object', additionalProperties: true },
            render: (_args, value) => {
                const scanned = String(value['scanned'] ?? 0);
                const referenced = String(value['referenced'] ?? 0);
                const count = String(value['unreferenced_count'] ?? 0);
                const bytes = String(value['bytes'] ?? 0);
                if (value['dry_run'] === true) {
                    return text(`cleanup_uploads 干跑：扫描 ${scanned}，被引用 ${referenced}，未引用 ${count}（${bytes} 字节）。传 confirm=true 才删除。`);
                }
                return text(`cleanup_uploads 已删除 ${String(Array.isArray(value['deleted']) ? value['deleted'].length : 0)} 个未引用文件。`);
            },
        },
        async execute(args) {
            return (await cleanupUploads(args.confirm === true));
        },
    }));
}
