import express, { Request, Response } from 'express'
import dotenv from 'dotenv'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { YoutubeSubtitleParams, sendSubtitlesToYoutube } from './routes/youtube'
import { SotraParams, translateViaSotra } from './routes/sotra'
dayjs.extend(utc)
const cors = require('cors')

// configures dotenv to work in your application
dotenv.config()
const app = express()
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

const PORT = process.env.PORT

app.get('/', (request: Request, response: Response) => {
  response.status(200).send('Hello World')
})

app.post(
  '/youtube',
  (request: Request<{}, {}, YoutubeSubtitleParams>, response: Response) => {
    return sendSubtitlesToYoutube(request.body, response)
  }
)

app.post(
  '/sotra',
  (request: Request<{}, {}, SotraParams>, response: Response) => {
    return translateViaSotra(request.body, response)
  }
)

app
  .listen(PORT, () => {
    console.log('Server running at PORT: ', PORT)
  })
  .on('error', (error) => {
    // gracefully handle error
    throw new Error(error.message)
  })
