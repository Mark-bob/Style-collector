/**
 * 导演包持久化：一个包一个目录 —— `$DSH_HOME/director-style-packs/<packId>/`
 *
 *   pack.json    包主体（meta / expression_dna 的形式层 / mental_models / …）
 *   shots.jsonl  镜头样本，一行一条 ShotRecord，只追加
 *
 * 写入流程是显式的：`director_pack_init` 建包，`shot_append` 往 JSONL 追加，
 * `director_pack_export` 再把 JSONL 合并回 pack.json。读取时 `readPack` 会做
 * 结构校验，坏文件返回 null 而不是把脏 JSON 抛给工具层。
 */
import { access, appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseStoredPack } from './schema.js';
import { emptyPack } from './schema.js';
export function dshHome() {
    const fromEnv = process.env['DSH_HOME'];
    if (typeof fromEnv === 'string' && fromEnv.trim().length > 0)
        return fromEnv.trim();
    return join(homedir(), '.dsh');
}
/** 显式配置的 DSH_HOME（优先级最高）；由插件 Config 在 apply 时注入。 */
let configuredHome;
export function configureStore(options = {}) {
    const candidate = options.dshHome?.trim();
    configuredHome = candidate !== undefined && candidate.length > 0 ? candidate : undefined;
}
/** DSH_HOME 解析优先级：显式配置 > `$DSH_HOME` 环境变量 > `~/.dsh`。 */
export function resolveDshHome() {
    return configuredHome ?? dshHome();
}
export function packRoot() {
    return join(resolveDshHome(), 'director-style-packs');
}
export function slugify(name) {
    return name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
export function packDir(packId) {
    return join(packRoot(), packId);
}
export function packFile(packId) {
    return join(packDir(packId), 'pack.json');
}
export function photosFile(packId) {
    return join(packDir(packId), 'photos.jsonl');
}
export async function ensurePackDir(packId) {
    await mkdir(packDir(packId), { recursive: true });
}
export async function packExists(packId) {
    try {
        await access(packFile(packId));
        return true;
    }
    catch {
        return false;
    }
}
export async function writePack(packId, pack) {
    await ensurePackDir(packId);
    await writeFile(packFile(packId), JSON.stringify(pack, null, 2), 'utf8');
}
export async function readPack(packId) {
    try {
        const raw = await readFile(packFile(packId), 'utf8');
        const parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
        return parseStoredPack(parsed);
    }
    catch {
        return null;
    }
}
export async function appendPhoto(packId, photo) {
    await ensurePackDir(packId);
    await appendFile(photosFile(packId), `${JSON.stringify(photo)}\n`, 'utf8');
    const raw = await readFile(photosFile(packId), 'utf8');
    return raw.trim().split('\n').filter(Boolean).length;
}
export async function createPack(packId, director, anchorWorks) {
    const pack = emptyPack(director, anchorWorks);
    await writePack(packId, pack);
    return pack;
}
