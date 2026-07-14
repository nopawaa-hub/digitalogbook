import { z } from 'zod'

export const POSITION_OPTIONS = [
  'Lecturer',
  'Teacher',
  'Student Teacher',
  'Student',
  'Visitor',
  'Others',
] as const

export type Position = (typeof POSITION_OPTIONS)[number]

/**
 * Form validation schema.
 * - name / institution / position are required
 * - email/phone optional, but email is validated if provided
 * - comment may be typed OR handwritten (at least one is required — checked
 *   at submit time since they live in different fields)
 * - signature is required (this is a guestbook)
 * - consent is required
 */
export const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Please enter your name')
    .max(80, 'That name is a little too long'),
  institution: z
    .string()
    .trim()
    .min(2, 'Please enter your institution')
    .max(100, 'That name is a little too long'),
  position: z.enum(POSITION_OPTIONS, {
    errorMap: () => ({ message: 'Please select your position' }),
  }),
  email: z
    .string()
    .trim()
    .max(120, 'That email is a little too long')
    .email('Please enter a valid email')
    .optional()
    .or(z.literal('')),
  phone: z
    .string()
    .trim()
    .max(40, 'That number is a little too long')
    .optional()
    .or(z.literal('')),
  typedComment: z
    .string()
    .max(2000, 'Please keep your comment under 2000 characters')
    .optional()
    .or(z.literal('')),
  rating: z.number().min(0).max(5).optional(),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Please agree to the consent note to continue' }),
  }),
})

export type FormValues = z.infer<typeof formSchema>

/**
 * The full submission record persisted to Firestore. Image fields hold the
 * Firebase Storage download URLs (empty string when not provided).
 */
export interface Submission {
  visitorNumber: number
  timestamp: number
  createdAt: number
  name: string
  institution: string
  position: Position
  email: string
  phone: string
  typedComment: string
  handwrittenCommentImage: string
  signatureImage: string
  /** Serialized signature strokes for the celebration replay (may be null). */
  signatureStrokes?: unknown
  rating: number
  consent: boolean
  device: string
  browser: string
}
