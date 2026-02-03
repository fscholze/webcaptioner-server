import { z } from 'zod'

export const InputWordSchema = z.object({
  word: z.string(),
  conf: z.number(),
  spell: z.boolean().optional(),
  start: z.number().optional(),
  end: z.number().optional(),
})

export const AudioTextSchema = z.object({
  plain: z.string(),
  tokens: z.array(InputWordSchema).optional(),
})

// Accepts both the new object form and legacy strings.
export const AudioTextOrLegacyStringSchema = z.union([
  AudioTextSchema,
  z.string(),
])

export const CreateAudioRecordBodySchema = z.object({
  originalText: z.array(AudioTextOrLegacyStringSchema).optional(),
  translatedText: z.array(AudioTextOrLegacyStringSchema).optional(),
  speakerId: z.string().nullable().optional(),
})

export const UpdateAudioRecordBodySchema = z.object({
  speakerId: z.string().nullable(),
})
