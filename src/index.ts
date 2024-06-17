import express, { Request, Response } from 'express'
import dotenv from 'dotenv'
import expressWs from 'express-ws'
import WebSocket from 'ws'
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
const { app } = expressWs(express())
expressWs(app)
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

app.ws('/vosk', (ws, req) => {
  console.log('Connecting ...')
  const webSocket = new WebSocket(process.env.VOSK_SERVER_URL!)
  webSocket.binaryType = 'arraybuffer'
  webSocket.onerror = (error) => {
    console.error('WebSocket error:')
    ws.close()
  }
  webSocket.onmessage = (event) => ws.send(event.data)
  webSocket.onopen = () => console.log('Connection to Websocket established 🚀')

  ws.on('message', (message: string) => {
    // console.log(`Received message from client: ${message}`)
    webSocket.send(message)
  })
  ws.on('close', () => {
    console.log('Disconnected from server')
    webSocket.close()
  })
})

app
  .listen(PORT, () => {
    console.log('Server running at PORT: ', PORT)
  })
  .on('error', (error) => {
    // gracefully handle error
    throw new Error(error.message)
  })
