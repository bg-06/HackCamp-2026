import type { VolunteerRecord } from '../types'

const TZ = 'America/Vancouver'

export const formatHours = (h: number) => `${Number.isInteger(h) ? h : h.toFixed(1)} h`

export const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' })

// Quote anything with a comma, quote or line break. Titles come from organisers, so anything starting
// with = + - @ (or a tab or CR) gets a leading ' or Excel would run it as a formula.
function cell(v: string | number) {
  let s = String(v)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function downloadHoursRecord(records: VolunteerRecord[]) {
  const total = records.reduce((n, r) => n + r.hours, 0)
  const rows: (string | number)[][] = [
    ['Date', 'Activity', 'Organiser', 'Hours'],
    ...records.map((r) => [formatDay(r.date), r.title, r.organiser, r.hours]),
    ['', '', 'Total', total],
  ]
  if (records.some((r) => r.sample)) rows.push([], ['Includes sample entries, not real volunteering.'])

  const csv = rows.map((r) => r.map(cell).join(',')).join('\r\n')
  // the BOM tells Excel it's UTF-8, or accented names come out garbled
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'volunteer-hours.csv'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
