import express, { Request, Response } from 'express'
import dotenv from 'dotenv'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import {
  YoutubeSubtitleParamsSchema,
  sendSubtitlesToYoutube,
} from './routes/youtube'
import { SotraParamsSchema, translateViaSotra } from './routes/sotra'
import { validateData } from './middleware/data-validation'
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
  validateData(YoutubeSubtitleParamsSchema),
  (request: Request, response: Response) =>
    sendSubtitlesToYoutube(request.body, response)
)

app.post(
  '/sotra',
  validateData(SotraParamsSchema),
  (request: Request, response: Response) =>
    translateViaSotra(request.body, response)
)

app
  .listen(PORT, () => {
    console.log('Server running at PORT: ', PORT)
  })
  .on('error', (error) => {
    // gracefully handle error
    throw new Error(error.message)
  })
