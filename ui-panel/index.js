/**
 * Host half of the director UI panel (route A: manual observations).
 *
 * Upload route + confirm route + the confirm/export/list tools. The collector
 * remains the single writer of packs; observations only come from the user.
 */

import { access, copyFile, mkdir, readFile, readdir, rm, rmdir, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  createPack,
  packDir,
  packExists,
  packRoot,
  photosFile,
  readPack,
  resolveDshHome,
  writePack,
} from '../lib/store.js'
import { renderGuide } from '../lib/guide.js'
import { observationForFocus, validatePhotoInput } from '../lib/schema.js'

export const inject = ['tools']

const UPLOAD_ROUTE = '/api/director-ui/upload'
const CONFIRM_ROUTE = '/api/director-ui/confirm'
const ANALYZE_ROUTE = '/api/director-ui/analyze'
const DISCARD_ROUTE = '/api/director-ui/discard'
const MAX_FILES = 20
const MAX_FILE_BYTES = 10 * 1024 * 1024
const MAX_TOTAL_BYTES = 50 * 1024 * 1024
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const HONEST_DEFAULT = ['observations 由用户手动录入并审核确认。']
const MEDIA_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
}
const DEFAULT_FOCUS = ['light_direction', 'color_palette', 'composition']

function text(content) {
  return [{ type: 'text', text: content }]
}

function json(status, value) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function fail(status, error) {
  return json(status, { ok: false, error })
}

function cleanName(raw) {
  const base = String(raw).split(/[\\/]/).pop() ?? 'image'
  const cleaned = base
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120)
  return cleaned.length > 0 ? cleaned : 'image'
}

async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function uploadsRoot() {
  return join(resolveDshHome(), 'director-style-packs', '_ui-uploads')
}

function isUnder(child, parent) {
  const rel = relative(parent, child)
  return rel.length > 0 && !rel.startsWith('..') && !isAbsolute(rel)
}

function safePhotoStem(id) {
  return String(id).replace(/[^A-Za-z0-9_-]/g, '_') || 'photo'
}

async function removeEmptyParents(file, root) {
  let dir = dirname(file)
  while (isUnder(dir, root)) {
    try {
      await rmdir(dir)
    } catch {
      break
    }
    dir = dirname(dir)
  }
}

async function handleUpload(request) {
  let form
  try {
    form = await request.formData()
  } catch {
    return fail(400, '无法解析 multipart/form-data')
  }
  const files = form.getAll('files').filter(value => typeof value !== 'string')
  if (files.length === 0) return fail(400, '缺少 files 字段')
  if (files.length > MAX_FILES) return fail(400, `文件数量超过 ${MAX_FILES}`)

  let total = 0
  for (const file of files) {
    const rawName = String(file.name ?? '')
    if (rawName.includes('..') || /[\\/]/.test(rawName)) return fail(400, `文件名不合法：${rawName}`)
    if (!ALLOWED_MIME.has(file.type)) return fail(400, `不支持的类型：${file.type || '未知'}（只接受 jpeg/png/webp/gif）`)
    if (file.size > MAX_FILE_BYTES) return fail(400, `单文件超过 10MB：${rawName}`)
    total += file.size
    if (total > MAX_TOTAL_BYTES) return fail(400, '总大小超过 50MB')
  }

  const dir = join(resolveDshHome(), 'director-style-packs', '_ui-uploads', String(Date.now()))
  await mkdir(dir, { recursive: true })
  const paths = []
  for (const file of files) {
    const name = cleanName(file.name)
    const ext = extname(name)
    const stem = ext.length > 0 ? name.slice(0, -ext.length) : name
    let target = join(dir, name)
    let index = 2
    while (await exists(target)) {
      target = join(dir, `${stem}-${index}${ext}`)
      index += 1
    }
    await writeFile(target, Buffer.from(await file.arrayBuffer()))
    paths.push(target)
  }
  return json(200, { ok: true, paths })
}

async function readPhotosJsonl(packId) {
  try {
    const raw = await readFile(join(packDir(packId), 'photos.jsonl'), 'utf8')
    const photos = []
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.length === 0) continue
      try {
        const parsed = JSON.parse(trimmed)
        if (parsed !== null && typeof parsed === 'object' && typeof parsed.photo_id === 'string') photos.push(parsed)
      } catch {
        // 坏行跳过
      }
    }
    return photos
  } catch {
    return []
  }
}

function union(base, extra) {
  const result = [...base]
  for (const item of extra) if (!result.includes(item)) result.push(item)
  return result
}

function countObservations(photos) {
  let total = 0
  for (const photo of photos) {
    for (const field of photo.focus) {
      const value = observationForFocus(photo, field)
      if (value === undefined) continue
      if (Array.isArray(value) ? value.length > 0 : value.trim().length > 0) total += 1
    }
  }
  return total
}

function focusList(input, path) {
  const map = input?.focus_per_photo
  const raw = map !== null && typeof map === 'object' ? map[path] : undefined
  if (Array.isArray(raw) && raw.length > 0) return raw.filter(field => typeof field === 'string')
  return [...DEFAULT_FOCUS]
}

function buildAnalyzePrompt(focus) {
  const keys = focus.map(field => (field === 'color_palette' ? 'key_colors' : field))
  const example = {}
  for (const field of focus) {
    example[field === 'color_palette' ? 'key_colors' : field] = field === 'color_palette' ? ['#8A6B3F', '#1B2A3A'] : '...'
  }
  const hints = {
    light_direction: 'light_direction 写主光方向、硬/软、阴影。',
    color_palette: 'key_colors 给 2–4 个照片中真实存在的颜色，格式 #RRGGBB。',
    composition: 'composition 写构图与前景/对称/留白。',
    perspective: 'perspective 写机位、视角、焦段（如低角贴地、平视、广角）。',
    setting: 'setting 写场景、环境、地点。',
    material: 'material 只写“对象=材料+表面处理+磨损状态”，不写光线、构图、氛围。',
    texture: 'texture 只写“表面粗糙度/纹理尺度/光泽 + 影像颗粒/噪点/锐度”，不写场景、光源、情绪。',
    atmosphere: 'atmosphere 只写“空气介质+能见度+色温倾向+动静”，不写光源方向、具体时间、情绪判断。',
    subject: 'subject 写主体是谁、穿什么、什么姿态、什么表情。',
    props: 'props 写道具、陈设。',
    note: 'note 写一句客观备注。',
  }
  return [
    '你只做静态照片的客观观察，不判断情绪，不补全看不到的信息。',
    '只输出一个 JSON 对象，不要 markdown 代码块，不要解释。',
    `只分析以下关注项：${keys.join('、')}；不要分析或输出其他项。`,
    `JSON 必须包含这些键：${keys.join(', ')}。`,
    ...focus.map(field => hints[field]).filter(Boolean),
    `示例形状：${JSON.stringify(example)}`,
  ].join('\n')
}

function parseDraft(rawText, focus) {
  const start = rawText.indexOf('{')
  const end = rawText.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let parsed
  try {
    parsed = JSON.parse(rawText.slice(start, end + 1))
  } catch {
    return null
  }
  const observations = {}
  for (const field of focus) {
    if (field === 'color_palette') {
      const colors = Array.isArray(parsed.key_colors) ? parsed.key_colors : []
      observations.key_colors = colors.filter(color => typeof color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(color))
    } else {
      const value = parsed[field]
      observations[field] = typeof value === 'string' ? value.trim() : ''
    }
  }
  return observations
}

async function pickVisionModel(ctx) {
  const llm = ctx.get?.('llm')
  if (!llm) throw new Error('Host 缺少 llm 服务')
  const supports = async (provider, model) => {
    try {
      const info = await llm.resolveModelInfo(provider, model)
      return Array.isArray(info?.inputModalities) && info.inputModalities.includes('image')
    } catch {
      return false
    }
  }
  const defaults = ctx.get?.('agentDefaultModel')?.currentSelection?.()
  if (defaults && (await supports(defaults.provider, defaults.model))) return defaults
  for (const provider of llm.listProviders()) {
    const models = await llm.listModels(provider.id)
    for (const model of models) {
      if (Array.isArray(model.inputModalities) && model.inputModalities.includes('image')) {
        return { provider: provider.id, model: model.id }
      }
    }
  }
  throw new Error('没有可用的多模态模型')
}

async function analyzePhotos(input, ctx) {
  const llm = ctx.get?.('llm')
  const attachments = ctx.get?.('attachments')
  if (!llm || !attachments) return { ok: false, error: 'Host 缺少 llm / attachments 服务' }
  const paths = Array.isArray(input?.photo_paths) ? input.photo_paths.filter(path => typeof path === 'string') : []
  if (paths.length === 0) return { ok: false, error: 'photo_paths 不能为空' }
  let selection
  try {
    selection = await pickVisionModel(ctx)
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
  const allowed = new Set(['light_direction', 'color_palette', 'composition', 'perspective', 'setting', 'material', 'texture', 'atmosphere', 'subject', 'props', 'note'])
  const drafts = []
  const failedPaths = []
  const modelUsed = `${selection.provider}/${selection.model}`
  for (const path of paths) {
    const focus = focusList(input, path).filter(field => allowed.has(field))
    let lastError
    let retried = false
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const mediaType = MEDIA_BY_EXT[extname(path).toLowerCase()]
        if (!mediaType) throw new Error('不支持的图片扩展名')
        const data = new Uint8Array(await readFile(path))
        const ref = await attachments.saveImage({ data, mediaType, name: basename(path) })
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 120000)
        let output = ''
        try {
          const chunks = llm.stream({
            provider: selection.provider,
            model: selection.model,
            temperature: 0.2,
            maxTokens: 700,
            signal: controller.signal,
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: buildAnalyzePrompt(focus) },
                { type: 'image', attachment: ref },
              ],
            }],
          })
          for await (const chunk of chunks) {
            if (chunk.type === 'text-delta') output += chunk.text
            else if (chunk.type === 'finish' && chunk.reason?.kind !== 'stop' && chunk.reason?.kind !== 'tool-calls') {
              throw new Error(chunk.reason?.failure?.message ?? `模型结束：${chunk.reason?.kind}`)
            }
          }
        } finally {
          clearTimeout(timer)
        }
        const observations = parseDraft(output, focus)
        if (observations === null) throw new Error('无法解析模型输出')
        drafts.push({ photo_path: path, focus, observations, evidence_level: 'ai_draft' })
        lastError = undefined
        break
      } catch (error) {
        lastError = error
        retried = attempt === 1
      }
    }
    if (lastError !== undefined) {
      failedPaths.push({
        path,
        error: lastError instanceof Error ? lastError.message : String(lastError),
        retried,
      })
    }
  }
  if (drafts.length === 0) return { ok: false, error: '全部照片分析失败', failed_paths: failedPaths, model_used: modelUsed }
  return {
    ok: true,
    drafts,
    warnings: failedPaths.length > 0 ? [`${failedPaths.length} 张照片分析失败`] : [],
    failed_paths: failedPaths,
    model_used: modelUsed,
  }
}

async function handleAnalyze(request, ctx) {
  let body
  try {
    body = await request.json()
  } catch {
    return fail(400, '请求体不是 JSON')
  }
  return json(200, await analyzePhotos(body, ctx))
}

async function handleDiscard(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return fail(400, '请求体不是 JSON')
  }
  const packId = typeof body?.pack_id === 'string' ? body.pack_id.trim() : ''
  if (!/^ui-temp-\d+$/.test(packId)) return fail(400, '只允许丢弃 ui-temp-<timestamp> 临时包')
  const photos = await readPhotosJsonl(packId)
  const root = uploadsRoot()
  const deleted = new Set()
  for (const photo of photos) {
    for (const candidate of [photo.source_path, photo.path]) {
      if (typeof candidate !== 'string' || !isAbsolute(candidate)) continue
      if (!isUnder(candidate, root)) continue
      try {
        await unlink(candidate)
        deleted.add(resolve(candidate))
        await removeEmptyParents(candidate, root)
      } catch {
        // 文件已不存在时忽略
      }
    }
  }
  await rm(packDir(packId), { recursive: true, force: true })
  return json(200, { ok: true, pack_id: packId, deleted_uploads: deleted.size })
}

async function confirmObservations(input) {
  const photos = Array.isArray(input?.photos) ? input.photos : []
  if (photos.length === 0) return { ok: false, error: 'photos 不能为空' }
  const anti = (Array.isArray(input?.anti_patterns) ? input.anti_patterns : [])
    .filter(item => typeof item === 'string' && item.trim().length > 0)
    .map(item => item.trim())
  if (anti.length === 0) return { ok: false, error: 'anti_patterns 至少一条' }
  const honestInput = Array.isArray(input?.honest_limits_auto) ? input.honest_limits_auto : []
  const honest = honestInput
    .filter(item => typeof item === 'string' && item.trim().length > 0)
    .map(item => item.trim())
  const honestLimits = honest.length > 0 ? honest : [...HONEST_DEFAULT]

  const packId = typeof input?.pack_id === 'string' && input.pack_id.trim().length > 0
    ? input.pack_id.trim()
    : `ui-temp-${Date.now()}`
  if (!(await packExists(packId))) await createPack(packId, 'UI 临时包', [])

  const existing = await readPhotosJsonl(packId)
  const byId = new Map(existing.map(photo => [photo.photo_id, photo]))
  for (const [index, photo] of photos.entries()) {
    const photoId = typeof photo.photo_id === 'string' && photo.photo_id.trim().length > 0
      ? photo.photo_id.trim()
      : `P${String(index + 1).padStart(2, '0')}`
    const rawPath = String(photo.path ?? '')
    let recordPath = rawPath
    let recordVerified = false
    let sourcePath
    const packRelative = /^\.?\/?photos\/[^/\\]+$/.test(rawPath) && !rawPath.includes('..')
    if (packRelative) {
      recordPath = rawPath.replace(/^\.\//, '')
      recordVerified = await exists(join(packDir(packId), recordPath))
      if (typeof photo.source_path === 'string' && photo.source_path.length > 0) sourcePath = photo.source_path
    } else if (/^([A-Za-z]:[\\/]|\\\\|\/)/.test(rawPath) && (await exists(rawPath))) {
      const ext = extname(rawPath) || '.jpg'
      const dir = join(packDir(packId), 'photos')
      await mkdir(dir, { recursive: true })
      const name = `${safePhotoStem(photoId)}${ext}`
      const dest = join(dir, name)
      try {
        if (resolve(rawPath) !== resolve(dest)) await copyFile(rawPath, dest)
      } catch (error) {
        return {
          ok: false,
          error: `复制照片 ${photoId} 失败：${error instanceof Error ? error.message : String(error)}`,
        }
      }
      recordPath = `photos/${name}`
      recordVerified = true
      sourcePath = rawPath
    }
    const record = {
      photo_id: photoId,
      path: recordPath,
      focus: photo.focus,
      observations: photo.observations,
      evidence_level: 'observed',
      path_verified: recordVerified,
      ...(typeof photo.role === 'string' && photo.role.length > 0 ? { role: photo.role } : {}),
      ...(typeof photo.subject_id === 'string' && photo.subject_id.trim().length > 0 ? { subject_id: photo.subject_id.trim() } : {}),
      ...(sourcePath === undefined ? {} : { source_path: sourcePath }),
    }
    const validated = validatePhotoInput(record)
    if (!validated.ok) {
      return { ok: false, error: `照片 ${record.photo_id} 不合法：${validated.issues.join('；')}`, missing: validated.issues }
    }
    byId.set(validated.value.photo_id, validated.value)
  }
  const lines = [...byId.values()].map(photo => JSON.stringify(photo)).join('\n')
  await writeFile(photosFile(packId), lines.length > 0 ? `${lines}\n` : '', 'utf8')

  const pack = await readPack(packId)
  if (!pack) return { ok: false, error: '包读取失败' }
  pack.anti_patterns = union(pack.anti_patterns, anti)
  pack.honest_limits = union(pack.honest_limits, honestLimits)
  await writePack(packId, pack)

  const merged = [...byId.values()]
  const missing = []
  if (merged.length === 0) missing.push('photos')
  for (const photo of merged) {
    for (const field of photo.focus) {
      const value = observationForFocus(photo, field)
      const empty = value === undefined || (Array.isArray(value) ? value.length === 0 : value.trim().length === 0)
      if (empty) missing.push(`${photo.photo_id}.${field}`)
    }
  }
  if (pack.anti_patterns.length === 0) missing.push('anti_patterns')
  if (pack.honest_limits.length === 0) missing.push('honest_limits')
  if (missing.length > 0) return { ok: false, error: 'validate_failed', missing }

  const guidePack = { ...pack, photos: merged }
  const guide = renderGuide(guidePack, packId)
  const guidePath = join(packDir(packId), `guide-${packId}.md`)
  await writeFile(guidePath, guide.markdown, 'utf8')
  const colors = new Set(merged.flatMap(photo => photo.observations.key_colors ?? []))
  return {
    ok: true,
    pack_id: packId,
    guide_md: guide.markdown,
    guide_path: guidePath,
    summary: {
      decisions: countObservations(merged),
      colors: colors.size,
      warnings: guide.warnings,
    },
  }
}

async function handleConfirm(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return fail(400, '请求体不是 JSON')
  }
  return json(200, await confirmObservations(body))
}

async function listRecent() {
  const root = packRoot()
  let entries
  try {
    entries = await readdir(root, { withFileTypes: true })
  } catch {
    return []
  }
  const packs = []
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '_archive' || entry.name.startsWith('.')) continue
    try {
      const raw = JSON.parse(await readFile(join(root, entry.name, 'pack.json'), 'utf8'))
      packs.push({ pack_id: entry.name, created_at: raw?.meta?.created_at ?? '', mode: 'photo' })
    } catch {
      // 不是合法的包目录
    }
  }
  packs.sort((a, b) => b.created_at.localeCompare(a.created_at))
  return packs.slice(0, 5)
}

export function apply(ctx) {
  ctx.inject(['connection'], scope => {
    const connection = scope.get('connection')
    if (connection === undefined || typeof connection.fetch?.register !== 'function') return
    ctx.effect(() => {
      const routes = [
        connection.fetch.register({ path: UPLOAD_ROUTE, methods: ['POST'], requestBody: 'buffered', fetch: handleUpload }),
        connection.fetch.register({ path: ANALYZE_ROUTE, methods: ['POST'], requestBody: 'buffered', fetch: request => handleAnalyze(request, ctx) }),
        connection.fetch.register({ path: DISCARD_ROUTE, methods: ['POST'], requestBody: 'buffered', fetch: handleDiscard }),
        connection.fetch.register({ path: CONFIRM_ROUTE, methods: ['POST'], requestBody: 'buffered', fetch: handleConfirm }),
      ]
      return () => {
        for (const route of routes) {
          if (typeof route === 'function') route()
          else if (route !== null && typeof route === 'object' && typeof route.dispose === 'function') route.dispose()
        }
      }
    }, 'director-ui: routes')
  })

  ctx.tools.register(defineTool({
    name: 'analyze_photos_draft',
    description:
      'Ask the Host multimodal model to draft observations for uploaded photos. Returns ai_draft entries only; nothing is written to a pack until confirm_observations.',
    parameters: {
      photo_paths: { type: 'array', items: { type: 'string' }, required: true },
      focus_per_photo: { type: 'object', additionalProperties: true },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) =>
        value?.ok === true
          ? text(`已产出 ${String(value.drafts?.length ?? 0)} 条 ai_draft`)
          : text(`分析失败：${String(value?.error ?? '未知错误')}`),
    },
    async execute(args) {
      return analyzePhotos(args, ctx)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'confirm_observations',
    description:
      'Write user-confirmed observations into a photo reference pack, validate it, render the guide, and return its markdown. Anti-patterns are required; honest limits are written verbatim as supplied.',
    parameters: {
      pack_id: { type: 'string', description: 'Optional; defaults to ui-temp-<timestamp>.' },
      photos: {
        type: 'array',
        items: { type: 'object', additionalProperties: true },
        required: true,
        description: 'Each: { photo_id, path, focus[], observations{} }.',
      },
      anti_patterns: { type: 'array', items: { type: 'string' }, required: true },
      honest_limits_auto: { type: 'array', items: { type: 'string' } },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) =>
        value?.ok === true
          ? text(`已生成 ${String(value.pack_id)}：${String(value.guide_path)}`)
          : text(`生成失败：${String(value?.error ?? '未知错误')}${Array.isArray(value?.missing) && value.missing.length > 0 ? `（缺失：${value.missing.join(', ')}）` : ''}`),
    },
    async execute(args) {
      return confirmObservations(args)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'export_guide',
    description: 'Validate a guide markdown and return a download filename plus byte size. Does not write or download files.',
    parameters: {
      guide_md: { type: 'string', required: true },
      filename: { type: 'string', description: 'Default: guide-export.md' },
    },
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) =>
        value?.ok === true
          ? text(`可导出：${String(value.filename)}（${String(value.size_bytes)} 字节）`)
          : text(`导出校验失败：${String(value?.error ?? '未知错误')}`),
    },
    async execute(args) {
      if (typeof args.guide_md !== 'string' || args.guide_md.trim().length === 0) {
        return { ok: false, error: 'guide_md 不能为空' }
      }
      const filename = args.filename?.trim() || 'guide-export.md'
      return { ok: true, filename, size_bytes: Buffer.byteLength(args.guide_md, 'utf8') }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'list_recent_packs',
    description: 'List up to five recent photo reference packs under $DSH_HOME/director-style-packs.',
    parameters: {},
    output: {
      schema: { type: 'object', additionalProperties: true },
      render: (_args, value) => {
        const packs = Array.isArray(value?.packs) ? value.packs : []
        return text(packs.length === 0 ? '最近没有照片参考包。' : packs.map(p => `${p.pack_id}（${p.mode}，${p.created_at}）`).join('\n'))
      },
    },
    async execute() {
      return { packs: await listRecent() }
    },
  }))
}

export { analyzePhotos, confirmObservations, handleAnalyze, handleConfirm, handleDiscard, handleUpload }
