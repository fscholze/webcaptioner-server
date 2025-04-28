import axios, { AxiosRequestConfig } from 'axios'
import { Response } from 'express'
import { z } from 'zod'

export const BamborakParamsSchema = z.object({
  text: z.string(),
  speaker_id: z.string(),
})

type BamborakParams = z.infer<typeof BamborakParamsSchema>

export const getAudioFromText = (
  params: BamborakParams,
  response: Response
) => {
  const config: AxiosRequestConfig = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `${process.env.BAMBORAK_SERVER}/api/tts/`,
    headers: {
      'Content-Type': 'application/json',
    },
    data: params,
    responseType: 'arraybuffer',
  }

  return axios
    .request(config)
    .then(resp => {
      response.setHeader('Content-Type', 'audio/mp4')
      response.setHeader('Content-Length', resp.data.length)
      return response.status(200).send(resp.data)
    })
    .catch(error => {
      console.error('Bamborak error: ', error.message)
      return response.status(400).send(error.response?.data ?? 'Error')
    })
}

export const getSpeakers = (response: Response) => {
  return axios
    .get(`${process.env.BAMBORAK_SERVER}/api/fetch_speakers/`)
    .then(resp => {
      return response.status(200).send(resp.data)
    })
    .catch(error => {
      return response.status(400).send(error.response?.data ?? 'Error')
    })
}
