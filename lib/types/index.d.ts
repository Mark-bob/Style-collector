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
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "@local/style-collector";
export declare const inject: readonly ["tools"];
/** 插件配置：数据根目录的显式覆盖。 */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    dsh_home: z<string, string, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    dsh_home: z<string, string, "defined">;
}>>, "plain">;
export declare function apply(ctx: Context, config?: {
    dsh_home?: string;
}): void;
