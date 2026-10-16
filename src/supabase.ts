import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase = url && anonKey ? createClient(url, anonKey) : null

export type Service = {
  id: string
  name: string
  description: string | null
  price_cents: number | null
  duration_min: number
}

export type BusinessHours = {
  weekday: number
  open_time: string
  close_time: string
}
