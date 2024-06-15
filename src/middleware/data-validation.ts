import { HttpStatusCode } from 'axios'
import { Request, Response, NextFunction } from 'express'
import { z, ZodError } from 'zod'

export const validateData =
  (schema: z.ZodObject<any, any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body)
      next()
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessage = error.errors.map((issue) => ({
          message: `${issue.path.join('.')} is ${issue.message}`,
        }))
        res.status(HttpStatusCode.BadRequest).json({ errors: errorMessage })
      } else {
        res
          .status(HttpStatusCode.InternalServerError)
          .json({ error: 'Internal Server Error' })
      }
    }
  }
