/**
 * guide 生成（photo-only）：把已结构化的照片参考包映射成母版 7 节的 `guide-*.md`。
 *
 * 这是**确定性映射**，不是第二次 AI 提取：只读 pack.json 里已有的字段，
 * 原样引用；没有的字段标 [待采集] / [未采集]，不推导、不补全、不拆解。
 */

import { isAbsolute, relative, resolve } from 'node:path'
import type { DirectorPack, PhotoFocus, PhotoRecord, PhotoRole } from './schema.js'
import { observationForFocus } from './schema.js'
import { packDir } from './store.js'

export interface GuideResult {
  markdown: string
  warnings: string[]
}

function pending(reason: string): string {
  return `[待采集：${reason}]`
}

const ROLE_LABELS: Record<PhotoRole, string> = {
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
}

const ROLE_ORDER: PhotoRole[] = ['style', 'lighting', 'color', 'composition', 'camera', 'setting', 'material', 'texture', 'atmosphere', 'subject', 'props', 'note']

/** 母版 §5 原文，一字不改；标题下方加消费端契约标注。 */
const MASTER_SECTION_5 = [
  '## 5. 输出格式（死命令）',
  '[消费端契约，采集端不改写]',
  '- 必须包含 `## 拆解段`、`## 配额段`、`## 推理段`、`## 落表段`。',
  '- 分镜表必须 10 列。',
  '- CLIP 逐秒拆解必须带 `(X-Y秒，速度 Z.x)` 客观速率块。',
].join('\n')

/** evidence_level：只按 photos 的 focus 字段完整性判定（照片记录没有 note_process）。 */
function evidenceLevel(pack: DirectorPack): 'observed' | 'mixed' | 'source_only' {
  const photos = pack.photos ?? []
  if (photos.length === 0) return 'source_only'
  const complete = photos.every(photo =>
    photo.focus.every(field => {
      const value = observationForFocus(photo, field)
      return value !== undefined && (Array.isArray(value) ? value.length > 0 : value.trim().length > 0)
    }),
  )
  return complete ? 'observed' : 'mixed'
}

function guideHeader(pack: DirectorPack, packId: string): string {
  return [
    `# 导演包指导书 · ${pack.meta.director}`,
    '',
    `> pack_id：${packId} · 版本 ${pack.meta.version}`,
    '> source_type：observed',
    `> evidence_level：${evidenceLevel(pack)}`,
    '> package_type：photo_reference',
  ].join('\n')
}

function photoDisplayPath(photo: PhotoRecord, packId: string): string {
  if (photo.path_verified !== true) {
    const name = photo.path.split(/[\\/]/).filter(Boolean).pop() ?? photo.path
    return `[路径未验证：${name}]`
  }
  const normalized = photo.path.replace(/\\/g, '/').replace(/^\.\//, '')
  if (!isAbsolute(photo.path)) return `./${normalized}`
  const absolute = resolve(photo.path)
  const root = resolve(packDir(packId))
  const rel = relative(root, absolute)
  if (rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel)) return `./${rel.replace(/\\/g, '/')}`
  return absolute
}

export function renderGuide(pack: DirectorPack, packId: string): GuideResult {
  const photos = pack.photos ?? []
  const warnings: string[] = []
  const sections: string[] = []

  // §1 拆解规则
  const s1: string[] = ['## 1. 拆解规则', '情绪基调：']
  const noteMap = new Map<string, string[]>()
  for (const photo of photos) {
    const note = photo.observations.note?.trim()
    if (note === undefined || note.length === 0) continue
    const ids = noteMap.get(note) ?? []
    ids.push(photo.photo_id)
    noteMap.set(note, ids)
  }
  const commonNotes = [...noteMap.entries()].filter(([, ids]) => ids.length >= 2)
  if (commonNotes.length === 0) {
    s1.push(pending('无跨照片共性归纳'))
    warnings.push('§1 待采集：无跨照片共性归纳')
  } else {
    for (const [text, ids] of commonNotes) s1.push(`- ${text}（${ids.join('、')}）`)
  }
  s1.push('', '条件规则：')
  if (pack.decision_heuristics.length === 0) {
    s1.push(pending('无跨照片共性归纳'))
    if (!warnings.includes('§1 待采集：无跨照片共性归纳')) warnings.push('§1 待采集：无跨照片共性归纳')
  } else {
    for (const [index, item] of pack.decision_heuristics.entries()) {
      if (index > 0) s1.push('')
      s1.push(`IF ${item.situation}`, `THEN ${item.choice}`)
      if (item.rationale !== undefined) s1.push(`WHY  ${item.rationale}`)
    }
  }
  s1.push('', '最高点锁定：')
  s1.push(pending('照片无时间信息'))
  warnings.push('§1 待采集：照片无时间信息')
  sections.push(s1.join('\n'))

  // §2 配额与节奏（照片无时间信息，恒定）
  sections.push(
    [
      '## 2. 配额与节奏',
      `镜头分配：${pending('照片无时间信息')}`,
      `速度反差：${pending('照片无时间信息')}`,
    ].join('\n'),
  )
  warnings.push('§2 待采集：照片无时间信息')

  // §3 动作物理链（照片无动作信息，恒定）
  sections.push(['## 3. 动作物理链', pending('照片无动作信息')].join('\n'))
  warnings.push('§3 待采集：照片无动作信息')

  // §4 呼吸感与环境动态（逐照片按 focus 聚合）
  const s4: string[] = ['## 4. 呼吸感与环境动态', '已观察到的项：']
  const categories: Array<{ label: string; focus: PhotoFocus }> = [
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
  ]
  for (const category of categories) {
    s4.push(`- ${category.label}：`)
    if (category.focus === 'subject') {
      const emitted = new Set<string>()
      for (const photo of photos) {
        const subjectId = photo.subject_id
        if (subjectId !== undefined && subjectId.length > 0) {
          if (emitted.has(subjectId)) continue
          emitted.add(subjectId)
          const group = photos.filter(item => item.subject_id === subjectId)
          const values = group
            .map(item => item.observations.subject?.trim())
            .filter((value): value is string => value !== undefined && value.length > 0)
          s4.push(
            `  - 主体 ${subjectId}（${group.map(item => item.photo_id).join('/')}）：${values.length > 0 ? values.join(' / ') : '[未采集]'}`,
          )
        } else {
          const value = photo.observations.subject?.trim()
          s4.push(`  - ${photo.photo_id}：${value !== undefined && value.length > 0 ? value : '[未采集]'}`)
        }
      }
      continue
    }
    for (const photo of photos) {
      const value = observationForFocus(photo, category.focus)
      if (value === undefined) s4.push(`  - ${photo.photo_id}：[未采集]`)
      else s4.push(`  - ${photo.photo_id}：${Array.isArray(value) ? value.join(' / ') : value}`)
    }
  }
  s4.push('', '四层画面：')
  for (const label of ['前景', '中景', '背景', '空气层']) s4.push(`- ${label}：${pending('照片无分层字段')}`)
  s4.push('', '环境动态（母版要求 ≥3 项）：')
  for (const name of ['风', '光斑', '浮尘']) s4.push(`- ${name}：${pending('照片无环境动态字段')}`)
  warnings.push('§4 部分待采集：四层画面/环境动态未记录')
  sections.push(s4.join('\n'))

  // §5 输出格式（母版原文）
  sections.push(MASTER_SECTION_5)

  // §6 参考图规范（照片即参考图）
  const s6: string[] = ['## 6. 参考图规范']
  if (photos.length === 0) {
    s6.push(pending('无照片'))
    warnings.push('§6 待采集：无照片')
  } else {
    s6.push(`参考照片（${photos.length} 张）：`)
    for (const photo of photos) {
      const role = photo.role ? `（${ROLE_LABELS[photo.role]}）` : ''
      s6.push(`- ${photo.photo_id}${role}：${photoDisplayPath(photo, packId)}`)
    }
    const palettePhotos = photos.filter(photo => (photo.observations.key_colors ?? []).length > 0)
    if (palettePhotos.length === 0) {
      s6.push(`色板聚合：${pending('未采集')}`)
    } else {
      const groups = new Map<string, PhotoRecord[]>()
      for (const photo of palettePhotos) {
        const key = photo.role ?? 'unset'
        const list = groups.get(key) ?? []
        list.push(photo)
        groups.set(key, list)
      }
      for (const key of [...ROLE_ORDER, 'unset']) {
        const list = groups.get(key)
        if (list === undefined) continue
        const colors = [...new Set(list.flatMap(photo => photo.observations.key_colors ?? []))]
        const label = key === 'unset' ? '未指定' : ROLE_LABELS[key as PhotoRole]
        s6.push(`色板聚合（${label}：${list.map(photo => photo.photo_id).join('/')}）：${colors.join(' / ')}`)
      }
    }
  }
  sections.push(s6.join('\n'))

  // §7 补充规则
  const s7: string[] = ['## 7. 补充规则', '反模式（原文）：']
  if (pack.anti_patterns.length === 0) {
    s7.push(pending('无反模式'))
    warnings.push('§7 待采集：无反模式')
  } else {
    for (const item of pack.anti_patterns) s7.push(`- ${item}`)
  }
  s7.push('', '诚实边界（原文）：')
  if (pack.honest_limits.length === 0) {
    s7.push(pending('无诚实边界'))
    warnings.push('§7 待采集：无诚实边界')
  } else {
    for (const item of pack.honest_limits) s7.push(`- ${item}`)
  }
  s7.push('- 本指导书基于静态照片提取，不含剪辑节奏与动作链。§2、§3 恒为 [待采集]。（自动追加）')
  sections.push(s7.join('\n'))

  return { markdown: `${guideHeader(pack, packId)}\n\n${sections.join('\n\n')}\n`, warnings }
}
