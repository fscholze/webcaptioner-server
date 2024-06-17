import { Response } from 'express'
import axios from 'axios'
import { z } from 'zod'

export const SotraParamsSchema = z.object({
  text: z.string(),
  sourceLanguage: z.enum(['de', 'hsb']),
  targetLanguage: z.enum(['de', 'hsb']),
})
type SotraParams = z.infer<typeof SotraParamsSchema>

export const translateViaSotra = (params: SotraParams, response: Response) => {
  const data = JSON.stringify({
    text: params.text,
    source_language: params.sourceLanguage,
    target_language: params.targetLanguage,
  })

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${process.env.SOTRA_SERVER_URL}/translate`,
    headers: {
      'Content-Type': 'application/json',
    },
    data: data,
  }

  return axios
    .request(config)
    .then((resp) => {
      return response.status(200).send(JSON.stringify(resp.data))
    })
    .catch((error) => {
      console.log(error)
      return response.status(400).send(error.response?.data ?? 'Error')
    })
}
