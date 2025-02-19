import { Schema, model } from 'mongoose'
import { IUser } from './user'

export interface IAudioRecord {
  createdAt: Date
  title: string
  originalText: string[]
  translatedText: string[]
  owner: IUser
}

const audioRecordSchema = new Schema<IAudioRecord>(
  {
    originalText: {
      type: [String],
      required: true,
    },
    translatedText: {
      type: [String],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

export const AudioRecord = model<IAudioRecord>('AudioRecord', audioRecordSchema)
