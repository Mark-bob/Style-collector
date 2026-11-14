/**
 * guide 生成（photo-only）：把已结构化的照片参考包映射成母版 7 节的 `guide-*.md`。
 *
 * 这是**确定性映射**，不是第二次 AI 提取：只读 pack.json 里已有的字段，
 * 原样引用；没有的字段标 [待采集] / [未采集]，不推导、不补全、不拆解。
 */
import { isAbsolute, relative, resolve } from 'node:path';
import { observationForFocus } from './schema.js';
import { packDir } from './store.js';
function pending(reason) {
    return `[待采集：${reason}]`;
}
const ROLE_LABELS = {
    style: '画风',
    lighting: '灯光',
    color: '色彩',
    composition: '构图',
    camera: '视角',
    setting: '场景',
    material: '材质',
    texture: '质感',
    atmosphere: '氛围',
    subject: '人物',
    props: '道具',
    prop: '场景道具',
    note: '备注',
};
function photoRoles(photo) {
    if (Array.isArray(photo.roles) && photo.roles.length > 0)
        return photo.roles;
    return photo.role === undefined ? [] : [photo.role];
}
/** 新版母版 guide-video 的 §5 输出契约；采集端只注入，不改写内容。 */
const MASTER_SECTION_5 = [
    '## 5. 输出格式（死命令）',
    '[消费端契约，采集端不改写]',
    '- 文档最顶端先写一行 `> 💡 操作提示：…`，说明先跑图、再投喂视频、分卷拼接。',
    '- 必须包含 `## 拆解段`、`## 配额段`、`## 推理段`、`## 落表段`。',
    '- 分镜表必须 **恰好 10 列**，表头一字不改：',
    '',
    '| 镜号 | 节拍 | 景别 | 运镜 | 时长(s) | 画面 | 光线 | 转场 | 声音 | 设计理由 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    '',
    '- CLIP 逐秒拆解必须带 `(X-Y秒，速度 Z.x)` 客观速率块。',
    '',
    '### 5.1 角色指代与说话人锁定（死命令）',
    '',
    '- 每镜 ⑨首帧必须写“角色名 + 固定外观锚点”，禁止孤立的“他/她”。',
    '- 跨镜指代必须重复角色名；不得用“他”承接上一镜的另一个人。',
    '- 台词统一写“角色名（外观锚点）：‘台词’”。',
    '- 分镜表“声音”列必须带说话人主语。',
    '- 参考图锚定必须写明谁说话、谁只听；表演词不得写给非说话者。',
    '- 说话镜头不得出现另一角色的标志性特征（白须、白衣、黑衣等）。',
    '- 相似景别/相似表情的相邻镜头必须写出身份与动作差异。',
    '- 三秒自检：每句台词能否在 3 秒内指认说话者？',
    '',
    '### 5.2 高级转场与衔接（死命令）',
    '',
    '- 分镜表“转场”列必须写“转场类型-具体承接物/动作”，禁止只写硬切/淡入。',
    '- 八种可选：动作匹配、实体遮挡、闪白/闪黑、环绕、蒙版、匹配剪辑、甩镜、J-Cut 声音桥。',
    '- 上一镜结尾动作必须接下一镜开头；每镜尾部原样写：',
    '  > [衔接提示：请截取本镜最后一帧，作为下一镜的首帧图使用，并配合 J-Cut 声音前置。]',
    '- 每个切点写 J-Cut/L-Cut 声音前置或延续；卷尾写下一卷首帧接口。',
    '',
    '### 5.3 时长、参考图、脸型与光线铁律',
    '',
    '- 叙事/动作/对话镜头 ≥3.0s；情绪特写/空镜 2.0–3.0s；极速冲击 1.0–1.5s 且注明“无需完整动作”。',
    '- `总时长 / 镜头数 < 2.5s` 必须合并或删减叙事镜头；不得把单镜压到 1.5s 以下。',
    '- 用户指定 N 镜时不得擅自合并；时长不足要在拆解段提示。',
    '- 每套角色参考图独立完整写棚拍光线，禁止“同上/同一影棚”。',
    '- 多角色必须写脸型、颧骨、下颌线、眼型、鼻子等骨骼差异。',
    '- 分镜表光线列每行必须不同：写光源、材质、阴影方向与边缘。',
    '',
    '### 5.4 声音表演与声场（通用）',
    '',
    '- 拆解段写项目级：声学基调、后期声音策略、每个角色的配音声线。',
    '- 所有 Shot 的 ⑩ 末尾写 `[声音层] 环境底噪 + 关键拟音 + 距离感`。',
    '- 有台词镜头追加 `[声音表演] 角色（声线）·音量 x/10·语速 x 字/秒·气息·情绪` 和 `[声场锚点]`。',
    '- “无 BGM”只指配乐；环境声、拟音、台词必须保留。',
    '- 同空间声场连续；切点写 J-Cut/L-Cut；平台支持音频时按此生成，不支持时作为后期参考。',
    '',
    '### 5.5 画面列强制公式（死命令）',
    '',
    '- 分镜表“画面”列必须按 `[人物站位与朝向] + [核心动作] + [构图特征] + [前景/空气层]` 四段、逗号分隔。',
    '- 四段顺序不可乱；不写光线/声音/转场/设计理由；不写成散文。',
    '- CLIP 的 ⑨首帧必须沿用同一公式，只写四要素。',
    '- 任意两镜必须换站位、动作或构图，不能只换形容词。',
    '',
    '### 5.6 ⑫标签唯一性',
    '',
    '- ⑫ 只能出现一次，只能写 `⑫NEGATIVE`。',
    '- 禁止 `⑫衔接提示`；衔接提示放在 ⑫NEGATIVE 之后，写成独立引用行。',
    '- 正确顺序：⑨ → ⑩ → ⑪ → ⑫NEGATIVE → > [衔接提示：…]。',
    '',
    '### 5.7 特效物理化公式',
    '',
    '- 动作戏/施法/高速移动必须写：动作源 → 微观物理现象 → 光影与材质。',
    '- 至少从 10 大特效词库取 2 个物理细节；禁止只写“发光/有一团蓝光”。',
    '- 大招爆炸/刀芒瞬闪/碎片飞散用 0.2x–0.5x 速率块；写清粒子轨迹、冲击波、环境光与镜头反应。',
    '',
    '### 5.8 后期指南独立落盘',
    '',
    '- 主文档四段式写完后，在同一 Markdown 中另起一行写 `===SEPARATOR===`。',
    '- 分隔符后写 `# [项目名] · 后期剪辑与声音指南`，包含 J-Cut/L-Cut 踩点、首尾帧衔接表、可选 FFmpeg 命令。',
    '- 主文档不能混入后期指南内容。',
    '',
    '### 5.9 项目状态看板',
    '',
    '- 正文最顶端（H1 之后）先写 `## 📋 项目状态看板`。',
    '- 写清当前进度、资产验收状态、格式契约自检、生成预算限流。',
    '- 看板不替代四段式，不改变 10 列表头。',
    '',
    '### 5.10 单卷 15 秒硬上限',
    '',
    '- 每一卷 Shot 时长相加必须 ≤15.0s；下一镜会超就切到下一卷。',
    '- 配额段必须先做逐卷加法，允许短卷，不能为凑满拉长单镜。',
    '- 卷标题后写卷内镜头数与总时长，卷尾再核对一次。',
    '',
    '### 5.11 人物提示词视觉纯净度',
    '',
    '- 普通人物只写物理事实（眼下淡青/肩膀微塌/下颌咬紧），禁止“悲伤/刚失业/理直气壮”等剧情解释。',
    '- 多角色必须写脸型、下颌线、颧骨、鼻型、眼型等骨骼差异。',
    '- 无脸面板必须写 `blank face, low-detail featureless`，并在末尾加 `--no face, facial features`；重点写服装轮廓与全身比例。',
].join('\n');
/** evidence_level：只按 photos 的 focus 字段完整性判定（照片记录没有 note_process）。 */
function evidenceLevel(pack) {
    const photos = pack.photos ?? [];
    if (photos.length === 0)
        return 'source_only';
    const complete = photos.every(photo => photo.focus.every(field => {
        const value = observationForFocus(photo, field);
        return value !== undefined && (Array.isArray(value) ? value.length > 0 : value.trim().length > 0);
    }));
    return complete ? 'observed' : 'mixed';
}
function guideHeader(pack, packId) {
    return [
        `# 导演包指导书 · ${pack.meta.director}`,
        '',
        `> pack_id：${packId} · 版本 ${pack.meta.version}`,
        '> source_type：observed',
        `> evidence_level：${evidenceLevel(pack)}`,
        '> package_type：photo_reference',
    ].join('\n');
}
function photoDisplayPath(photo, packId) {
    if (photo.path_verified !== true) {
        const name = photo.path.split(/[\\/]/).filter(Boolean).pop() ?? photo.path;
        return `[路径未验证：${name}]`;
    }
    const normalized = photo.path.replace(/\\/g, '/').replace(/^\.\//, '');
    if (!isAbsolute(photo.path))
        return `./${normalized}`;
    const absolute = resolve(photo.path);
    const root = resolve(packDir(packId));
    const rel = relative(root, absolute);
    if (rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel))
        return `./${rel.replace(/\\/g, '/')}`;
    return absolute;
}
export function renderGuide(pack, packId) {
    const photos = pack.photos ?? [];
    const warnings = [];
    const sections = [];
    // §1 拆解规则
    const s1 = ['## 1. 拆解规则', '情绪基调：'];
    const noteMap = new Map();
    for (const photo of photos) {
        const note = photo.observations.note?.trim();
        if (note === undefined || note.length === 0)
            continue;
        const ids = noteMap.get(note) ?? [];
        ids.push(photo.photo_id);
        noteMap.set(note, ids);
    }
    const commonNotes = [...noteMap.entries()].filter(([, ids]) => ids.length >= 2);
    if (commonNotes.length === 0) {
        s1.push(pending('无跨照片共性归纳'));
        warnings.push('§1 待采集：无跨照片共性归纳');
    }
    else {
        for (const [text, ids] of commonNotes)
            s1.push(`- ${text}（${ids.join('、')}）`);
    }
    s1.push('', '条件规则：');
    if (pack.decision_heuristics.length === 0) {
        s1.push(pending('无跨照片共性归纳'));
        if (!warnings.includes('§1 待采集：无跨照片共性归纳'))
            warnings.push('§1 待采集：无跨照片共性归纳');
    }
    else {
        for (const [index, item] of pack.decision_heuristics.entries()) {
            if (index > 0)
                s1.push('');
            s1.push(`IF ${item.situation}`, `THEN ${item.choice}`);
            if (item.rationale !== undefined)
                s1.push(`WHY  ${item.rationale}`);
        }
    }
    s1.push('', '最高点锁定：');
    s1.push(pending('照片无时间信息'));
    warnings.push('§1 待采集：照片无时间信息');
    sections.push(s1.join('\n'));
    // §2 配额与节奏（照片无时间信息，恒定）
    sections.push([
        '## 2. 配额与节奏',
        `镜头分配：${pending('照片无时间信息')}`,
        `速度反差：${pending('照片无时间信息')}`,
    ].join('\n'));
    warnings.push('§2 待采集：照片无时间信息');
    // §3 动作物理链（照片无动作信息，恒定）
    sections.push(['## 3. 动作物理链', pending('照片无动作信息')].join('\n'));
    warnings.push('§3 待采集：照片无动作信息');
    // §4 呼吸感与环境动态（逐照片按 focus 聚合）
    const s4 = ['## 4. 呼吸感与环境动态', '已观察到的项：'];
    const categories = [
        { label: '光线', focus: 'light_direction' },
        { label: '色彩', focus: 'color_palette' },
        { label: '构图', focus: 'composition' },
        { label: '视角/机位', focus: 'perspective' },
        { label: '场景/环境', focus: 'setting' },
        { label: '材质', focus: 'material' },
        { label: '质感/颗粒', focus: 'texture' },
        { label: '氛围', focus: 'atmosphere' },
        { label: '人物/主体', focus: 'subject' },
        { label: '道具/陈设', focus: 'props' },
    ];
    for (const category of categories) {
        s4.push(`- ${category.label}：`);
        if (category.focus === 'subject') {
            const emitted = new Set();
            for (const photo of photos) {
                const subjectId = photo.subject_id;
                if (subjectId !== undefined && subjectId.length > 0) {
                    if (emitted.has(subjectId))
                        continue;
                    emitted.add(subjectId);
                    const group = photos.filter(item => item.subject_id === subjectId);
                    const values = group
                        .map(item => item.observations.subject?.trim())
                        .filter((value) => value !== undefined && value.length > 0);
                    s4.push(`  - 主体 ${subjectId}（${group.map(item => item.photo_id).join('/')}）：${values.length > 0 ? values.join(' / ') : '[未采集]'}`);
                }
                else {
                    const value = photo.observations.subject?.trim();
                    s4.push(`  - ${photo.photo_id}：${value !== undefined && value.length > 0 ? value : '[未采集]'}`);
                }
            }
            continue;
        }
        for (const photo of photos) {
            const value = observationForFocus(photo, category.focus);
            if (value === undefined)
                s4.push(`  - ${photo.photo_id}：[未采集]`);
            else
                s4.push(`  - ${photo.photo_id}：${Array.isArray(value) ? value.join(' / ') : value}`);
        }
    }
    s4.push('', '四层画面：');
    for (const label of ['前景', '中景', '背景', '空气层'])
        s4.push(`- ${label}：${pending('照片无分层字段')}`);
    s4.push('', '环境动态（母版要求 ≥3 项）：');
    for (const name of ['风', '光斑', '浮尘'])
        s4.push(`- ${name}：${pending('照片无环境动态字段')}`);
    warnings.push('§4 部分待采集：四层画面/环境动态未记录');
    sections.push(s4.join('\n'));
    // §5 输出格式（母版原文）
    sections.push(MASTER_SECTION_5);
    // §6 参考图规范（照片即参考图）
    const s6 = ['## 6. 参考图规范'];
    if (photos.length === 0) {
        s6.push(pending('无照片'));
        warnings.push('§6 待采集：无照片');
    }
    else {
        s6.push(`参考照片（${photos.length} 张）：`);
        for (const photo of photos) {
            const roles = photoRoles(photo);
            const role = roles.length > 0 ? `（${roles.map(item => ROLE_LABELS[item]).join('/')}）` : '';
            s6.push(`- ${photo.photo_id}${role}：${photoDisplayPath(photo, packId)}`);
        }
        const palettePhotos = photos.filter(photo => (photo.observations.key_colors ?? []).length > 0);
        if (palettePhotos.length === 0) {
            s6.push(`色板聚合：${pending('未采集')}`);
        }
        else {
            for (const photo of palettePhotos) {
                const roles = photoRoles(photo);
                const roleText = roles.length > 0 ? `，${roles.map(item => ROLE_LABELS[item]).join('/')}` : '';
                s6.push(`色板聚合（${photo.photo_id}${roleText}）：${(photo.observations.key_colors ?? []).join(' / ')}`);
            }
        }
    }
    sections.push(s6.join('\n'));
    // §7 补充规则
    const s7 = ['## 7. 补充规则', '反模式（原文）：'];
    if (pack.anti_patterns.length === 0) {
        s7.push(pending('无反模式'));
        warnings.push('§7 待采集：无反模式');
    }
    else {
        for (const item of pack.anti_patterns)
            s7.push(`- ${item}`);
    }
    s7.push('', '诚实边界（原文）：');
    if (pack.honest_limits.length === 0) {
        s7.push(pending('无诚实边界'));
        warnings.push('§7 待采集：无诚实边界');
    }
    else {
        for (const item of pack.honest_limits)
            s7.push(`- ${item}`);
    }
    s7.push('- 本指导书基于静态照片提取，不含剪辑节奏与动作链。§2、§3 恒为 [待采集]。（自动追加）');
    sections.push(s7.join('\n'));
    return { markdown: `${guideHeader(pack, packId)}\n\n${sections.join('\n\n')}\n`, warnings };
}
