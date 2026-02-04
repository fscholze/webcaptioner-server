import { Response } from 'express'
import axios from 'axios'
import { z } from 'zod'
import { AudioRecord, InputWord } from '../models/audio-record'
import { translationSubscribers } from '../index'
import { calculateQualityFromOriginalTokens } from '../helper/token-quality'

const parseEnvNumber = (value: unknown, fallback: number): number => {
  if (typeof value !== 'string' || !value.trim()) return fallback
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const SotraParamsSchema = z.object({
  model: z.enum(['ctranslate', 'fairseq']),
  text: z.string(),
  sourceLanguage: z.enum(['de', 'hsb']),
  targetLanguage: z.enum(['de', 'hsb']),
  audioRecordId: z.string().optional(),
})
type SotraParams = z.infer<typeof SotraParamsSchema>

type SotraResponse = {
  translation: string
  model: string
}

export const translateViaSotra = (params: SotraParams, response: Response) => {
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
      let responseData: SotraResponse = {
        translation: '',
        model: resp.data.model,
      }

      if (params.model === 'ctranslate') {
        responseData.translation = resp.data.marked_translation.join(' ')
      } else {
        responseData.translation = resp.data.translation
      }

      if (params.audioRecordId) {
        const oldRecord = await AudioRecord.findById(
          params.audioRecordId,
        ).exec()
        const latestOriginalTokens =
          oldRecord?.originalText.at(-1)?.tokens || []

        const { avgConf, spellOk } =
          calculateQualityFromOriginalTokens(latestOriginalTokens)

        const parsedTokens: InputWord[] = responseData.translation
          .split(/\s+/)
          .filter(Boolean)
          .map(token => ({
            word: token,
            conf: avgConf,
            spell: spellOk,
          }))

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
                }),
              )
            }
          }
        }
      }

      return response.status(200).send(JSON.stringify(responseData))
    })
    .catch(error => {
      console.error('Sotra error: ', error.message)
      return response.status(400).send(error.response?.data ?? 'Error')
    })
}
