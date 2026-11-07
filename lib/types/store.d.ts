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
import { type DirectorPack } from './schema.js';
export declare function dshHome(): string;
export declare function configureStore(options?: {
    dshHome?: string;
}): void;
/** DSH_HOME 解析优先级：显式配置 > `$DSH_HOME` 环境变量 > `~/.dsh`。 */
export declare function resolveDshHome(): string;
export declare function packRoot(): string;
export declare function slugify(name: string): string;
export declare function packDir(packId: string): string;
export declare function packFile(packId: string): string;
export declare function photosFile(packId: string): string;
export declare function ensurePackDir(packId: string): Promise<void>;
export declare function packExists(packId: string): Promise<boolean>;
export declare function writePack(packId: string, pack: DirectorPack): Promise<void>;
export declare function readPack(packId: string): Promise<DirectorPack | null>;
export declare function appendPhoto(packId: string, photo: object): Promise<number>;
export declare function createPack(packId: string, director: string, anchorWorks: string[]): Promise<DirectorPack>;
