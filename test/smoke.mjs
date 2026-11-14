import assert from 'node:assert/strict'
import { validatePhotoInput } from '../lib/schema.js'
import { renderGuide } from '../lib/guide.js'

const makePack = photos => ({
  meta: {
    director: 'Smoke',
    anchor_works: [],
    sources: { works: [], interviews: [], critics: [], collaborators: [], technical_records: [], timeline: [] },
    version: '0.1.0',
    created_at: '2026-01-01',
  },
  expression_dna: { color_palette: [], lens_grammar: {}, editing_rhythm: {}, sound_design: {} },
  mental_models: [],
  decision_heuristics: [],
  anti_patterns: ['none'],
  honest_limits: ['smoke'],
  photos,
})

const base = {
  photo_id: 'P01',
  path: 'photos/P01.jpg',
  focus: ['color_palette'],
  observations: { key_colors: ['#112233', '#445566'] },
  evidence_level: 'observed',
  path_verified: true,
}

const multi = validatePhotoInput({ ...base, roles: ['atmosphere', 'color'] })
assert.equal(multi.ok, true)
assert.deepEqual(multi.value.roles, ['atmosphere', 'color'])

const legacy = validatePhotoInput({ ...base, role: 'style' })
assert.equal(legacy.ok, true)
assert.deepEqual(legacy.value.roles, ['style'])

const guide = renderGuide(makePack([{ ...base, roles: ['atmosphere', 'color'] }]), 'smoke').markdown
assert.match(guide, /- P01（氛围\/色彩）：\.\/photos\/P01\.jpg/)
const paletteLines = guide.split('\n').filter(line => line.startsWith('色板聚合（P01'))
assert.equal(paletteLines.length, 1)
assert.equal(paletteLines[0], '色板聚合（P01，氛围/色彩）：#112233 / #445566')

const subjectPack = makePack([
  { ...base, photo_id: 'P01', focus: ['subject'], observations: { subject: '甲，正面' }, subject_id: 'A' },
  { ...base, photo_id: 'P02', path: 'photos/P02.jpg', focus: ['subject'], observations: { subject: '甲，侧面' }, subject_id: 'A' },
])
const subjectGuide = renderGuide(subjectPack, 'smoke').markdown
assert.match(subjectGuide, /主体 A（P01\/P02）：甲，正面 \/ 甲，侧面/)

console.log('smoke ok')
