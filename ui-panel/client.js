window.__ModuleLoader__.load({
  id: '@local/style-collector',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useRef } = React

    let ReactDOM = null
    try {
      ReactDOM = require('react-dom')
    } catch {
      ReactDOM = null
    }

    const UPLOAD = '/api/director-ui/upload'
    const ANALYZE = '/api/director-ui/analyze'
    const CONFIRM = '/api/director-ui/confirm'
    const DISCARD = '/api/director-ui/discard'
    const CACHE_KEY = 'director-ui-edit-cache-v1'
    const DEFAULT_FOCUS = ['light_direction', 'color_palette', 'composition']
    const ALL_FOCUS = ['light_direction', 'color_palette', 'composition', 'perspective', 'setting', 'material', 'texture', 'atmosphere', 'subject', 'props', 'note']
    const HONEST_LIMITS = ['observations 由用户手动录入并审核确认。']
    const ROLE_OPTIONS = [
      { value: '', label: '未指定用途' },
      { value: 'style', label: '画风' },
      { value: 'lighting', label: '灯光' },
      { value: 'color', label: '色彩' },
      { value: 'composition', label: '构图' },
      { value: 'camera', label: '视角' },
      { value: 'setting', label: '场景' },
      { value: 'material', label: '材质' },
      { value: 'texture', label: '质感' },
      { value: 'atmosphere', label: '氛围' },
      { value: 'subject', label: '人物' },
      { value: 'props', label: '道具' },
      { value: 'note', label: '备注' },
    ]
    const STEPS = ['选图', '关注项', '分析', '审核', '生成', '下载']
    const LABELS = {
      light_direction: '光线',
      color_palette: '色彩',
      composition: '构图',
      perspective: '视角/机位',
      setting: '场景/环境',
      material: '材质',
      texture: '质感/颗粒',
      atmosphere: '氛围',
      subject: '人物/主体',
      props: '道具/陈设',
      note: '备注',
    }
    const FIELD_HINTS = {
      light_direction: '主光方向、硬/软、阴影',
      color_palette: 'hex，逗号分隔，如 #8A6B3F, #1B2A3A',
      composition: '构图、前景、对称、留白',
      perspective: '机位、视角、焦段',
      setting: '场景、环境、地点',
      material: '对象=材料+表面处理+磨损状态；不写光线/构图/氛围',
      texture: '表面粗糙度/纹理尺度/光泽 + 影像颗粒/噪点/锐度',
      atmosphere: '空气介质+能见度+色温倾向+动静；不写光源/时间',
      subject: '是谁、穿什么、姿态、表情',
      props: '道具、陈设',
      note: '一句客观备注',
    }
    const PLACEHOLDERS = {
      light_direction: '主光从右侧窗户来，硬光，暗部保留木纹',
      color_palette: '#8A6B3F, #1B2A3A',
      composition: '中轴对称，门框作为前景',
      perspective: '低角贴地，广角，平视',
      setting: '废弃站台，黄昏，空旷',
      material: '书桌=深胡桃木，哑光打蜡，边缘磨白',
      texture: '岩石粗粝，裂隙 1–3mm，哑光；Kodak Portra 400 细颗粒，暗部轻噪',
      atmosphere: '贴地薄雾，能见度约 200m，冷蓝灰调，无风',
      subject: '中年男性，深灰风衣，站姿，表情克制',
      props: '长椅、旧行李箱、铁栏',
      note: '这一张的关键印象',
    }

    const triggerStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      height: '28px',
      padding: '0 10px',
      borderRadius: '8px',
      border: '1px solid var(--dsw-alias-border-l1)',
      background: 'transparent',
      color: 'var(--dsw-alias-label-secondary, #c9c9c9)',
      font: 'inherit',
      fontSize: '12px',
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    }

    function buttonStyle(kind, disabled) {
      const base = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4px',
        height: '32px',
        padding: '0 14px',
        borderRadius: '8px',
        font: 'inherit',
        fontSize: '12px',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }
      if (kind === 'primary') {
        return { ...base, border: '1px solid transparent', background: 'var(--dsw-alias-brand-primary, #4b7bec)', color: 'var(--dsw-alias-label-on-brand, #fff)' }
      }
      if (kind === 'danger') {
        return { ...base, border: '1px solid transparent', background: 'transparent', color: 'var(--dsw-alias-danger, #e5484d)', padding: '0 8px' }
      }
      return { ...base, border: '1px solid var(--dsw-alias-border-l1)', background: 'var(--dsw-alias-bg-subtle, rgba(127,127,127,0.12))', color: 'var(--dsw-alias-label-primary, #e8e8e8)' }
    }

    const chipStyle = {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 7px',
      borderRadius: '999px',
      background: 'var(--dsw-alias-bg-subtle, rgba(127,127,127,0.16))',
      fontSize: '11px',
    }

    function focusChipStyle(checked) {
      return {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 9px',
        borderRadius: '999px',
        border: checked
          ? '1px solid var(--dsw-alias-brand-primary, #4b7bec)'
          : '1px solid var(--dsw-alias-border-l1)',
        background: checked ? 'rgba(75,123,236,0.14)' : 'transparent',
        color: checked ? 'var(--dsw-alias-brand-primary, #4b7bec)' : 'var(--dsw-alias-label-secondary, #999)',
        fontSize: '11px',
        cursor: 'pointer',
        userSelect: 'none',
        position: 'relative',
      }
    }

    const inputStyle = {
      width: '100%',
      boxSizing: 'border-box',
      padding: '5px 7px',
      borderRadius: '7px',
      border: '1px solid var(--dsw-alias-border-l1)',
      background: 'transparent',
      color: 'inherit',
      font: 'inherit',
      fontSize: '12px',
      resize: 'vertical',
    }

    const metaInputStyle = {
      width: '100%',
      boxSizing: 'border-box',
      padding: '4px 7px',
      marginTop: '6px',
      borderRadius: '7px',
      border: '1px solid var(--dsw-alias-border-l1)',
      background: 'transparent',
      color: 'inherit',
      font: 'inherit',
      fontSize: '11px',
    }

    function parseColors(value) {
      return String(value || '')
        .split(/[,\s]+/)
        .map(item => item.trim())
        .filter(item => /^#[0-9A-Fa-f]{6}$/.test(item))
    }

    function guideSection(markdown, title) {
      const start = markdown.indexOf(title)
      if (start < 0) return ''
      const end = markdown.indexOf('\n## ', start + title.length)
      return markdown.slice(start, end < 0 ? undefined : end).trim()
    }

    function PhotoIcon(props) {
      const size = props && props.size ? props.size : 16
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
      },
        h('rect', { x: 3, y: 5, width: 18, height: 14, rx: 2.5 }),
        h('circle', { cx: 8.5, cy: 10, r: 1.6 }),
        h('path', { d: 'M3.5 16.5l4.5-4.5 4 4 2.5-2.5 6 6' }),
      )
    }

    function CheckIcon(props) {
      const size = props && props.size ? props.size : 12
      return h('svg', {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2.4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
      }, h('path', { d: 'M4 12.5l5 5L20 6.5' }))
    }

    function valuesOf(focus, source) {
      const values = {}
      for (const field of focus) values[field] = String(source?.[field] ?? '')
      return values
    }

    function photoValid(photo) {
      if (!Array.isArray(photo.focus) || photo.focus.length === 0) return false
      return photo.focus.every(field => {
        if (field === 'color_palette') return parseColors(photo.values[field]).length > 0
        return String(photo.values[field] || '').trim().length > 0
      })
    }

    function loadCache() {
      try {
        const raw = window.sessionStorage.getItem(CACHE_KEY)
        if (!raw) return new Map()
        return new Map(Object.entries(JSON.parse(raw)))
      } catch {
        return new Map()
      }
    }

    function PanelBody() {
      const [phase, setPhase] = useState('idle')
      const [photos, setPhotos] = useState([])
      const [anti, setAnti] = useState('')
      const [noAnti, setNoAnti] = useState(false)
      const [guide, setGuide] = useState('')
      const [summary, setSummary] = useState(null)
      const [modelUsed, setModelUsed] = useState('')
      const [packId, setPackId] = useState('')
      const [notice, setNotice] = useState('')
      const [error, setError] = useState('')
      const [errorKind, setErrorKind] = useState('')
      const [analysis, setAnalysis] = useState(null)
      const [open, setOpen] = useState(false)
      const inputRef = useRef(null)
      const uploadAbortRef = useRef(null)
      const analyzeAbortRef = useRef(null)
      const confirmAbortRef = useRef(null)
      const cancelAnalyzeRef = useRef(false)
      const cacheRef = useRef(loadCache())
      const sessionRef = useRef(0)

      const persist = photo => {
        cacheRef.current.set(photo.path, {
          focus: [...photo.focus],
          values: { ...photo.values },
          roles: Array.isArray(photo.roles) ? [...photo.roles] : (photo.role ? [photo.role] : []),
          subject_id: photo.subject_id || '',
        })
        try {
          window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(cacheRef.current)))
        } catch {
          // 存储不可用时只保留内存缓存
        }
      }

      const revokePreviews = list => {
        for (const photo of list) {
          if (photo.previewUrl && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(photo.previewUrl)
        }
      }

      const pick = () => {
        setError('')
        if (inputRef.current) inputRef.current.click()
      }

      const reset = (clearCache = false) => {
        revokePreviews(photos)
        if (clearCache) {
          if (packId) {
            fetch(DISCARD, {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ pack_id: packId }),
            }).catch(() => {})
          }
          cacheRef.current.clear()
          try {
            window.sessionStorage.removeItem(CACHE_KEY)
          } catch {
            // ignore
          }
        }
        setPackId('')
        setPhotos([])
        setAnti('')
        setNoAnti(false)
        setGuide('')
        setSummary(null)
        setModelUsed('')
        setNotice('')
        setError('')
        setErrorKind('')
        setAnalysis(null)
        setPhase('idle')
      }

      const closePanel = () => {
        sessionRef.current += 1
        uploadAbortRef.current?.abort()
        analyzeAbortRef.current?.abort()
        confirmAbortRef.current?.abort()
        revokePreviews(photos)
        setPhotos([])
        setPhase('idle')
        setGuide('')
        setSummary(null)
        setModelUsed('')
        setNotice('')
        setError('')
        setErrorKind('')
        setAnalysis(null)
        setAnti('')
        setNoAnti(false)
        setPackId('')
        setOpen(false)
      }

      const failWith = (kind, message) => {
        setErrorKind(kind)
        setError(message)
        setPhase('error')
      }

      const mutatePhoto = (index, updater) => {
        setPhotos(prev => {
          const next = prev.map((photo, i) => (i === index ? updater(photo) : photo))
          const changed = next[index]
          if (changed) persist(changed)
          return next
        })
      }

      const applyDraft = (photo, draft) => {
        const focus = Array.isArray(draft.focus) && draft.focus.length > 0 ? [...draft.focus] : [...DEFAULT_FOCUS]
        const values = {}
        for (const field of focus) {
          values[field] = field === 'color_palette'
            ? (Array.isArray(draft.observations?.key_colors) ? draft.observations.key_colors.join(', ') : '')
            : String(draft.observations?.[field] || '')
        }
        return { ...photo, focus, values, status: 'done', error: '', retried: false }
      }

      const analyzeIndices = async (indices, list) => {
        if (indices.length === 0) {
          setPhase('reviewing')
          return
        }
        cancelAnalyzeRef.current = false
        const run = sessionRef.current
        setPhase('analyzing')
        setError('')
        setNotice('')
        for (const [position, index] of indices.entries()) {
          if (cancelAnalyzeRef.current) break
          if (position > 0) await new Promise(resolve => setTimeout(resolve, 1200))
          if (cancelAnalyzeRef.current) break
          setAnalysis({ current: position + 1, total: indices.length })
          mutatePhoto(index, photo => ({ ...photo, status: 'analyzing', error: '' }))
          const controller = new AbortController()
          analyzeAbortRef.current = controller
          try {
            const response = await fetch(ANALYZE, {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                photo_paths: [list[index].path],
                focus_per_photo: { [list[index].path]: list[index].focus },
              }),
              signal: controller.signal,
            })
            const data = await response.json().catch(() => null)
            if (run !== sessionRef.current) return
            if (data && typeof data.model_used === 'string' && data.model_used.length > 0) setModelUsed(data.model_used)
            const draft = data && Array.isArray(data.drafts) ? data.drafts[0] : undefined
            if (!response.ok || !data || data.ok !== true || draft === undefined) {
              const detail = (data && data.failed_paths && data.failed_paths[0] && data.failed_paths[0].error)
                || (data && data.error)
                || `分析失败：HTTP ${response.status}`
              mutatePhoto(index, photo => ({
                ...photo,
                status: 'failed',
                error: String(detail),
                retried: Boolean(data && data.failed_paths && data.failed_paths[0] && data.failed_paths[0].retried),
              }))
            } else {
              mutatePhoto(index, photo => applyDraft(photo, draft))
            }
          } catch (err) {
            if (run !== sessionRef.current) return
            if (err && err.name === 'AbortError') {
              mutatePhoto(index, photo => ({ ...photo, status: 'pending' }))
              break
            }
            mutatePhoto(index, photo => ({ ...photo, status: 'failed', error: err instanceof Error ? err.message : String(err) }))
          }
        }
        if (run !== sessionRef.current) return
        setAnalysis(null)
        analyzeAbortRef.current = null
        setPhase('reviewing')
        if (cancelAnalyzeRef.current) setNotice('分析已取消；已完成的照片保留，其余可单独重试。')
      }

      const retryIndices = indices => {
        if (indices.length === 0) return
        analyzeIndices(indices, photos)
      }

      const cancelAnalysis = () => {
        cancelAnalyzeRef.current = true
        if (analyzeAbortRef.current) analyzeAbortRef.current.abort()
      }

      const onFiles = async event => {
        const list = Array.from(event.target.files || [])
        event.target.value = ''
        if (list.length === 0) return
        const run = sessionRef.current
        revokePreviews(photos)
        setGuide('')
        setSummary(null)
        setModelUsed('')
        setError('')
        setNotice('')
        setPhase('uploading')
        const controller = new AbortController()
        uploadAbortRef.current = controller
        const form = new FormData()
        for (const file of list) form.append('files', file)
        try {
          const response = await fetch(UPLOAD, { method: 'POST', body: form, credentials: 'same-origin', signal: controller.signal })
          const data = await response.json().catch(() => null)
          if (run !== sessionRef.current) return
          if (!response.ok || data === null || data.ok !== true || !Array.isArray(data.paths)) {
            failWith('upload', (data && data.error) || `上传失败：HTTP ${response.status}`)
            return
          }
          const previews = list.map(file => URL.createObjectURL(file))
          const next = data.paths.map((path, index) => {
            const cached = cacheRef.current.get(path)
            const focus = Array.isArray(cached?.focus) && cached.focus.length > 0 ? [...cached.focus] : [...DEFAULT_FOCUS]
            const values = valuesOf(focus, cached?.values)
            const restored = photoValid({ focus, values })
            return {
              path,
              previewUrl: previews[index] || '',
              focus,
              values,
              roles: Array.isArray(cached?.roles)
                ? cached.roles.filter(value => ROLE_OPTIONS.some(option => option.value === value))
                : (typeof cached?.role === 'string' && cached.role ? [cached.role] : []),
              subject_id: typeof cached?.subject_id === 'string' ? cached.subject_id : '',
              status: restored ? 'done' : 'pending',
              error: '',
              retried: false,
            }
          })
          setPhotos(next)
          setNotice('已上传；请为每张图选择关注项，再点“开始分析”。已填过的照片会自动恢复。')
          setPhase('reviewing')
        } catch (err) {
          if (run !== sessionRef.current) return
          if (err && err.name === 'AbortError') {
            setPhase('idle')
            setNotice('已取消上传。')
            return
          }
          failWith('upload', err instanceof Error ? err.message : String(err))
        } finally {
          uploadAbortRef.current = null
        }
      }

      const setValue = (index, field, value) => {
        mutatePhoto(index, photo => ({ ...photo, values: { ...photo.values, [field]: value } }))
      }

      const addFocus = (index, field) => {
        mutatePhoto(index, photo => {
          if (photo.focus.includes(field)) return photo
          return { ...photo, focus: [...photo.focus, field], values: { ...photo.values, [field]: '' } }
        })
      }

      const toggleRole = (index, value) => {
        mutatePhoto(index, photo => {
          const current = Array.isArray(photo.roles) ? [...photo.roles] : (photo.role ? [photo.role] : [])
          const roles = current.includes(value)
            ? current.filter(item => item !== value)
            : [...current, value]
          return { ...photo, roles }
        })
      }

      const removeFocus = (index, field) => {
        mutatePhoto(index, photo => {
          const values = { ...photo.values }
          delete values[field]
          return {
            ...photo,
            focus: photo.focus.filter(item => item !== field),
            values,
            ...(field === 'subject' ? { subject_id: '' } : {}),
          }
        })
      }

      const confirm = async () => {
        if (!photos.every(photoValid)) return
        const antiPatterns = noAnti
          ? ['本包无反模式（用户明确声明）']
          : anti.split('\n').map(item => item.trim()).filter(Boolean)
        if (antiPatterns.length === 0) return
        setPhase('confirming')
        setError('')
        const run = sessionRef.current
        const controller = new AbortController()
        confirmAbortRef.current = controller
        const payloadPhotos = photos.map((photo, index) => {
          const observations = {}
          for (const field of photo.focus) {
            if (field === 'color_palette') observations.key_colors = parseColors(photo.values[field])
            else observations[field] = String(photo.values[field] || '').trim()
          }
          return {
            photo_id: `P${String(index + 1).padStart(2, '0')}`,
            path: photo.path,
            focus: photo.focus,
            observations,
            ...(photo.role ? { role: photo.role } : {}),
            ...(Array.isArray(photo.roles) && photo.roles.length > 0 ? { roles: photo.roles } : {}),
            ...(photo.focus.includes('subject') && photo.subject_id && photo.subject_id.trim().length > 0
              ? { subject_id: photo.subject_id.trim() }
              : {}),
          }
        })
        try {
          const response = await fetch(CONFIRM, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              photos: payloadPhotos,
              anti_patterns: antiPatterns,
              honest_limits_auto: HONEST_LIMITS,
            }),
            signal: controller.signal,
          })
          const data = await response.json().catch(() => null)
          if (run !== sessionRef.current) return
          if (!response.ok || data === null || data.ok !== true) {
            const missing = data && Array.isArray(data.missing) && data.missing.length > 0
              ? `（缺失：${data.missing.join(', ')}）`
              : ''
            failWith('confirm', `${(data && data.error) || `生成失败：HTTP ${response.status}`}${missing}`)
            return
          }
          setGuide(typeof data.guide_md === 'string' ? data.guide_md : '')
          setSummary(data.summary || null)
          setPackId(typeof data.pack_id === 'string' ? data.pack_id : '')
          setPhase('preview')
        } catch (err) {
          if (run !== sessionRef.current) return
          if (err && err.name === 'AbortError') {
            setPhase('reviewing')
            return
          }
          failWith('confirm', err instanceof Error ? err.message : String(err))
        } finally {
          confirmAbortRef.current = null
        }
      }

      const download = () => {
        const blob = new Blob([guide], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `guide-${Date.now()}.md`
        anchor.click()
        URL.revokeObjectURL(url)
      }

      const failedIndices = photos.map((photo, index) => (photo.status === 'failed' ? index : -1)).filter(index => index >= 0)
      const pendingIndices = photos.map((photo, index) => (photo.status === 'pending' ? index : -1)).filter(index => index >= 0)
      const needAnalyze = [...pendingIndices, ...failedIndices]
      const allPhotosValid = photos.length > 0 && photos.every(photoValid)
      const anyEmptyFocus = photos.some(photo => photo.focus.length === 0)
      const antiValid = noAnti || anti.trim().length > 0
      const canConfirm = phase === 'reviewing' && allPhotosValid && antiValid
      const decisions = summary && Number.isFinite(summary.decisions) ? summary.decisions : 0
      const colors = summary && Number.isFinite(summary.colors) ? summary.colors : 0
      const warnings = summary && Array.isArray(summary.warnings) ? summary.warnings : []
      const hasAnalyzed = photos.some(photo => photo.status === 'done' || photo.status === 'manual' || photo.status === 'failed')
      const stepIndex = phase === 'uploading' || phase === 'idle'
        ? 0
        : phase === 'analyzing'
          ? 2
          : phase === 'reviewing'
            ? (hasAnalyzed ? 3 : 1)
            : phase === 'confirming'
              ? 4
              : phase === 'preview'
                ? 5
                : phase === 'done'
                  ? 5
                  : errorKind === 'upload'
                  ? 0
                  : errorKind === 'analyze'
                    ? 2
                    : errorKind === 'confirm'
                      ? 4
                      : (hasAnalyzed ? 3 : 1)

      const body = []

      if (phase === 'idle') {
        body.push(
          h('div', { key: 'empty', style: { textAlign: 'center', padding: '28px 12px' } },
            h('div', {
              style: {
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                background: 'rgba(75,123,236,0.12)',
                color: 'var(--dsw-alias-brand-primary, #4b7bec)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
              },
            }, h(PhotoIcon, { size: 26 })),
            h('div', { style: { fontWeight: 700, fontSize: '14px', marginBottom: '4px' } }, '导入 2–3 张参考照片'),
            h('div', { style: { opacity: 0.7, marginBottom: '18px' } }, '上传后先勾选关注项，再由 Host 多模态模型逐张分析。'),
            h('button', { type: 'button', style: buttonStyle('primary', false), onClick: pick }, h(PhotoIcon, { size: 15 }), '选择照片'),
          ),
        )
      }

      if (phase === 'uploading') {
        body.push(
          h('div', { key: 'up', style: { padding: '32px', textAlign: 'center' } },
            h('div', { style: { fontWeight: 600, marginBottom: '12px' } }, '📤 上传照片中...'),
            h('button', { type: 'button', style: buttonStyle('secondary', false), onClick: () => uploadAbortRef.current?.abort() }, '取消上传'),
          ),
        )
      }

      if (phase === 'analyzing') {
        const percent = analysis && analysis.total > 0 ? Math.round((analysis.current / analysis.total) * 100) : 0
        body.push(
          h('div', { key: 'progress', style: { marginBottom: '10px' } },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', fontWeight: 600, marginBottom: '6px' } },
              h('span', null, analysis ? `第 ${analysis.current}/${analysis.total} 张分析中…` : '分析中…'),
              h('span', { style: { opacity: 0.6 } }, `${percent}%`),
            ),
            h('div', { style: { height: '6px', borderRadius: '3px', background: 'var(--dsw-alias-bg-subtle, rgba(127,127,127,0.18))', overflow: 'hidden' } },
              h('div', { style: { width: `${percent}%`, height: '100%', borderRadius: '3px', background: 'var(--dsw-alias-brand-primary, #4b7bec)', transition: 'width .2s' } }),
            ),
          ),
        )
        for (const [index, photo] of photos.entries()) {
          body.push(
            h('div', {
              key: `an-${index}`,
              style: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', marginBottom: '6px', borderRadius: '10px', border: '1px solid var(--dsw-alias-border-l1)' },
            },
              photo.previewUrl
                ? h('img', { src: photo.previewUrl, alt: '', style: { width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px' } })
                : null,
              h('div', { style: { flex: 1 } }, `P${String(index + 1).padStart(2, '0')}`),
              h('div', { style: { opacity: 0.8 } },
                photo.status === 'analyzing' ? '⏳ 分析中' : photo.status === 'done' ? '✓ 完成' : photo.status === 'failed' ? '✗ 失败' : '待分析'),
            ),
          )
        }
        body.push(
          h('div', { key: 'cancel', style: { marginTop: '10px', textAlign: 'right' } },
            h('button', { type: 'button', style: buttonStyle('secondary', false), onClick: cancelAnalysis }, '取消分析'),
          ),
        )
      }

      if (phase === 'reviewing' || phase === 'confirming') {
        body.push(
          h('div', { key: 'banner', style: { padding: '8px 10px', borderRadius: '8px', background: 'var(--dsw-alias-bg-subtle, rgba(127,127,127,0.12))', marginBottom: '10px' } },
            h('div', { style: { fontWeight: 600 } }, '配置关注项并核对 AI 观察'),
            h('div', { style: { opacity: 0.75, marginTop: '2px' } }, '每张图可指定不同关注项，AI 只分析你勾选的项。'),
            modelUsed
              ? h('div', { style: { opacity: 0.6, marginTop: '2px' } }, `本次分析使用：${modelUsed}`)
              : null,
            h('div', { style: { opacity: 0.75, marginTop: '2px' } }, '只有点“确认全部并生成 guide”才会写入采集端；未确认内容不会落库。'),
            anyEmptyFocus
              ? h('div', { style: { color: 'var(--dsw-alias-danger, #e5484d)', marginTop: '4px', fontWeight: 600 } }, '请为每张图至少选一个关注项')
              : null,
            notice.length > 0 ? h('div', { style: { color: 'var(--dsw-alias-warning, #d99a2b)', marginTop: '4px' } }, notice) : null,
          ),
        )

        for (const [index, photo] of photos.entries()) {
          const isFailed = photo.status === 'failed'
          const showForm = photo.status !== 'failed'
          body.push(
            h('div', {
              key: `photo-${index}`,
              style: {
                padding: '12px',
                marginBottom: '10px',
                borderRadius: '10px',
                border: isFailed || photo.focus.length === 0 ? '1px solid #ff4d4f' : '1px solid var(--dsw-alias-border-l1)',
                background: isFailed ? 'rgba(255,77,79,0.08)' : 'var(--dsw-alias-bg-subtle, rgba(127,127,127,0.08))',
              },
            },
              h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' } },
                photo.previewUrl
                  ? h('img', { src: photo.previewUrl, alt: '', style: { width: '72px', height: '72px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--dsw-alias-border-l1)', flexShrink: 0 } })
                  : h('div', { style: { width: '72px', height: '72px', borderRadius: '8px', border: '1px solid var(--dsw-alias-border-l1)', flexShrink: 0 } }),
                h('div', { style: { flex: 1, minWidth: 0 } },
                  h('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' } },
                    h('strong', { style: { fontSize: '13px' } }, `P${String(index + 1).padStart(2, '0')}`),
                    isFailed
                      ? h('span', { style: { color: '#ff4d4f', fontWeight: 600 } }, '⚠ 分析失败')
                      : photo.status === 'manual'
                        ? h('span', { style: { opacity: 0.65 } }, '手动填写')
                        : photo.status === 'done'
                          ? h('span', { style: { color: '#2bb673' } }, '✓ AI 已填')
                          : h('span', { style: { opacity: 0.6 } }, '待分析'),
                  ),
                  h('div', { style: { opacity: 0.6, fontSize: '11px', marginTop: '2px' } }, `关注项 ${photo.focus.length} 项`),
                  h('div', { style: { marginTop: '6px' } },
                    h('div', { style: { fontSize: '10px', opacity: 0.6, marginBottom: '3px' } }, '用途（可多选，也可不选）'),
                    h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' } },
                      ...ROLE_OPTIONS.filter(option => option.value).map(option => {
                        const active = (Array.isArray(photo.roles) ? photo.roles : (photo.role ? [photo.role] : [])).includes(option.value)
                        return h('button', {
                          key: option.value,
                          type: 'button',
                          style: focusChipStyle(active),
                          onClick: () => toggleRole(index, option.value),
                        }, option.label)
                      }),
                    ),
                  ),
                  photo.focus.includes('subject')
                    ? h('input', {
                      value: photo.subject_id || '',
                      placeholder: '主体编号（同一人物填相同编号，如 A）',
                      style: metaInputStyle,
                      onChange: event => mutatePhoto(index, item => ({ ...item, subject_id: event.target.value })),
                    })
                    : null,
                ),
              ),
              isFailed
                ? h('div', { style: { color: 'var(--dsw-alias-label-secondary, #999)', marginBottom: '8px' } },
                  `分析失败：${photo.error || '未知错误'}${photo.retried ? '（已自动重试）' : ''}`)
                : null,
              isFailed && !showForm
                ? h('div', { style: { display: 'flex', gap: '8px', marginBottom: '8px' } },
                  h('button', { type: 'button', style: buttonStyle('primary', false), onClick: () => analyzeIndices([index], photos) }, '重试分析'),
                  h('button', { type: 'button', style: buttonStyle('secondary', false), onClick: () => mutatePhoto(index, item => ({ ...item, status: 'manual' })) }, '手动填写'),
                )
                : null,
              h('div', { style: { marginBottom: '8px' } },
                h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } },
                  ...ALL_FOCUS.map(field => {
                    const checked = photo.focus.includes(field)
                    return h('label', { key: field, style: focusChipStyle(checked) },
                      h('input', {
                        type: 'checkbox',
                        checked,
                        onChange: event => (event.target.checked ? addFocus(index, field) : removeFocus(index, field)),
                        style: { position: 'absolute', opacity: 0, width: 0, height: 0 },
                      }),
                      checked ? h(CheckIcon, { size: 10 }) : null,
                      LABELS[field],
                    )
                  }),
                ),
              ),
              showForm
                ? h('div', null,
                  h('div', { style: { fontSize: '11px', opacity: 0.6, marginBottom: '4px' } },
                    photo.status === 'done' ? 'AI 观察（可编辑）' : photo.status === 'manual' ? '手动填写内容' : '观察内容（可编辑）'),
                  h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
                    photo.focus.map(field =>
                      h('div', {
                        key: `${index}-${field}`,
                        style: {
                          padding: '8px',
                          borderRadius: '8px',
                          border: '1px solid var(--dsw-alias-border-l1)',
                          background: 'var(--dsw-alias-bg-base, rgba(127,127,127,0.04))',
                        },
                      },
                        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' } },
                          h('div', { style: { fontWeight: 600, fontSize: '12px' } }, LABELS[field]),
                          h('code', {
                            style: {
                              fontSize: '10px',
                              opacity: 0.55,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: 'var(--dsw-alias-bg-subtle, rgba(127,127,127,0.16))',
                            },
                          }, field),
                        ),
                        FIELD_HINTS[field]
                          ? h('div', { style: { fontSize: '10px', opacity: 0.55, marginBottom: '4px' } }, FIELD_HINTS[field])
                          : null,
                        h('textarea', {
                          value: photo.values[field] || '',
                          rows: 2,
                          placeholder: PLACEHOLDERS[field],
                          style: inputStyle,
                          onChange: event => setValue(index, field, event.target.value),
                        }),
                      ),
                    ),
                  ),
                )
                : null,
            ),
          )
        }

        body.push(
          h('div', {
            key: 'anti',
            style: {
              padding: '12px',
              borderRadius: '10px',
              border: '1px solid var(--dsw-alias-border-l1)',
              background: 'var(--dsw-alias-bg-subtle, rgba(127,127,127,0.06))',
            },
          },
            h('div', { style: { fontWeight: 600, marginBottom: '4px' } }, '反模式（必填）'),
            h('div', { style: { opacity: 0.65, marginBottom: '6px' } }, '告诉消费端“不要什么”；勾选“本包明确无反模式”可跳过。'),
            h('textarea', {
              value: noAnti ? '本包无反模式（用户明确声明）' : anti,
              rows: 2,
              disabled: noAnti,
              placeholder: '例如：不要高饱和红金色块 / 不要仪式化对称构图',
              style: { ...inputStyle, opacity: noAnti ? 0.6 : 1 },
              onChange: event => setAnti(event.target.value),
            }),
            h('label', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', opacity: 0.85 } },
              h('input', { type: 'checkbox', checked: noAnti, onChange: event => setNoAnti(event.target.checked) }),
              '本包明确无反模式',
            ),
          ),
        )
      }

      if (phase === 'preview') {
        const section4 = guideSection(guide, '## 4.')
        const section7 = guideSection(guide, '## 7.')
        const previewBoxStyle = {
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          font: 'inherit',
          fontSize: '11px',
          lineHeight: 1.55,
          maxHeight: '26vh',
          overflow: 'auto',
          padding: '8px',
          borderRadius: '8px',
          border: '1px solid var(--dsw-alias-border-l1)',
          background: 'var(--dsw-alias-bg-subtle, rgba(127,127,127,0.08))',
          margin: 0,
        }
        body.push(
          h('div', { key: 'preview' },
            h('div', { style: { fontWeight: 700, fontSize: '14px', marginBottom: '4px' } }, '下载前预览'),
            h('div', { style: { opacity: 0.7, marginBottom: '10px' } }, '只显示 §4 与 §7；确认后下载完整 guide。'),
            h('div', { style: { marginBottom: '10px' } },
              h('div', { style: { fontWeight: 600, marginBottom: '4px' } }, '§4 呼吸感与环境动态'),
              h('pre', { style: previewBoxStyle }, section4.length > 0 ? section4 : '（缺失）'),
            ),
            h('div', null,
              h('div', { style: { fontWeight: 600, marginBottom: '4px' } }, '§7 补充规则'),
              h('pre', { style: previewBoxStyle }, section7.length > 0 ? section7 : '（缺失）'),
            ),
          ),
        )
      }

      if (phase === 'done') {
        body.push(
          h('div', { key: 'done', style: { textAlign: 'center', padding: '20px 8px' } },
            h('div', {
              style: {
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(43,182,115,0.14)',
                color: '#2bb673',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px',
              },
            }, h(CheckIcon, { size: 24 })),
            h('div', { style: { fontWeight: 700, fontSize: '14px' } }, `提取了 ${decisions} 条规则，${colors} 个色板`),
            h('div', { style: { opacity: 0.7, marginTop: '4px' } }, warnings.length > 0 ? `${warnings.length} 条待采集提醒` : '无待采集提醒'),
          ),
        )
      }

      if (phase === 'error') {
        body.push(
          h('div', { key: 'err', style: { textAlign: 'center', padding: '24px 8px' } },
            h('div', {
              style: {
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                background: 'rgba(229,72,77,0.12)',
                color: 'var(--dsw-alias-danger, #e5484d)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '10px',
                fontWeight: 800,
                fontSize: '20px',
              },
            }, '!'),
            h('div', { style: { color: 'var(--dsw-alias-danger, #d33)', wordBreak: 'break-word', marginBottom: '14px' } }, error),
            h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center' } },
              h('button', {
                type: 'button',
                style: buttonStyle('secondary', false),
                onClick: () => {
                  setError('')
                  if (photos.length > 0) setPhase('reviewing')
                  else reset()
                },
              }, '返回修改'),
              h('button', {
                type: 'button',
                style: buttonStyle('primary', false),
                onClick: () => {
                  setError('')
                  if (errorKind === 'upload') pick()
                  else if (errorKind === 'confirm') confirm()
                  else {
                    const targets = photos.map((photo, index) => (photo.status === 'failed' || photo.status === 'pending' ? index : -1)).filter(index => index >= 0)
                    retryIndices(targets.length > 0 ? targets : photos.map((_, index) => index))
                  }
                },
              }, '重试'),
            ),
          ),
        )
      }

      const footer = []
      if (phase === 'reviewing' || phase === 'confirming') {
        footer.push(
          h('button', { key: 'reselect', type: 'button', style: buttonStyle('danger', phase === 'confirming'), disabled: phase === 'confirming', onClick: () => setPhase('idle') }, '重新选图'),
        )
        if (phase === 'confirming') {
          footer.push(
            h('button', { key: 'back', type: 'button', style: buttonStyle('secondary', false), onClick: () => confirmAbortRef.current?.abort() }, '返回修改'),
            h('button', { key: 'busy', type: 'button', style: buttonStyle('primary', true), disabled: true }, '正在生成 guide...'),
          )
        } else {
          footer.push(
            needAnalyze.length > 0
              ? h('button', {
                key: 'analyze',
                type: 'button',
                style: buttonStyle(canConfirm ? 'secondary' : 'primary', false),
                onClick: () => analyzeIndices(needAnalyze, photos),
              }, `🔍 开始分析（${needAnalyze.length}）`)
              : h('button', {
                key: 'reanalyze',
                type: 'button',
                style: buttonStyle('secondary', false),
                onClick: () => analyzeIndices(photos.map((_, index) => index), photos),
              }, '重新分析全部'),
            h('button', { key: 'ok', type: 'button', style: buttonStyle(canConfirm ? 'primary' : 'secondary', !canConfirm), disabled: !canConfirm, onClick: confirm }, '确认全部并生成 guide'),
          )
        }
      }
      if (phase === 'preview') {
        footer.push(
          h('button', { key: 'back', type: 'button', style: buttonStyle('secondary', false), onClick: () => setPhase('reviewing') }, '返回修改'),
          h('button', {
            key: 'confirm-download',
            type: 'button',
            style: buttonStyle('primary', false),
            onClick: () => {
              download()
              setPhase('done')
            },
          }, '确认下载'),
        )
      }
      if (phase === 'done') {
        footer.push(
          h('button', { key: 'dl', type: 'button', style: buttonStyle('primary', false), onClick: download }, '📤 导出指导书'),
          h('button', { key: 'restart', type: 'button', style: buttonStyle('danger', false), onClick: () => reset(true) }, '重新开始'),
        )
      }

      const card = h('div', {
        style: {
          width: 'min(820px, 94vw)',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          border: '1px solid var(--dsw-alias-border-l1)',
          background: 'var(--dsw-alias-bg-base, #1b1f24)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
          color: 'var(--dsw-alias-label-primary, #f2f2f2)',
          fontSize: '12px',
          overflow: 'hidden',
        },
        onClick: event => event.stopPropagation(),
      },
        h('div', { style: { padding: '14px 16px 10px', borderBottom: '1px solid var(--dsw-alias-border-l1)' } },
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
              h('div', {
                style: {
                  width: '34px',
                  height: '34px',
                  borderRadius: '10px',
                  background: 'var(--dsw-alias-brand-primary, #4b7bec)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                },
              }, h(PhotoIcon, { size: 18 })),
              h('div', null,
                h('div', { style: { fontWeight: 700, fontSize: '14px' } }, '风格采集器'),
                h('div', { style: { opacity: 0.65, marginTop: '2px' } }, '照片 → AI 候选观察 → 人工核对 → guide'),
              ),
            ),
            h('button', { type: 'button', style: { ...buttonStyle('secondary', false), height: '26px', padding: '0 10px' }, onClick: closePanel }, '关闭'),
          ),
          h('div', { style: { display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' } },
            ...STEPS.map((label, index) => {
              const done = index < stepIndex
              const active = index === stepIndex
              return h('span', {
                key: label,
                style: {
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  background: active ? 'var(--dsw-alias-brand-primary, #4b7bec)' : 'transparent',
                  color: active ? '#fff' : 'var(--dsw-alias-label-secondary, #999)',
                  border: active ? '1px solid transparent' : '1px solid var(--dsw-alias-border-l1)',
                  opacity: done ? 0.85 : 1,
                },
              }, `${done ? '✓' : index + 1} ${label}`)
            }),
          ),
        ),
        h('div', { style: { padding: '14px 16px', overflow: 'auto', flex: 1, minHeight: 0 } }, ...body),
        footer.length > 0
          ? h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 16px', borderTop: '1px solid var(--dsw-alias-border-l1)', flexWrap: 'wrap' } }, ...footer)
          : null,
        h('input', {
          ref: inputRef,
          type: 'file',
          multiple: true,
          accept: 'image/*',
          style: { display: 'none' },
          onChange: onFiles,
        }),
      )

      const overlay = h('div', {
        style: {
          position: 'fixed',
          inset: 0,
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'rgba(0,0,0,0.45)',
        },
        onClick: closePanel,
      }, card)

      const portal = ReactDOM && typeof ReactDOM.createPortal === 'function' && typeof document !== 'undefined'
        ? ReactDOM.createPortal(overlay, document.body)
        : overlay

      return h(React.Fragment, null,
        h('button', {
          type: 'button',
          style: triggerStyle,
          title: '导入参考照片',
          onClick: () => {
            if (open) {
              closePanel()
              return
            }
            sessionRef.current += 1
            setOpen(true)
          },
        }, h(PhotoIcon, { size: 15 }), '导入照片'),
        open ? portal : null,
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('conversation.input.left', () =>
          ctx.slots.register(
            {
              name: 'conversation.input.left',
              id: 'director-ui-panel',
              order: 100,
            },
            PanelBody,
          ),
        )
      },
    }
  },
})
