# 风格采集器（style-collector）

照片参考包采集插件：从多张照片提取视觉参考，输出 7 节 md。

> v0.4.0，2026-11-07。包名/显示名改为“风格采集器”；采集端仍为 photo-only。

## 定位

- **照片参考包采集**：从多张照片提取视觉参考（光线 / 色彩 / 构图 / 材质 / 氛围 / 备注）。
- 输出母版 7 节的 `guide-*.md`，供消费端读取。
- **不是**提示词生成插件；不读图、不自动识图，观测由人工录入。
- 对外唯一交付物是 `guide-{name}.md`；`pack.json` 是内部生产数据。

## 工具

| 工具 | 作用 |
|---|---|
| `director_pack_init` | 新建照片参考包 |
| `photo_append` | 追加一条照片参考记录（photos.jsonl） |
| `photo_list` | 列出照片摘要（photo_id / focus / has_note） |
| `photo_validate` | 照片校验（与 `director_pack_validate` 同一逻辑） |
| `director_pack_validate` | 校验照片与 `anti_patterns` / `honest_limits` |
| `director_pack_export` | 合并 photos 并导出 pack.json 与/或 guide-*.md |
| `director_pack_get` | 读取当前包 |
| `cleanup_uploads` | 清理 `_ui-uploads` 中未被任何 pack 引用的文件（默认 dry-run） |

- `director_pack_init`：参数 `director`、`anchor_works`，返回 `pack_id`；已存在时返回 `already_exists`。
- `photo_append`：写 `photos.jsonl`；`focus` 列出的字段必须在 `observations` 里，未列出的字段必须为 null 或省略；同时检查 `path` 文件是否存在，写入 `path_verified`（不存在也允许追加，只标记未验证）。可选 `role`（旧版单选）、`roles[]`（多选）、`subject_id`。
- `photo_validate` / `director_pack_validate`：照片非空、每条 focus 都有 observation、`anti_patterns` / `honest_limits` 非空；照片模式不强制 `mental_models`。
- `director_pack_export`：`format` 取 `pack` / `guide` / `both`（默认 both）；合并 `photos.jsonl` 进 `pack.photos`。
- `cleanup_uploads`：扫描 `_ui-uploads`，只报告/删除未被任何 pack 的 `photos.jsonl` 或 `pack.json` 引用的文件；默认 `dry_run=true`，传 `confirm=true` 才真删。归档包引用同样受保护。
- `confirm_observations`（UI Host）：成功时把上传原图复制到 `<pack>/photos/<photo_id>.<ext>`，`path` 改为 `photos/...`，`source_path` 保留原上传绝对路径；guide §6 输出 `./photos/...`。

## 照片参考包模式

- `PhotoRecord`：`photo_id`、`path`（绝对路径或 `photos/...` 包内相对路径）、`focus[]`、`observations{}`、`evidence_level: "observed"`、`path_verified?`、`roles?`（多选；兼容旧 `role?`）、`subject_id?`、`source_path?`。
- 生命周期：`confirm_observations` 成功后图片落到包内 `photos/`，`path` 改为 `photos/<id>.<ext>`；原上传路径记在 `source_path`。guide §6 优先输出 `./photos/...`；包外绝对路径仍输出绝对路径，未验证输出 `[路径未验证：文件名]`。
- `subject_id`（可选）：同一主体填相同编号（如 `A`）。guide §4“人物/主体”把同编号照片聚合成 `主体 A（P01/P02）：…`，不填则逐图显示。
- `_ui-uploads` 只是中转区；`cleanup_uploads` 可清理无引用文件，UI 的 `discard` 会删除该临时包引用过的上传原图。
- focus 取值：`light_direction` / `color_palette` / `composition` / `perspective` / `setting` / `material` / `texture` / `atmosphere` / `subject` / `props` / `note`；`color_palette` 对应 `observations.key_colors`（hex）。
- `roles`（可选，多选）：`style` / `lighting` / `color` / `composition` / `camera` / `setting` / `material` / `texture` / `atmosphere` / `subject` / `props` / `note`；一张图可同时归属多个用途。guide §6 标注 `P01（氛围/色彩）`，色板一行输出 `色板聚合（P01，氛围/色彩）：…`；未选用途时同样逐图一行。旧值 `role` 自动并入，`prop` 归一为 `props`。
- guide 里未在 `focus` 中列出的字段标 `[未采集]`，不是 `[待采集]`。
- guide §6 路径按 `path_verified` 分支：验证过且在包目录内输出 `./相对路径`，验证过但在包外输出绝对路径，未验证输出 `[路径未验证：文件名]`；色板聚合注明提供 hex 的照片。

## guide 生成

母版 7 节，确定性映射：只引用 `pack.json` 已有字段，缺失标 `[待采集]` / `[未采集]`，不推导、不补全。

- §1 情绪基调只在照片 `note` 存在跨照片共性时引用，否则 `[待采集：无跨照片共性归纳]`；条件规则取已有 `decision_heuristics`。
- §2 / §3 恒为 `[待采集：照片无时间信息]` / `[待采集：照片无动作信息]`。
- §4 逐照片按类别聚合；`subject_id` 相同的照片在“人物/主体”下聚合成一条；四层画面与环境动态标 `[待采集]`。
- §5 使用新版 `guide-video` 母版的输出契约（5.1–5.11）；分镜表 10 列表头直接内嵌，避免“见第 7 节”指错。
- §6 照片路径 + 色板聚合。
- §7 原文引用 `anti_patterns` / `honest_limits`，并自动追加“基于静态照片提取”的边界说明。
- 头部：`pack_id` / `source_type：observed` / `evidence_level` / `package_type：photo_reference`。
- `evidence_level`：无照片 `source_only`；所有 focus 字段完整 `observed`；否则 `mixed`。
- 返回值的 `warnings` 只装 `[待采集]` 项；`info` 装“guide 已覆盖”等非缺口提示。

## 对外交付物

- 唯一对外交付物是 `guide-{name}.md`（母版 7 节，头部含 `pack_id` / `source_type` / `evidence_level` / `package_type`）。
- `pack.json` 是采集端内部数据，不对外。
- `[待采集]` 原样透传，不美化、不填空。
- 返回值里 `guide_path` 是消费端唯一必需字段；`warnings` / `info` / `pack_path` 可选解析。

## 边界

1. 对外只交付 `guide-{name}.md`，`pack.json` 不对外。
2. guide 中所有缺失字段一律 `[待采集]` / `[未采集]`；`renderGuide` 没有填空/美化/推导分支。
3. `guide_path` 是消费端唯一必需字段；`warnings` / `info` / `pack_path` 存在但消费端不必解析。
4. 消费端遇到 `[待采集]` 时自行决定降级策略；采集端不因消费端需要而编造数据。

## 验证状态

- photo 模式：格式解析、消费端推演验证过；真实照片采集未验证（photo-test 用的是占位路径，已归档到 `_archive/photo-test/`）。
- shot 模式代码已删除，不再提供。

## 持久化

`DSH_HOME` 解析优先级：显式配置 > `$DSH_HOME` 环境变量 > `~/.dsh`。

自定义数据根目录：

```yaml
# ~/.dsh/profiles/<profile>/cordis.patch.yml
- id: style-collector
  name: '@local/style-collector'
  config:
    dsh_home: D:\style-data
```

```
$DSH_HOME/director-style-packs/
├── <pack_id>/
│   ├── pack.json    包主体
│   ├── photos.jsonl 照片记录，一行一条
│   └── photos/      包内照片副本（confirm_observations 写入）
├── _ui-uploads/     上传中转区（可被 cleanup_uploads 清理）
└── _archive/        历史样本（photo-test、shot-samples）
```

- `pack_id = slugify(导演名)`：小写，保留中文与字母数字，其余字符压成 `-`；它就是目录名。
- `pack.json` 存 `meta`、`expression_dna` 的形式层、`mental_models`、`decision_heuristics`、`anti_patterns`、`honest_limits`、`photos`。
- 写入 `pack.json` 用临时文件 + `rename`；读取容忍 UTF-8 BOM。

## 跑通顺序

### 第一步：构建

```bash
cd director-style-collector
pnpm install
pnpm build
```

运行时真实依赖 `@deepseek-ai/dsh-tools`、`@deepseek-ai/schemastery`、`@deepseek-ai/cordis`；本目录必须有 `node_modules`。

### 第二步：用 overlay 加载验证

```bash
# 回到 director-style-collector 的上一级目录
pnpm dsh web --patch ./director-style-collector/cordis.patch.yml
```

### 第三步：跑最小闭环

1. `director_pack_init`（director + anchor_works）
2. `photo_append` × N（每张指定 `focus`，`observations` 只填 `focus` 里的字段）
3. `director_pack_validate`
4. `director_pack_export`（`format="guide"` 或 `"both"`）

### 第四步：安装为 bundle

```bash
dsh plugin --profile <profile> add .
```

## 封版后如何新建包

封版只冻结代码，不冻结建包流程：

1. `director_pack_init`（director + anchor_works）
2. `photo_append` × N（每张指定 `focus`，`observations` 只填 `focus` 里的字段）
3. `director_pack_validate`
4. `director_pack_export`（`format="guide"` 或 `"both"`）

## 已知边界

- photo 模式 §2 / §3 恒为 `[待采集]`，这是素材边界，不是缺陷。
- photo 模式的证据等级依赖人工录入，不是模型自动读图。
- 采集端不补全、不推导、不美化；缺失一律 `[待采集]` / `[未采集]`。
- P0/P1 补数据：暂缓，不再作为封版后的待办。
