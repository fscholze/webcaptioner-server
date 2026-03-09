import { InputWord } from '../models/audio-record'

const SOTRA_CONF_FALLBACK = 0

export type TokenQuality = {
  avgConf: number
  spellOk: boolean
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value))

const toConfArray = (tokens: InputWord[] | undefined): number[] => {
  const safeTokens = Array.isArray(tokens) ? tokens : []

  return safeTokens
    .map(t => t.conf)
    .filter((c): c is number => typeof c === 'number' && Number.isFinite(c))
    .map(clamp01)
}

const interpolateAt = (values: number[], position: number): number => {
  if (values.length === 0) {
    return SOTRA_CONF_FALLBACK
  }

  const lowerIndex = Math.floor(position)
  const upperIndex = Math.min(values.length - 1, Math.ceil(position))
  const ratio = position - lowerIndex

  const lowerValue = values[Math.max(0, lowerIndex)]
  const upperValue = values[upperIndex]

  return lowerValue * (1 - ratio) + upperValue * ratio
}

const smoothedAt = (values: number[], centerIndex: number): number => {
  const start = Math.max(0, centerIndex - 1)
  const end = Math.min(values.length - 1, centerIndex + 1)
  const window = values.slice(start, end + 1)
  return window.reduce((sum, c) => sum + c, 0) / window.length
}

export const projectTranslationConfidences = (
  originalTokens: InputWord[] | undefined,
  translationLength: number,
): number[] => {
  const confValues = toConfArray(originalTokens)

  if (translationLength <= 0) {
    return []
  }

  if (!confValues.length) {
    return new Array(translationLength).fill(SOTRA_CONF_FALLBACK)
  }

  const firstWindowSize = Math.max(1, Math.ceil(confValues.length * 0.25))
  const firstWindowAvg =
    confValues.slice(0, firstWindowSize).reduce((sum, c) => sum + c, 0) /
    firstWindowSize

  // Penalize translation confidence when the beginning of the original input is weak.
  const headPenaltyBase =
    firstWindowAvg < 0.45 ? (0.45 - firstWindowAvg) * 0.6 : 0

  return new Array(translationLength).fill(0).map((_, index) => {
    const mappedPosition =
      translationLength === 1
        ? (confValues.length - 1) / 2
        : (index / (translationLength - 1)) * (confValues.length - 1)

    const interpolated = interpolateAt(confValues, mappedPosition)
    const localAverage = smoothedAt(confValues, Math.round(mappedPosition))
    const trendAwareConfidence = interpolated * 0.65 + localAverage * 0.35

    const earlyWeight =
      translationLength === 1 ? 1 : 1 - index / (translationLength - 1)
    const adjusted =
      trendAwareConfidence - headPenaltyBase * (0.5 + 0.5 * earlyWeight)

    return clamp01(adjusted)
  })
}

export const calculateQualityFromOriginalTokens = (
  tokens: InputWord[] | undefined,
): TokenQuality => {
  const safeTokens = Array.isArray(tokens) ? tokens : []
  const confValues = toConfArray(tokens)

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

  const spellOk = true

  return { avgConf, spellOk }
}
