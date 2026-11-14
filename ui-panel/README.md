# 风格采集器面板

风格采集器内置的 UI 面板：输入框左侧按钮 → 选图上传 → Host 多模态模型产出候选观察 → 人工核对/编辑 → 生成 guide → 下载 `.md`。

不再单独安装；它随 `@local/style-collector` 一起加载（Host 入口 `./ui-host`，Client 入口 `./client`）。

## 当前流程

```text
idle → uploading → reviewing（配置 focus）→ analyzing → reviewing → confirming → preview → done / error
```

- 上传后先在每张图卡片上**勾选**自己的 focus（默认 `light_direction/color_palette/composition`；可选 `perspective/setting/material/texture/atmosphere/subject/props/note`），再点“开始分析”。
- 每张图**独立**分析；每张失败自动重试 1 次（最多 2 次）。AI 只分析该图勾选的项，focus 外字段 Host 端过滤。
- `subject`（人物/主体）是可选关注项，guide §4 会多一行“人物/主体”。
- 审核面板分成功区/失败区：失败卡片红底红框，显示错误原因，可“重试分析”或“手动填写”。
- 只有点“确认全部并生成 guide”才写入采集端；未确认内容不落库。
- 分析可取消，已完成的图保留；失败/取消的图可单独重试。
- 审核中改过的 textarea 按图片路径缓存在 sessionStorage；重新选同样的图会恢复，已填满的直接跳过分析。
- 模型失败时显示 error，可“返回修改”或“重试”。

## 安装

随采集器一起安装：

```bash
cd D:\Deep_Harness\director-style-collector
pnpm build
# plugin_manager install_bundle 指向采集器根目录
```

改 Host/Client 后重启 DSH。

## UI

- 输入框左侧入口按钮：线条图片图标 + “导入照片”（不再使用 emoji）。
- 打开后是**居中模态框**（portaled to body，带遮罩），宽度 `min(900px, 96vw)`，高度 `max-height: 80vh`，头/底固定、内容区滚动。
- 顶部步骤条：`选图 → 关注项 → 分析 → 审核 → 生成 → 下载`，当前高亮、已完成打勾；上传后先停在“关注项”，分析完进入“审核”。
- 每张图一张卡片：96×96 缩略图（圆角+边框）、**该图自己的** focus 勾选项（11 个可选，勾选后显示对应输入框）、字段两列自适应排版。
- 每张图还有“用途”下拉：未指定 / 画风 / 灯光 / 色彩 / 构图 / 视角 / 场景 / 材质 / 质感 / 氛围 / 人物 / 道具 / 备注。用途只影响 guide §6 标注与色板分组，不参与 AI 观察。
- 勾选“人物/主体”时出现可选“主体编号”输入：同一人物填相同编号（如 `A`），guide §4 会把它们聚合成 `主体 A（P01/P02）`；不填则逐图显示。
- 提示：“每张图可指定不同关注项，AI 只分析你勾选的项。”
- 某张图 focus 为空：卡片红框、顶部红字“请为每张图至少选一个关注项”，确认按钮禁用。
- 关闭面板（右上角 × 或点遮罩）会中止进行中的上传/分析/确认并回到开始页；已填内容仍按路径留在 sessionStorage，重新选同样图片可恢复。
- 失败卡片：浅红底 `rgba(255,77,79,0.08)`、边框 `#ff4d4f`、标题旁 `⚠ 分析失败`、错误原因小字。
- 分析中显示“第 N/M 张分析中…”，每张卡片独立状态（⏳/✓/✗）。
- 按钮主次：主按钮主题色；次按钮灰底；危险操作（重新选图/重新开始）红字无底。
- 全局反模式输入 + “本包明确无反模式”勾选。
- 设置底部主按钮：`确认全部并生成 guide`；所有照片字段有值且反模式已填/已勾选才启用。
- 生成成功后进入 **preview**（下载前预览）：只显示 §4 与 §7，按钮“返回修改 / 确认下载”；确认后才下载完整 `.md` 并进入 done。
- 审核页顶部显示“本次分析使用：`provider/model`”（来自 `analyze_photos_draft` 的 `model_used`）。

## 字段精度约定

- `material`（材质）：只写“对象=材料+表面处理+磨损状态”，例如 `书桌=深胡桃木，哑光打蜡，边缘磨白`；不写光线、颜色、构图、氛围。
- `texture`（质感/颗粒）：只写“表面粗糙度/纹理尺度/光泽 + 影像颗粒/噪点/锐度”，例如 `岩石粗粝，裂隙 1–3mm，哑光；Kodak Portra 400 细颗粒，暗部轻噪`；不写场景、光源、情绪。
- `atmosphere`（氛围）：只写“空气介质+能见度+色温倾向+动静”，例如 `贴地薄雾，能见度约 200m，冷蓝灰调，无风`；不写光源方向、具体时间（黄金时刻）、情绪判断（宁静/戏剧感）。
- `material` 回答“什么做的”，`texture` 回答“表面/画面颗粒怎样”，`atmosphere` 回答“空气和空间给人的物理感受”。

## 容错与回退

| 状态 | 返回/取消 | 行为 |
|---|---|---|
| uploading | 取消上传 | abort fetch，回 idle |
| analyzing | 取消分析 | abort 当前这张，已完成保留，回 reviewing |
| reviewing | 重新选图 | 回 idle；已填内容按路径缓存 |
| reviewing | 重试失败的图（N） | 只重试 failed/pending |
| confirming | 返回修改 | abort confirm，回 reviewing，字段保留 |
| done | 重新开始 | 清空 state + 缓存，并丢弃 `ui-temp-*` 包 |
| error | 返回修改 / 重试 | 回上一个可用状态 / 重试当前操作 |

`done` 的“重新开始”会 `POST /api/director-ui/discard` 删除 `ui-temp-<timestamp>` 目录，并删除该包引用过的 `_ui-uploads` 原图（只删本包引用，不动其他包）；其他 pack_id 一律拒绝。返回 `{ ok, pack_id, deleted_uploads }`。

## Host 工具

### analyze_photos_draft

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `photo_paths` | string[] | 是 | 上传返回的绝对路径 |
| `focus_per_photo` | object | 否 | 路径 → focus 数组；默认 light_direction/color_palette/composition |

行为：`attachments.saveImage` 落为附件 → `llm.stream` 逐张调用 → 解析 JSON → 返回 `{ ok, drafts:[{photo_path,focus,observations,evidence_level:"ai_draft"}], warnings, failed_paths, model_used }`。不写采集端。prompt 明确“只分析以下关注项：…，不要分析或输出其他项”，解析后只保留 focus 内字段。`model_used` 为 `provider/model`，UI 在审核页显示。

模型选择：先看 `agentDefaultModel.currentSelection()` 是否支持 `image` modality；否则遍历 `llm.listProviders()` / `listModels()` 找第一个多模态模型；都没有则返回“没有可用的多模态模型”。

### confirm_observations

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `pack_id` | string | 否 | 默认 `ui-temp-<timestamp>` |
| `photos` | array | 是 | `{ photo_id, path, focus[], observations{} }` |
| `anti_patterns` | string[] | 是 | 至少一条 |
| `honest_limits_auto` | string[] | 否 | 只传 `observations 由用户手动录入并审核确认。`；静态照片那句由 renderGuide 自动追加 |

按 `photo_id` 幂等写 `photos.jsonl`（存在覆盖、不存在追加）→ 把上传原图复制到 `<pack>/photos/<id>.<ext>`，`path` 改为 `photos/...`、`source_path` 保留原上传路径 → 写 anti/honest → 校验 → renderGuide → 返回 `{ ok, pack_id, guide_md, guide_path, summary }`。guide §6 输出 `./photos/...`。

### export_guide

只校验 `guide_md` 并返回 `{ ok, filename, size_bytes }`。

### list_recent_packs

扫描主目录，返回最近 5 个包。

## 上传路由

```
POST /api/director-ui/upload    multipart/form-data, 字段 files
POST /api/director-ui/analyze   application/json: { photo_paths, focus_per_photo? }
POST /api/director-ui/confirm   application/json: { photos, anti_patterns, honest_limits_auto }
POST /api/director-ui/discard   application/json: { pack_id }  仅 ui-temp-<timestamp>
```

上传限制：单文件 ≤ 10MB、总 ≤ 50MB、≤ 20 个、只收 jpeg/png/webp/gif；文件名含 `..`/路径分隔符直接拒绝；落盘 `_ui-uploads/<timestamp>/`。

## 验证记录

- 上传：合法 png 返回绝对路径；txt / 11MB / `../evil.png` 均 400。
- `analyzePhotos` 用 mock llm/attachments 跑通：正确解析 JSON、过滤非法 hex、模型 error 时返回 `failed_paths`。
- 重试：第一次模型失败、第二次成功 → 产出 draft；两次都失败 → `failed_paths [{ retried: true }]`。
- `confirm_observations`：2 张照片生成 guide；§4 用确认值，§6 输出 `./photos/P01.jpg` 等包内相对路径，§2/§3 `[待采集]`，头部 `package_type: photo_reference`。
- 生命周期：confirm 后 pack 目录出现 `photos/P01.jpg`、`photos/P02.jpg`；`photos.jsonl` 的 `path` 为 `photos/...`，`source_path` 为原始上传绝对路径。
- discard：删除 `ui-temp-*` 包 + 该包引用过的 2 个上传原图，`deleted_uploads: 2`；其他包/归档文件不受影响。
- `cleanup_uploads`：dry-run 扫描到 4 个文件，3 个被引用（含归档包），只报告 1 个孤儿；`confirm=true` 只删孤儿，归档引用保留。
- 3-B：`analyzePhotos` 返回 `model_used: "mock/m"`；UI 审核页顶部显示该值。
- 3-A：confirm 成功进入 preview，preview 只渲染 §4/§7 提取段；点“确认下载”才触发 Blob 下载并进入 done。UI 下载行为仍需重启后目视确认。
- 每图独立 focus：P01 只留 `light_direction`、P02 只留 `subject` → §4 光线只有 P01，人物/主体只有 P02；P01 的 subject、P02 的 light_direction 均为 `[未采集]`。
- prompt 只列所选 key；模型多返回的字段被过滤（subject-only 的 draft 只有 subject）。
- 新增字段渲染：`perspective/texture` 与 `setting/props` 分别进 §4“视角/机位、质感/颗粒、场景/环境、道具/陈设”；未勾选字段为 `[未采集]`。
- 角色用途：P01 `style`、P02 `lighting` → §6 输出 `P01（画风）`、`P02（灯光）`；色板按用途分组，不跨用途合并。
- `subject_id`：P01/P02 都填 `A` → §4 输出 `主体 A（P01/P02）：中年男性，正面 / 同一个人，侧面`；不填 → 保持 `P01：…`、`P02：…` 两行；混合时同编号聚合、其余逐图。
- 非法 role → `照片 P01 不合法：role 非法：bogus（允许：style, lighting, composition, prop）`。
- §7 只有一条“observations 由用户手动录入…”+ 一条自动追加的“静态照片提取…”。
- 同 `photo_id` 连跑两次 confirm：`photos.jsonl` 行数 2 → 2；新增 P03 后 3 行。
- `pnpm build` exit 0。

## 已知边界

- **每张图一次模型调用**：token 成本随照片数线性增长；有取消按钮，但取消只中止浏览器请求，Host 当前那张可能仍会跑完。
- 默认模型可能不支持图片；会自动回退到第一个 `image` modality 模型，若没有则 error。
- 模型输出按自由文本里的第一个 `{...}` 解析；输出不是 JSON 时该图记为失败。
- 部分照片失败时其余仍进入审核；失败项 focus 为空，需手动补。
- 审核仍是人工确认，AI 值未经确认不会写入采集端。
- 上传只校验 MIME/大小/文件名，不校验图片可读性。
- 未做 B 的第二阶段（批量、取消、进度、重试预算）。
