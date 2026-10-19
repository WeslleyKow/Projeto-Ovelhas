import { createClient } from '@supabase/supabase-js'
import { type AppData, type ApprovalMode, colors, type Entry, type Goal, type GoalChangeRequest, type GoalChangeVote, type GoalProposal, type Group, type Member, type RecurringFinePayment } from './types'
const configuredUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const url = configuredUrl?.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const cloudEnabled = Boolean(url && key)
export const supabase = cloudEnabled ? createClient(url!, key!) : null
export async function fetchData(userId: string): Promise<AppData | null> {
  if (!supabase) return null
  const { data: memberships, error: membershipError } = await supabase.from('group_members').select('group_id').eq('user_id', userId).limit(1)
  if (membershipError) throw membershipError
  if (!memberships?.length) return null
  const groupId = memberships[0].group_id as string
  const [groupResult, membersResult, goalsResult, entriesResult, requestsResult, finesResult] = await Promise.all([
    supabase.from('groups').select('*').eq('id', groupId).single(),
    supabase.from('group_members').select('user_id, profiles(display_name)').eq('group_id', groupId),
    supabase.from('goals').select('*').eq('group_id', groupId).order('created_at', { ascending: false }),
    supabase.from('entries').select('*, goals!inner(group_id)').eq('goals.group_id', groupId).order('entry_date', { ascending: false }),
    supabase.from('goal_change_requests').select('*').eq('group_id', groupId).eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.from('recurring_fine_payments').select('goal_id,period_start,occurrence_index,paid_at').eq('group_id', groupId)
  ])
  for (const result of [groupResult, membersResult, goalsResult, entriesResult, requestsResult, finesResult]) if (result.error) throw result.error
  const requests = (requestsResult.data ?? []) as GoalChangeRequest[]
  const votesResult = requests.length ? await supabase.from('goal_change_votes').select('*').in('request_id', requests.map(request => request.id)) : null
  if (votesResult?.error) throw votesResult.error
  const members: Member[] = (membersResult.data ?? []).map((row, i) => ({ id: row.user_id, name: (row.profiles as unknown as {display_name: string} | null)?.display_name ?? 'Participante', color: colors[i % colors.length] }))
  const entries: Entry[] = (entriesResult.data ?? []).map(row => ({ id: row.id, goal_id: row.goal_id, author_id: row.author_id, entry_date: row.entry_date, amount: Number(row.amount), note: row.note, photo_path: row.photo_path, created_at: row.created_at }))
  return { group: groupResult.data as Group, members, goals: goalsResult.data as Goal[], entries, finePayments: (finesResult.data ?? []) as RecurringFinePayment[], requests, votes: (votesResult?.data ?? []) as GoalChangeVote[], me: userId }
}
export async function createGroup(name: string) {
  if (!supabase) return
  const { error } = await supabase.rpc('create_family_group', { group_name: name.trim() })
  if (error) throw error
}
export async function joinGroup(code: string) {
  if (!supabase) return
  const { error } = await supabase.rpc('join_family_group', { code: code.trim().toUpperCase() })
  if (error) throw error
}
export async function saveGroupRule(group: Group, mode: ApprovalMode, value: number) {
  if (!supabase) return
  const { error } = await supabase.rpc('set_group_approval_rule', { target_group: group.id, new_mode: mode, new_value: value })
  if (error) throw error
}
export async function uploadGroupPix(group: Group, file: File) {
  if (!supabase) return
  const extensions: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' }
  if (!extensions[file.type] || file.size > 5 * 1024 * 1024) throw new Error('Escolha uma imagem PNG, JPG, WebP ou GIF de até 5 MB.')
  const path = `${group.id}/${group.created_by}/${crypto.randomUUID()}.${extensions[file.type]}`
  const uploaded = await supabase.storage.from('group-pix').upload(path, file, { contentType: file.type })
  if (uploaded.error) throw uploaded.error
  const { error } = await supabase.rpc('set_group_pix_qr', { target_group: group.id, new_path: path })
  if (error) { await supabase.storage.from('group-pix').remove([path]); throw error }
  if (group.pix_qr_path) await supabase.storage.from('group-pix').remove([group.pix_qr_path])
}
export async function removeGroupPix(group: Group) {
  if (!supabase) return
  const { error } = await supabase.rpc('set_group_pix_qr', { target_group: group.id, new_path: null })
  if (error) throw error
  if (group.pix_qr_path) await supabase.storage.from('group-pix').remove([group.pix_qr_path])
}
export async function groupPixUrl(path: string): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.storage.from('group-pix').createSignedUrl(path, 3600)
  return error ? null : data.signedUrl
}
export async function addGoal(goal: Omit<Goal, 'id' | 'created_at'>) {
  if (!supabase) return
  const { fine_paid_at: _finePaidAt, ...newGoal } = goal
  void _finePaidAt
  const { error } = await supabase.from('goals').insert(newGoal)
  if (error) throw error
}
export async function requestGoalChange(goal: Goal, action: 'edit' | 'delete', proposal?: GoalProposal) {
  if (!supabase) return
  const { error } = await supabase.rpc('request_goal_change', { target_goal: goal.id, change_action: action, proposed_goal: proposal ?? null })
  if (error) throw error
}
export async function voteGoalChange(id: string, approved: boolean) {
  if (!supabase) return
  const { error } = await supabase.rpc('vote_goal_change', { target_request: id, allow_change: approved })
  if (error) throw error
}
export async function cancelGoalChange(id: string) {
  if (!supabase) return
  const { error } = await supabase.rpc('cancel_goal_change', { target_request: id })
  if (error) throw error
}
export async function setFinePaid(goal: Goal, paid: boolean) {
  if (!supabase) return
  const { error } = await supabase.rpc('set_goal_fine_paid', { target_goal: goal.id, paid })
  if (error) throw error
}
export async function setRecurringFinePaid(goal: Goal, periodStart: string, occurrenceIndex: number, paid: boolean) {
  if (!supabase) return
  const { error } = await supabase.rpc('set_recurring_fine_paid', { target_goal: goal.id, target_period: periodStart, target_occurrence: occurrenceIndex, paid })
  if (error) throw error
}
export async function removeEntry(entry: Entry) {
  if (!supabase) return
  const { error } = await supabase.from('entries').delete().eq('id', entry.id).eq('author_id', entry.author_id).select('id').single()
  if (error) throw error
  if (entry.photo_path) await supabase.storage.from('progress-photos').remove([entry.photo_path])
}
export async function addEntry(entry: Omit<Entry, 'id' | 'created_at'>, photo?: File) {
  if (!supabase) return
  let photoPath: string | null = null
  if (photo) {
    if (!photo.type.startsWith('image/') || photo.size > 5 * 1024 * 1024) throw new Error('Escolha uma imagem de até 5 MB.')
    const extension = photo.name.split('.').pop()?.toLowerCase() || 'jpg'
    const { data: goal, error: goalError } = await supabase.from('goals').select('group_id').eq('id', entry.goal_id).single()
    if (goalError) throw goalError
    photoPath = `${goal.group_id}/${entry.author_id}/${crypto.randomUUID()}.${extension}`
    const upload = await supabase.storage.from('progress-photos').upload(photoPath, photo, { contentType: photo.type })
    if (upload.error) throw upload.error
  }
  const { error } = await supabase.from('entries').insert({ ...entry, photo_path: photoPath })
  if (error) {
    if (photoPath) await supabase.storage.from('progress-photos').remove([photoPath])
    throw error
  }
}
export async function photoUrl(path: string): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.storage.from('progress-photos').createSignedUrl(path, 3600)
  return error ? null : data.signedUrl
}
