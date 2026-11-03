import { supabase } from './supabase'
import type { Category, ChecklistItem, DayNote, Expense, Member, Profile, Role, Stop, TravelMode, Trip } from './types'
import { uid } from './utils'

/* ---------- 행 <-> 앱 모델 변환 ---------- */

interface StopRow {
  id: string; trip_id: string; date: string; start_time: string; end_time: string; title: string
  place: Stop['place'] | null; category: string; cost: number; memo: string; mode_to_next: string; done: boolean; paid_by: string | null
}
interface ExpenseRow { id: string; trip_id: string; date: string; label: string; category: string; amount: number; paid_by: string | null }
interface ChecklistRow extends ChecklistItem { trip_id: string }
interface NoteRow extends DayNote { trip_id: string }
interface TripRow {
  id: string; owner_id: string; title: string; destination: string; start_date: string; end_date: string; budget: number; currency: string
  created_at: string; stops?: StopRow[]; expenses?: ExpenseRow[]; checklist_items?: ChecklistRow[]; day_notes?: NoteRow[]; trip_members?: { user_id: string; role: Role }[]
}

const toStop = (r: StopRow): Stop => ({
  id: r.id, date: r.date, start: r.start_time, end: r.end_time, title: r.title, place: r.place ?? undefined,
  category: r.category as Category, cost: Number(r.cost) || 0, memo: r.memo ?? '', modeToNext: r.mode_to_next as TravelMode, done: r.done, paidBy: r.paid_by,
})
const fromStop = (s: Stop, tripId: string): StopRow => ({
  id: s.id, trip_id: tripId, date: s.date, start_time: s.start, end_time: s.end, title: s.title, place: s.place ?? null,
  category: s.category, cost: s.cost || 0, memo: s.memo || '', mode_to_next: s.modeToNext, done: !!s.done, paid_by: s.paidBy ?? null,
})
const toExpense = (r: ExpenseRow): Expense => ({ id: r.id, date: r.date, label: r.label, category: r.category as Category, amount: Number(r.amount) || 0, paidBy: r.paid_by })
const fromExpense = (e: Expense, tripId: string): ExpenseRow => ({ id: e.id, trip_id: tripId, date: e.date, label: e.label, category: e.category, amount: e.amount || 0, paid_by: e.paidBy ?? null })
const fromItem = (c: ChecklistItem, tripId: string): ChecklistRow => ({ id: c.id, trip_id: tripId, text: c.text, category: c.category, done: c.done, sort: c.sort })
const fromNote = (n: DayNote, tripId: string): NoteRow => ({ id: n.id, trip_id: tripId, date: n.date, mood: n.mood, body: n.body })

function toTrip(r: TripRow, me?: string): Trip {
  const members = r.trip_members ?? []
  return {
    id: r.id, title: r.title, destination: r.destination ?? '', startDate: r.start_date, endDate: r.end_date, budget: Number(r.budget) || 0, currency: r.currency,
    createdAt: Date.parse(r.created_at), ownerId: r.owner_id,
    stops: (r.stops ?? []).map(toStop), expenses: (r.expenses ?? []).map(toExpense),
    checklist: (r.checklist_items ?? []).map(({ id, text, category, done, sort }) => ({ id, text, category, done, sort }))
      .sort((a, b) => a.sort - b.sort || a.text.localeCompare(b.text)),
    notes: (r.day_notes ?? []).map(({ id, date, mood, body }) => ({ id, date, mood, body })),
    role: members.find((m) => m.user_id === me)?.role, memberIds: members.map((m) => m.user_id),
  }
}

const SELECT = '*, stops(*), expenses(*), checklist_items(*), day_notes(*), trip_members(user_id, role)'

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

/* ---------- 조회 ---------- */

export async function fetchTrips(me: string): Promise<Trip[]> {
  const rows = check(await supabase.from('trips').select(SELECT).order('start_date', { ascending: false }))
  return (rows as TripRow[]).map((r) => toTrip(r, me))
}

export async function fetchTrip(id: string, me: string): Promise<Trip | null> {
  const row = check(await supabase.from('trips').select(SELECT).eq('id', id).maybeSingle())
  return row ? toTrip(row as TripRow, me) : null
}

export async function fetchMembers(tripId: string): Promise<Member[]> {
  const rows = check(await supabase.from('trip_members').select('user_id, role').eq('trip_id', tripId)) as Member[]
  const ids = rows.map((m) => m.user_id)
  const profiles = ids.length
    ? (check(await supabase.from('profiles').select('id, email, display_name').in('id', ids)) as Member['profile'][])
    : []
  const order: Record<Role, number> = { owner: 0, editor: 1, viewer: 2 }
  return rows
    .map((m) => ({ ...m, profile: profiles.find((p) => p?.id === m.user_id) }))
    .sort((a, b) => order[a.role] - order[b.role])
}

/* ---------- 쓰기 ---------- */

/** 새 여행 생성 (가져오기/샘플 포함). id는 항상 새로 발급 */
export async function createTrip(t: Trip): Promise<string> {
  const id = uid()
  check(await supabase.from('trips').insert({
    id, title: t.title, destination: t.destination ?? '', start_date: t.startDate, end_date: t.endDate, budget: t.budget || 0, currency: t.currency,
  }))
  if (t.stops.length) check(await supabase.from('stops').insert(t.stops.map((s) => fromStop({ ...s, id: uid() }, id))))
  if (t.expenses.length) check(await supabase.from('expenses').insert(t.expenses.map((e) => fromExpense({ ...e, id: uid() }, id))))
  if (t.checklist?.length) check(await supabase.from('checklist_items').insert(t.checklist.map((c) => fromItem({ ...c, id: uid(), done: false }, id))))
  if (t.notes?.length) check(await supabase.from('day_notes').insert(t.notes.map((n) => fromNote({ ...n, id: uid() }, id))))
  return id
}

export async function deleteTrip(id: string) {
  check(await supabase.from('trips').delete().eq('id', id))
}

/** 이전/다음 상태를 비교해 바뀐 부분만 서버에 반영 */
export async function syncTrip(prev: Trip, next: Trip) {
  const ops: PromiseLike<unknown>[] = []
  if (
    prev.title !== next.title || (prev.destination ?? '') !== (next.destination ?? '') || prev.startDate !== next.startDate || prev.endDate !== next.endDate ||
    prev.budget !== next.budget || prev.currency !== next.currency
  ) {
    ops.push(supabase.from('trips').update({
      title: next.title, destination: next.destination ?? '', start_date: next.startDate, end_date: next.endDate, budget: next.budget || 0, currency: next.currency,
    }).eq('id', next.id).then(check))
  }
  const diff = <T extends { id: string }>(a: T[], b: T[]) => {
    const before = new Map(a.map((x) => [x.id, JSON.stringify(x)]))
    return {
      changed: b.filter((x) => before.get(x.id) !== JSON.stringify(x)),
      removed: a.filter((x) => !b.some((y) => y.id === x.id)).map((x) => x.id),
    }
  }
  const s = diff(prev.stops, next.stops)
  if (s.changed.length) ops.push(supabase.from('stops').upsert(s.changed.map((x) => fromStop(x, next.id))).then(check))
  if (s.removed.length) ops.push(supabase.from('stops').delete().in('id', s.removed).then(check))
  const e = diff(prev.expenses, next.expenses)
  if (e.changed.length) ops.push(supabase.from('expenses').upsert(e.changed.map((x) => fromExpense(x, next.id))).then(check))
  if (e.removed.length) ops.push(supabase.from('expenses').delete().in('id', e.removed).then(check))
  const c = diff(prev.checklist, next.checklist)
  if (c.changed.length) ops.push(supabase.from('checklist_items').upsert(c.changed.map((x) => fromItem(x, next.id))).then(check))
  if (c.removed.length) ops.push(supabase.from('checklist_items').delete().in('id', c.removed).then(check))
  const n = diff(prev.notes, next.notes)
  if (n.changed.length) ops.push(supabase.from('day_notes').upsert(n.changed.map((x) => fromNote(x, next.id)), { onConflict: 'trip_id,date' }).then(check))
  if (n.removed.length) ops.push(supabase.from('day_notes').delete().in('id', n.removed).then(check))
  await Promise.all(ops)
}

/* ---------- 공유 ---------- */

export interface Invite { token: string; role: 'editor' | 'viewer'; created_at: string; expires_at: string }

export async function listInvites(tripId: string): Promise<Invite[]> {
  return check(await supabase.from('trip_invites').select('token, role, created_at, expires_at').eq('trip_id', tripId)
    .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false })) as Invite[]
}
export async function createInvite(tripId: string, role: 'editor' | 'viewer'): Promise<Invite> {
  return check(await supabase.from('trip_invites').insert({ trip_id: tripId, role }).select('token, role, created_at, expires_at').single()) as Invite
}
export async function deleteInvite(token: string) {
  check(await supabase.from('trip_invites').delete().eq('token', token))
}
export const inviteUrl = (token: string) => `${location.origin}${location.pathname}#invite=${token}`

export async function inviteInfo(token: string) {
  const rows = check(await supabase.rpc('invite_info', { p_token: token })) as { trip_id: string; title: string; role: Role; inviter: string }[]
  return rows[0] ?? null
}
export async function acceptInvite(token: string): Promise<string> {
  return check(await supabase.rpc('accept_invite', { p_token: token })) as string
}
export async function setMemberRole(tripId: string, userId: string, role: Role) {
  check(await supabase.from('trip_members').update({ role }).eq('trip_id', tripId).eq('user_id', userId))
}
export async function removeMember(tripId: string, userId: string) {
  check(await supabase.from('trip_members').delete().eq('trip_id', tripId).eq('user_id', userId))
}

/* ---------- 사용자 / 관리자 ---------- */

export async function fetchProfile(id: string): Promise<Profile | null> {
  return check(await supabase.from('profiles').select('*').eq('id', id).maybeSingle()) as Profile | null
}
export async function fetchAllProfiles(): Promise<Profile[]> {
  return check(await supabase.from('profiles').select('*').order('created_at', { ascending: false })) as Profile[]
}
export async function setUserStatus(userId: string, status: Profile['status']) {
  check(await supabase.rpc('set_user_status', { p_user: userId, p_status: status }))
}
export async function updateMyName(name: string) {
  check(await supabase.rpc('update_my_name', { p_name: name }))
}
