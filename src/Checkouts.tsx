import { useState } from 'react'
import { ArrowRight, Camera, CheckCircle2, ClipboardCheck, RefreshCw } from 'lucide-react'
import { photoUrl } from './cloud'
import { checkoutRecords } from './checkouts'
import { type AppData, formatDate, formatEntryTimestamp, initials } from './types'

function CheckoutPhoto({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function showPhoto() {
    setBusy(true); setError('')
    try {
      const result = path.startsWith('data:') ? path : await photoUrl(path)
      if (!result) throw new Error('Não foi possível carregar a foto.')
      setUrl(result)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a foto.') }
    finally { setBusy(false) }
  }
  return url ? <img className="checkout-photo" src={url} alt="Foto do checkout" loading="lazy"/> : <span className="checkout-photo-control"><button className="outline" onClick={showPhoto} disabled={busy}><Camera size={15}/>{busy ? 'Carregando...' : 'Ver foto'}</button>{error && <small role="alert">{error}</small>}</span>
}

export function Checkouts({ data, onSelectGoal, onRefresh }: { data: AppData; onSelectGoal: (id: string) => void; onRefresh: () => Promise<void> }) {
  const [participant, setParticipant] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const records = checkoutRecords(data)
  const visible = participant ? records.filter(record => record.entry.author_id === participant) : records
  const missingMembers = [...new Set(records.map(record => record.entry.author_id))].filter(id => !data.members.some(member => member.id === id)).map(id => ({ id, name: 'Participante', color: '#d9e1d5' }))
  const participants = [...data.members, ...missingMembers].sort((a, b) => a.name.localeCompare(b.name))
  async function refresh() {
    if (refreshing) return
    setRefreshing(true); setError('')
    try { await onRefresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível atualizar os checkouts.') }
    finally { setRefreshing(false) }
  }
  return <div className="checkouts-page">
    <div className="page-title-row"><div><span className="section-kicker">DIÁRIO DA FAMÍLIA</span><h1>Checkouts</h1><p>Confira os registros de todos os objetivos em um só lugar.</p></div><button className="outline" onClick={refresh} disabled={refreshing}><RefreshCw size={16}/>{refreshing ? 'Atualizando...' : 'Atualizar checkouts'}</button></div>
    {error && <p className="form-message" role="alert">{error}</p>}
    <div className="checkouts-toolbar"><label>Participante<select value={participant} onChange={event => setParticipant(event.target.value)}><option value="">Todos os participantes</option>{participants.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label><span>{visible.length} {visible.length === 1 ? 'registro' : 'registros'}</span></div>
    {visible.length ? <div className="checkout-list">{visible.map(({ entry, goal, dayTotal }) => {
      const member = data.members.find(item => item.id === entry.author_id) ?? { name: 'Participante', color: '#d9e1d5' }
      const dailyGoal = goal.recurrence_type === 'daily' || goal.recurrence_type === 'weekly'
      const dayComplete = dailyGoal && dayTotal >= Number(goal.target_value)
      return <article className="checkout-card" key={entry.id}><div className="checkout-top"><span className="checkout-person"><span className="avatar small" style={{ background: member.color }}>{initials(member.name)}</span><strong>{member.name}</strong></span><span className={`checkout-status ${dayComplete ? 'met' : ''}`}>{dayComplete ? <CheckCircle2 size={14}/> : <ClipboardCheck size={14}/>} {dailyGoal ? dayComplete ? 'Meta do dia atingida' : 'Progresso parcial' : 'Progresso registrado'}</span></div><div className="checkout-meta"><span>Ocorrência: {formatDate(entry.entry_date)}</span><span>{formatEntryTimestamp(entry.created_at) ? `Marcado em ${formatEntryTimestamp(entry.created_at)} (Brasília)` : 'Horário do registro indisponível'}</span></div><h3>{goal.title}</h3><p className="checkout-amount">+{entry.amount} {goal.unit}{dailyGoal && dayTotal !== Number(entry.amount) ? ` · ${dayTotal}/${goal.target_value} ${goal.unit} no dia` : ''}</p>{entry.note && <p className="checkout-note">{entry.note}</p>}{entry.photo_path && <CheckoutPhoto path={entry.photo_path}/>}<button className="link-button checkout-goal-link" onClick={() => onSelectGoal(goal.id)}>Ver objetivo <ArrowRight size={15}/></button></article>
    })}</div> : <div className="empty"><ClipboardCheck size={32}/><h3>Nenhum checkout encontrado</h3><p>{participant ? 'Esta pessoa ainda não tem registros.' : 'Os registros da família aparecerão aqui.'}</p></div>}
  </div>
}
