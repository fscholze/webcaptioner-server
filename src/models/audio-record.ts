import { Schema, Types, model } from 'mongoose'
import { IUser } from './user'

const generateToken = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let token = ''
  for (let i = 0; i < 6; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return token
}

export interface IAudioRecord {
  createdAt: Date
  title: string
  originalText: AudioText[]
  translatedText: AudioText[]
  owner?: Types.ObjectId | IUser
  token: string
  speakerId: string | null
}

export type InputWord = {
  word: string
  conf: number
  spell?: boolean
  start?: number
  end?: number
}

export type AudioText = {
  plain: string
  tokens?: InputWord[]
}

const audioRecordSchema = new Schema<IAudioRecord>(
  {
    originalText: {
      // Stored as objects like { plain: string, tokens?: InputWord[] }.
      // Kept as Mixed to tolerate legacy string[] data already in MongoDB.
      type: [Schema.Types.Mixed] as any,
      required: true,
      default: [],
    },
    translatedText: {
      // Stored as objects like { plain: string, tokens?: InputWord[] }.
      // Kept as Mixed to tolerate legacy string[] data already in MongoDB.
      type: [Schema.Types.Mixed] as any,
      required: true,
      default: [],
    },
    title: {
      type: String,
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    token: {
      type: String,
      required: true,
      unique: true,
      default: generateToken,
    },
    speakerId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
)

// Pre-save hook to ensure token uniqueness
// (Mongoose 9: async pre hooks no longer receive `next`; throw to abort.)
audioRecordSchema.pre('save', async function (this: any) {
  if (!this.isModified('token')) return

  let isUnique = false
  let attempts = 0
  const maxAttempts = 10

  while (!isUnique && attempts < maxAttempts) {
    const existingRecord = await AudioRecord.findOne({ token: this.token })
    if (!existingRecord) {
      isUnique = true
    } else {
      this.token = generateToken()
    }
    attempts++
  }

  if (!isUnique) {
    throw new Error('Could not generate unique token after multiple attempts')
  }
})

export const AudioRecord = model<IAudioRecord>('AudioRecord', audioRecordSchema)
