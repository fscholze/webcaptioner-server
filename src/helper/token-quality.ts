import { InputWord } from '../models/audio-record'

const SOTRA_SPELL_CONF_THRESHOLD = 0.6
const SOTRA_MISSPELL_RATIO_THRESHOLD = 0
const SOTRA_CONF_FALLBACK = 0

export type TokenQuality = {
  avgConf: number
  spellOk: boolean
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

export const calculateQualityFromOriginalTokens = (
  tokens: InputWord[] | undefined,
): TokenQuality => {
  const safeTokens = Array.isArray(tokens) ? tokens : []

  const confValues = safeTokens
    .map(t => t.conf)
    .filter((c): c is number => typeof c === 'number' && Number.isFinite(c))
    .map(clamp01)

  const avgConf = confValues.length
    ? confValues.reduce((sum, c) => sum + c, 0) / confValues.length
    : SOTRA_CONF_FALLBACK

  const spellValues = safeTokens
    .map(t => t.spell)
    .filter((s): s is boolean => typeof s === 'boolean')

  const misspellCount = spellValues.filter(s => s === false).length
  const misspellRatio = spellValues.length
    ? misspellCount / spellValues.length
    : 0

  const spellOk =
    avgConf >= SOTRA_SPELL_CONF_THRESHOLD &&
    misspellRatio <= SOTRA_MISSPELL_RATIO_THRESHOLD

  return { avgConf, spellOk }
}
