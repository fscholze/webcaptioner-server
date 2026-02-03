import { Response } from 'express'
import axios from 'axios'
import { z } from 'zod'
import { AudioRecord } from '../models/audio-record'
import { translationSubscribers } from '../index'
import { InputWordSchema } from '../schemas/audio-record'

export const SotraParamsSchema = z.object({
  model: z.enum(['ctranslate', 'fairseq']),
  text: z.string(),
  sourceLanguage: z.enum(['de', 'hsb']),
  targetLanguage: z.enum(['de', 'hsb']),
  audioRecordId: z.string().optional(),
  // Optional metadata for persistence (word-level Vosk/Whisper output).
  originalTokens: z.array(InputWordSchema).optional(),
})
type SotraParams = z.infer<typeof SotraParamsSchema>

type SotraResponse = {
  translation: string
  model: string
}

const shouldIgnoreTranscriptionText = (plainText: string): boolean => {
  const t = plainText.trim()
  if (!t) return true
  const lower = t.toLowerCase()

  // Ignore known model-load/status banners
  if (lower.includes('ggml-model')) return true
  if (lower.includes('whisper.cpp')) return true
  if (lower.includes('--whisper-')) return true

  // Ignore lines that are only punctuation/whitespace
  const hasAlphaNum = /[\p{L}\p{N}]/u.test(t)
  if (!hasAlphaNum) return true

  return false
}

export const translateViaSotra = (params: SotraParams, response: Response) => {
  if (shouldIgnoreTranscriptionText(params.text)) {
    // Don't call Sotra or persist/broadcast non-transcription status lines.
    return response
      .status(200)
      .send(JSON.stringify({ translation: '', model: params.model }))
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
        await AudioRecord.findByIdAndUpdate(params.audioRecordId, {
          $push: { translatedText: { plain: responseData.translation } },
        }).exec()

        // If the client provides the word-level tokens, attach them to the
        // matching originalText entry (created by /vosk) so DB keeps full shape.
        if (params.originalTokens?.length) {
          const updateResult = await AudioRecord.updateOne(
            { _id: params.audioRecordId },
            { $set: { 'originalText.$[line].tokens': params.originalTokens } },
            {
              arrayFilters: [
                {
                  'line.plain': params.text,
                  'line.tokens': { $exists: false },
                },
              ],
            },
          ).exec()

          if (updateResult.matchedCount === 0) {
            await AudioRecord.updateOne(
              { _id: params.audioRecordId },
              {
                $push: {
                  originalText: {
                    plain: params.text,
                    tokens: params.originalTokens,
                  },
                },
              },
            ).exec()
          }
        }

        // Notify websocket subscribers
        if (translationSubscribers[params.audioRecordId]) {
          for (const ws of translationSubscribers[params.audioRecordId]) {
            if (ws.readyState === ws.OPEN) {
              ws.send(
                JSON.stringify({
                  original: params.text,
                  originalTokens: params.originalTokens,
                  translation: responseData.translation,
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
