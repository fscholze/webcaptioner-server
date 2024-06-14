import express, { Request, Response } from 'express'
import dotenv from 'dotenv'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { sendSubtitlesToYoutube } from './routes/youtube'
import { translateViaSotra } from './routes/sotra'
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

app.post('/youtube', (request: Request, response: Response) => {
  // TODO: Check body type
  return sendSubtitlesToYoutube(request.body, response)
})

app.post('/sotra', (request: Request, response: Response) => {
  // TODO: Check body type
  return translateViaSotra(request.body, response)
})

app
  .listen(PORT, () => {
    console.log('Server running at PORT: ', PORT)
  })
  .on('error', (error) => {
    // gracefully handle error
    throw new Error(error.message)
  })
