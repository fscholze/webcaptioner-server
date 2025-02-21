import { Response } from 'express'
import axios from 'axios'
import dayjs from 'dayjs'
import { z } from 'zod'

export const YoutubeSubtitleParamsSchema = z.object({
  cid: z.string().length(24),
  seq: z.number().int(),
  timestamp: z.string().datetime({ offset: true }),
  region: z.string().max(10),
  text: z.string(),
})
type YoutubeSubtitleParams = z.infer<typeof YoutubeSubtitleParamsSchema>

export const sendSubtitlesToYoutube = (
  params: YoutubeSubtitleParams,
  response: Response
) => {
  const parsedDate = dayjs
    .utc(params.timestamp)
    .format('YYYY-MM-DDTHH:mm:ss.SSS')
  const data = `${parsedDate} region:${params.region}\n${params.text}…\n`

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: `http://upload.youtube.com/closedcaption?cid=${params.cid}&seq=${params.seq}`,
    headers: {
      'Content-Type': 'text/plain',
    },
    data: data,
  }

  console.info(config)
  return axios
    .request(config)
    .then((resp) => {
      console.info("Youtube OK", resp.data)
      return response.status(200).send(resp.data.trim('/n'))
      // return response.status(200).send(JSON.stringify(resp.data))
    })
    .catch((error) => {
      // console.error(error)
      console.info("Youtube ERROR", error.message ?? error)
      console.info("Error details:", error.response?.data ?? 'Error')
      return response.status(400).send(error.response?.data ?? 'Error')
    })
}
