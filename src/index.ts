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
import { connectDB } from './db'
import { login, loginFree, register } from './controllers/auth'
import { createAudioRecord, getAudioRecords, getMe } from './controllers/user'
import { User, UserRole } from './models/user'
import { hashPassword, isUser } from './helper/auth'
import {
  BamborakParamsSchema,
  getAudioFromText,
  getSpeakers,
} from './routes/bamborak'
dayjs.extend(utc)
const cors = require('cors')

// configures dotenv to work in your application
dotenv.config()
const { app } = expressWs(express())
expressWs(app)
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

connectDB().then(async () => {
  const user = await User.findOne({ email: 'd.soba@serbja.de' })
  if (user) return

  const adminUser = await User.create({
    firstname: 'Daniel',
    lastname: 'Soba',
    email: 'd.soba@serbja.de',
    password: await hashPassword('tajne'),
  })
  await User.findByIdAndUpdate(adminUser._id, { role: UserRole.ADMIN })
})

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

app.post('/bamborak', validateData(BamborakParamsSchema), (request, response) =>
  getAudioFromText(request.body, response)
)

app.get('/bamborak-speakers', (_: Request, response: Response) => {
  getSpeakers(response)
})

app.ws('/vosk', (ws, req) => {
  console.log('Connecting ...')
  const webSocket = new WebSocket(process.env.VOSK_SERVER_URL!)
  webSocket.binaryType = 'arraybuffer'
  webSocket.onerror = error => {
    console.error('WebSocket error:', error.message)
    ws.close()
  }
  webSocket.onmessage = event => ws.send(event.data)
  webSocket.onopen = () => console.log('Connection to Websocket established 🚀')

  ws.on('message', (message: string) => {
    // console.log(`Received message from client: ${message}`)
    // eof('{"timestamp" : 1}') utf
    if (webSocket.readyState === webSocket.OPEN) {
      if (message.length === 13) {
        const time = parseInt(message, 10)
        const timeStatus = `seconds=${Math.trunc(time / 1000)},milli=${
          time - Math.trunc(time / 1000) * 1000
        }`

        webSocket.send(timeStatus)
      } else {
        webSocket.send(message)
      }
    }
  })
  ws.on('close', () => {
    console.log('Disconnected from server')
    webSocket.close()
  })
})

app.post('/auth/register', register)

app.post('/auth/login', login)

app.post('/auth/loginFree', loginFree)

app.get('/auth/me', getMe)

app.get('/users/audioRecords', getAudioRecords)

app.post('/users/audioRecords', createAudioRecord)

// app.put('/users/audioRecords/:id', updateAudioRecord)

app
  .listen(PORT, () => {
    console.log('Server running at PORT: ', PORT)
  })
  .on('error', error => {
    // gracefully handle error
    throw new Error(error.message)
  })
