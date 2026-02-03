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
import { getMe } from './controllers/user'
import {
  createAudioRecord,
  deleteAudioRecord,
  getAudioRecords,
  updateAudioRecord,
} from './controllers/audio-record'
import { User, UserRole } from './models/user'
import { hashPassword, isUser, verifyToken } from './helper/auth'
import {
  BamborakParamsSchema,
  getAudioFromText,
  getSpeakers,
} from './routes/bamborak'
import { AudioRecord } from './models/audio-record'
import { getAudioCast } from './controllers/audio-record'
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
  const user = await User.findOne({ email: process.env.DB_ADMIN_EMAIL })
  if (user) return

  const adminUser = await User.create({
    firstname: process.env.DB_ADMIN_FIRSTNAME,
    lastname: process.env.DB_ADMIN_LASTNAME,
    email: process.env.DB_ADMIN_EMAIL,
    password: await hashPassword(process.env.DB_ADMIN_PASSWORD!),
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
    sendSubtitlesToYoutube(request.body, response),
)

app.post(
  '/sotra',
  validateData(SotraParamsSchema),
  (request: Request, response: Response) =>
    translateViaSotra(request.body, response),
)

app.post('/bamborak', validateData(BamborakParamsSchema), (request, response) =>
  getAudioFromText(request.body, response),
)

app.get('/bamborak-speakers', (_: Request, response: Response) => {
  getSpeakers(response)
})

app.ws('/vosk', async (ws, req) => {
  console.log('Connecting ...')
  const webSocket = new WebSocket(process.env.VOSK_SERVER_URL!)
  webSocket.binaryType = 'arraybuffer'
  const recordId = req.query.recordId as string

  // // Get authorization token from query params
  // const token = req.query.token as string
  // if (!token) {
  //   ws.close()
  //   return
  // }

  // // Verify token and get user ID
  // const verifiedToken = verifyToken(token)
  // if (!verifiedToken?.id) {
  //   ws.close()
  //   return
  // }

  webSocket.onerror = error => {
    console.error('WebSocket error:', error.message)
    ws.close()
  }

  webSocket.onmessage = async event => {
    ws.send(event.data)

    // Parse the message and save to audio record if it's a transcription
    try {
      const data = JSON.parse(event.data.toString())
      if (data.text) {
        if (
          data.text &&
          data.text !== '-- ***/whisper/ggml-model.q8_0.bin --' &&
          data.text !== '-- **/whisper/ggml-model.q8_0.bin --' &&
          data.text !== '-- */whisper/ggml-model.q8_0.bin --'
        ) {
          const trimmedText = data.text.slice(2, -2).trim()
          if (trimmedText.length <= 0) return

          await AudioRecord.findByIdAndUpdate(recordId, {
            $push: { originalText: trimmedText },
          })
        }
      }
    } catch (error) {
      console.error('Error saving transcription:', error)
    }
  }

  webSocket.onopen = () => console.log('Connection to Websocket established 🚀')

  ws.on('message', (message: string) => {
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

// In-memory pub/sub for translation events
export const translationSubscribers: { [recordId: string]: Set<any> } = {}

// WebSocket endpoint for translation updates
app.ws('/translations', (ws, req) => {
  const recordId = req.query.recordId as string
  if (!recordId) {
    ws.close()
    return
  }
  if (!translationSubscribers[recordId]) {
    translationSubscribers[recordId] = new Set()
  }
  translationSubscribers[recordId].add(ws)

  ws.on('close', () => {
    translationSubscribers[recordId].delete(ws)
    if (translationSubscribers[recordId].size === 0) {
      delete translationSubscribers[recordId]
    }
  })
})

app.post('/auth/register', register)

app.post('/auth/login', login)

app.post('/auth/loginFree', loginFree)

app.get('/auth/me', getMe)

app.get('/users/audioRecords', getAudioRecords)

app.post('/users/audioRecords', createAudioRecord)

app.put('/users/audioRecords/:id', updateAudioRecord)

app.delete('/users/audioRecords/:id', deleteAudioRecord)

app.get('/casts/:token', getAudioCast)

app
  .listen(PORT, () => {
    console.log('Server running at PORT: ', PORT)
  })
  .on('error', error => {
    // gracefully handle error
    throw new Error(error.message)
  })
