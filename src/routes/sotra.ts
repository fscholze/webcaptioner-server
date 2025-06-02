import { Response } from 'express'
import axios from 'axios'
import { z } from 'zod'
import { AudioRecord } from '../models/audio-record'

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
        await AudioRecord.findByIdAndUpdate(params.audioRecordId, {
          $push: { translatedText: responseData.translation },
        })
      }

      return response.status(200).send(JSON.stringify(responseData))
    })
    .catch(error => {
      console.error('Sotra error: ', error.message)
      return response.status(400).send(error.response?.data ?? 'Error')
    })
}
