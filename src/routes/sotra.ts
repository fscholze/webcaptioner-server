import { Response } from 'express'
import axios from 'axios'
import { z } from 'zod'
import { AudioRecord, InputWord } from '../models/audio-record'
import { translationSubscribers } from '../index'
import { projectTranslationConfidences } from '../helper/token-quality'
import { isIncomprehensibleTranscription } from '../helper/transcription-quality'

const SOTRA_MODELS = ['ctranslate', 'fairseq', 'libretranslate'] as const
const SOTRA_TARGET_LANGUAGES = ['de', 'hsb', 'cs', 'dsb'] as const
const LIBRETRANSLATE_TARGET_LANGUAGES = ['en', 'pl'] as const

export const SotraParamsSchema = z
  .object({
    model: z.enum(SOTRA_MODELS),
    text: z.string(),
    sourceLanguage: z.enum(['de', 'hsb']),
    targetLanguage: z.enum([
      ...SOTRA_TARGET_LANGUAGES,
      ...LIBRETRANSLATE_TARGET_LANGUAGES,
    ]),
    audioRecordId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (
      data.model === 'libretranslate' &&
      !LIBRETRANSLATE_TARGET_LANGUAGES.includes(
        data.targetLanguage as (typeof LIBRETRANSLATE_TARGET_LANGUAGES)[number],
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'LibreTranslate only supports target languages: en, pl',
        path: ['targetLanguage'],
      })
    }

    if (
      data.model !== 'libretranslate' &&
      !SOTRA_TARGET_LANGUAGES.includes(
        data.targetLanguage as (typeof SOTRA_TARGET_LANGUAGES)[number],
      )
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Sotra models only support target languages: de, hsb, cs, dsb',
        path: ['targetLanguage'],
      })
    }
  })

type SotraParams = z.infer<typeof SotraParamsSchema>

type SotraResponse = {
  translation: string
  model: string
  translationTokens?: InputWord[]
  originalTokens?: InputWord[]
  playBeep: boolean
}

const processSotraTranslation = async (
  params: SotraParams,
  response: Response,
  translation: string,
  model: string,
) => {
  const playBeep = isIncomprehensibleTranscription(params.text)

  const responseData: SotraResponse = {
    translation,
    model,
    playBeep,
  }

  if (params.audioRecordId) {
    const oldRecord = await AudioRecord.findById(params.audioRecordId).exec()
    const latestOriginalTokens = oldRecord?.originalText.at(-1)?.tokens || []

    const translationWords = responseData.translation
      .split(/\s+/)
      .filter(Boolean)

    const projectedConfs = projectTranslationConfidences(
      latestOriginalTokens,
      translationWords.length,
    )

    const parsedTokens: InputWord[] = translationWords.map((token, index) => ({
      word: token,
      conf: projectedConfs[index] ?? 0,
      spell: (projectedConfs[index] ?? 0) >= 0.5,
    }))

    responseData.translationTokens = parsedTokens
    responseData.originalTokens = latestOriginalTokens

    const updatedRecord = await AudioRecord.findByIdAndUpdate(
      params.audioRecordId,
      {
        $push: {
          translatedText: {
            plain: responseData.translation,
            tokens: parsedTokens,
          },
        },
      },
      { new: true },
    ).exec()

    const newOriginalRecord = updatedRecord?.originalText.at(-1)
    const newTranslationRecord = updatedRecord?.translatedText.at(-1)

    // Notify websocket subscribers
    if (translationSubscribers[params.audioRecordId]) {
      for (const ws of translationSubscribers[params.audioRecordId]) {
        if (ws.readyState === ws.OPEN) {
          ws.send(
            JSON.stringify({
              original: newOriginalRecord?.plain || 'zmylk',
              originalTokens: newOriginalRecord?.tokens || [],
              translation: newTranslationRecord?.plain || 'zmylk',
              translationTokens: newTranslationRecord?.tokens || [],
              playBeep,
            }),
          )
        }
      }
    }
  }

  if (!responseData.translationTokens) {
    responseData.translationTokens = responseData.translation
      .split(/\s+/)
      .filter(Boolean)
      .map(token => ({
        word: token,
        conf: 0,
        spell: true,
      }))
  }

  return response.status(200).send(JSON.stringify(responseData))
}

const translateHsbToGerman = async (text: string): Promise<string> => {
  const data = JSON.stringify({
    text,
    source_language: 'hsb',
    target_language: 'de',
  })

  const resp = await axios.request({
    method: 'post',
    maxBodyLength: Infinity,
    url: `${process.env.SOTRA_SERVER_FAIRSEQ_URL}/translate`,
    headers: {
      'Content-Type': 'application/json',
    },
    data,
  })

  return resp.data.translation
}

const translateViaLibreTranslate = async (
  text: string,
  sourceLanguage: 'de' | 'hsb',
  targetLanguage: 'en' | 'pl',
): Promise<string> => {
  let textToTranslate = text
  let source = sourceLanguage

  if (sourceLanguage === 'hsb') {
    textToTranslate = await translateHsbToGerman(text)
    source = 'de'
  }

  const resp = await axios.request({
    method: 'post',
    maxBodyLength: Infinity,
    timeout: 120_000,
    url: `${process.env.LIBRETRANSLATE_URL}/translate`,
    headers: {
      'Content-Type': 'application/json',
    },
    data: {
      q: textToTranslate,
      source,
      target: targetLanguage,
      format: 'text',
    },
  })

  return resp.data.translatedText
}

export const translateViaSotra = (params: SotraParams, response: Response) => {
  if (params.sourceLanguage === params.targetLanguage) {
    return processSotraTranslation(params, response, params.text, params.model)
  }

  if (params.model === 'libretranslate') {
    return translateViaLibreTranslate(
      params.text,
      params.sourceLanguage,
      params.targetLanguage as 'en' | 'pl',
    )
      .then(translation =>
        processSotraTranslation(
          params,
          response,
          translation,
          'libretranslate',
        ),
      )
      .catch(error => {
        console.error('LibreTranslate error: ', error.message)
        return response.status(200).send(error.response?.data ?? 'Error')
      })
  }

  const data = JSON.stringify({
    text: params.text,
    source_language: params.sourceLanguage,
    target_language: params.targetLanguage,
    audio_record_id: params.audioRecordId,
  })

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${
      params.model === 'ctranslate'
        ? process.env.SOTRA_SERVER_CTRANSLATE_URL
        : process.env.SOTRA_SERVER_FAIRSEQ_URL
    }/translate`,
    headers: {
      'Content-Type': 'application/json',
    },
    data: data,
  }

  return axios
    .request(config)
    .then(async resp => {
      const translation =
        params.model === 'ctranslate'
          ? resp.data.marked_translation.join(' ')
          : resp.data.translation

      return processSotraTranslation(
        params,
        response,
        translation,
        resp.data.model,
      )
    })
    .catch(error => {
      console.error('Sotra error: ', error.message)
      return response.status(200).send(error.response?.data ?? 'Error')
    })
}
