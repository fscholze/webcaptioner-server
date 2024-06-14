import { Response } from 'express'
import axios from 'axios'
import dayjs from 'dayjs'

type YoutubeSubtitleParams = {
  cid: string
  seq: number
  timestamp: string
  region: string
  text: string
}

export const sendSubtitlesToYoutube = (
  params: YoutubeSubtitleParams,
  response: Response
) => {
  const parsedDate = dayjs
    .utc(params.timestamp)
    .format('YYYY-MM-DDTHH:mm:ss.SSS')
  const data = `${parsedDate} region:${params.region}\n${Buffer.from(
    params.text,
    'ascii'
  ).toString('utf-8')}: ${params.seq}\n`

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
      return response.status(200).send(JSON.stringify(resp.data))
    })
    .catch((error) => {
      return response.status(400).send(error.response?.data ?? 'Error')
    })
}
