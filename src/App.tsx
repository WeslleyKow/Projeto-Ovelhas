import { useEffect, useState, type FormEvent } from 'react'
import { Activity, ArrowLeft, ArrowRight, Award, BookOpen, CalendarDays, Camera, Check, CheckCircle2, CircleHelp, Flame, Home, LogOut, Menu, Plus, RefreshCw, Sparkles, Target, Trash2, TrendingUp, Trophy, Users, Wallet, X } from 'lucide-react'
import { addEntry, addGoal, cancelGoalChange, cloudEnabled, createGroup, fetchData, joinGroup, photoUrl, removeEntry, removeGroupPix, requestGoalChange, saveGroupRule, saveSelectedRank, setFinePaid, setRecurringFinePaid, supabase, uploadGroupPix, voteGoalChange } from './cloud'
import { loadDemo, saveDemo } from './demo'
import { cancelDemoChange, requestDemoChange, voteDemoChange } from './demoApprovals'
import { RequestCard, RequestsSection, ruleText } from './Approvals'
import { GroupSettings, PixImage } from './GroupSettings'
import { Achievements } from './Achievements'
import { isScheduledDay, recurrenceLabel, recurringFines, recurringProgress, selectedWeekdayCount, weekdayNames, type RecurringFine } from './recurrence'
import { type AppData, type ApprovalMode, type Entry, type Goal, type GoalChangeRequest, type GoalProposal, type RecurrenceType, completed, daysSince, fineIsDue, formatDate, initials, money, progress, today, unpaidFine, weekCount, weekDates } from './types'

type Page = 'overview' | 'goals' | 'ranking' | 'achievements' | 'family'
const categories = ['Saúde', 'Aprendizado', 'Leitura', 'Carreira', 'Finanças', 'Outros']
const icons: Record<string, typeof Activity> = { Saúde: Activity, Aprendizado: Sparkles, Leitura: BookOpen, Carreira: TrendingUp, Finanças: Wallet, Outros: Target }
const categoryColors: Record<string, string> = { Saúde: 'peach', Aprendizado: 'lavender', Leitura: 'sage', Carreira: 'blue', Finanças: 'yellow', Outros: 'sage' }

function Avatar({ name, color, small = false }: { name: string; color: string; small?: boolean }) { return <span className={`avatar ${small ? 'small' : ''}`} style={{ background: color }}>{initials(name)}</span> }
function ProgressBar({ value, color = 'green' }: { value: number; color?: string }) { return <div className="progress-track"><div className={`progress-fill ${color}`} style={{ width: `${value}%` }} /></div> }
function CardIcon({ category }: { category: string }) { const Icon = icons[category] || Target; return <span className={`card-icon ${categoryColors[category] || 'sage'}`}><Icon size={21} strokeWidth={2} /></span> }
function Empty({ title, text }: { title: string; text: string }) { return <div className="empty"><Target size={32}/><h3>{title}</h3><p>{text}</p></div> }
function WeekStrip({ goal, entries }: { goal: Goal; entries: Entry[] }) {
  const marked = new Set(entries.filter(entry => entry.goal_id === goal.id).map(entry => entry.entry_date))
  const labels = ['SEG','TER','QUA','QUI','SEX','SÁB','DOM']
  return <div className="week-strip" aria-label="Dias desta semana">{weekDates().map((date, index) => <div key={date} title={formatDate(date)}><small>{labels[index]}</small><span className={marked.has(date) ? 'marked' : date === today() ? 'today' : ''} aria-label={marked.has(date) ? `Registro em ${formatDate(date)}` : `Sem registro em ${formatDate(date)}`}>{marked.has(date) ? <Check size={16}/> : date > today() ? '·' : ''}</span></div>)}</div>
}


function GoalCard({ goal, data, onClick }: { goal: Goal; data: AppData; onClick: () => void }) {
  const owner = data.members.find(m => m.id === goal.owner_id)
  const pct = progress(goal, data.entries)
  const recurring = goal.recurrence_type !== 'none'
  const recurringStatus = recurring ? recurringProgress(goal, data.entries, today()) : null
  const unpaid = recurring && goal.fine_amount > 0 ? recurringFines(goal, data.entries, data.finePayments, today()).filter(fine => !fine.paid).length : 0
  const isDone = pct >= 100 && (!recurring || goal.deadline < today())
  const overdue = goal.deadline < today() && !isDone
  return <button className="goal-card" onClick={onClick}>
    <div className="goal-card-top"><CardIcon category={goal.category}/><span className={`status-pill ${isDone ? 'done' : overdue || unpaid ? 'late' : ''}`}>{isDone ? 'Concluído' : overdue ? 'Encerrado' : unpaid ? `${unpaid} multa${unpaid === 1 ? '' : 's'}` : 'Em andamento'}</span></div>
    <div className="goal-card-body"><span className="eyebrow">{goal.category}</span><h3>{goal.title}</h3><p>{goal.description || 'Cada passo conta nessa jornada.'}</p></div>
    <div className="goal-card-progress">{recurring ? <div className="weekly-pill"><Flame size={12}/> {recurrenceLabel(goal)}</div> : goal.weekly_target && <div className="weekly-pill"><Flame size={12}/> Esta semana: {weekCount(goal,data.entries)}/{goal.weekly_target} dias</div>}<div className="row spread"><span>Progresso</span><strong>{pct}%</strong></div><ProgressBar value={pct}/><div className="row spread muted tiny"><span>{recurringStatus ? `${goal.recurrence_type === 'weekly' ? recurringStatus.recorded : recurringStatus.achieved} de ${recurringStatus.expected} ocorrências${goal.recurrence_type === 'weekly' && recurringStatus.recorded > recurringStatus.achieved ? ` · +${recurringStatus.recorded - recurringStatus.achieved} extra` : ''}` : `${completed(goal, data.entries)} de ${goal.target_value} ${goal.unit}`}</span><span><CalendarDays size={13}/> {formatDate(goal.deadline)}</span></div></div>
    <div className="goal-card-footer"><div className="row"><Avatar name={owner?.name || '?'} color={owner?.color || '#ccc'} small/><span>{owner?.name || 'Participante'}</span></div><span className="fine">{recurring ? unpaid ? `Pendente ${money(unpaid * Number(goal.fine_amount))}` : `Multa ${money(goal.fine_amount)} cada` : fineIsDue(goal,data.entries) && goal.fine_paid_at ? 'Multa paga' : `Multa ${money(goal.fine_amount)}`}</span></div>
  </button>
}

function Auth({ onDemo }: { onDemo: () => void }) {
  const [mode, setMode] = useState<'login'|'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault(); if (!supabase) return
    setBusy(true); setMessage('')
    try {
      const result = mode === 'signup' ? await supabase.auth.signUp({ email, password, options: { data: { display_name: name.trim() } } }) : await supabase.auth.signInWithPassword({ email, password })
      if (result.error) throw result.error
      if (mode === 'signup' && !result.data.session) setMessage('Conta criada. Confira seu e-mail para confirmar o acesso.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível continuar.') } finally { setBusy(false) }
  }
  return <div className="auth-shell"><div className="auth-left"><div className="brand light"><span className="brand-mark"><Flame size={22}/></span> juntos<span className="brand-dot">.</span></div><div className="auth-copy"><span className="hero-tag"><Sparkles size={14}/> DESAFIOS EM FAMÍLIA</span><h1>Crescer é melhor<br/>quando é <em>junto.</em></h1><p>Transforme metas individuais em conquistas compartilhadas. Um dia de cada vez, com quem torce por você.</p><div className="auth-people"><span className="avatar-stack"><Avatar name="Marina" color="#c4b9e8" small/><Avatar name="Rafael" color="#f2c5a8" small/><Avatar name="Camila" color="#9dc7c4" small/></span><span>Mais apoio. Mais conquistas.</span></div></div><div className="auth-decor decor-one"/><div className="auth-decor decor-two"/></div><div className="auth-right"><div className="auth-form-wrap"><div className="auth-mobile-brand brand"><span className="brand-mark"><Flame size={21}/></span> juntos<span className="brand-dot">.</span></div><span className="section-kicker">BEM-VINDO AO JUNTOS</span><h2>{mode === 'login' ? 'Que bom ter você de volta!' : 'Comece sua jornada'}</h2><p className="auth-subtitle">{mode === 'login' ? 'Entre para acompanhar os desafios da família.' : 'Crie sua conta para participar dos desafios.'}</p><form onSubmit={submit}>{mode === 'signup' && <label>Seu nome<input required value={name} onChange={e=>setName(e.target.value)} placeholder="Como podemos chamar você?" maxLength={50}/></label>}<label>E-mail<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com"/></label><label>Senha<input required type="password" minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Pelo menos 6 caracteres"/></label>{message && <p className="form-message">{message}</p>}<button disabled={busy} className="primary full">{busy ? 'Aguarde...' : mode === 'login' ? 'Entrar na minha conta' : 'Criar minha conta'} <ArrowRight size={17}/></button></form><p className="auth-switch">{mode === 'login' ? 'Ainda não tem conta?' : 'Já tem uma conta?'} <button onClick={()=>{setMode(mode === 'login' ? 'signup' : 'login'); setMessage('')}}>{mode === 'login' ? 'Cadastre-se' : 'Entre aqui'}</button></p><div className="auth-divider"><span>ou</span></div><button className="outline full" onClick={onDemo}>Explorar demonstração <ArrowRight size={16}/></button><p className="demo-note">Conheça a experiência com dados fictícios.</p></div></div></div>
}

function GroupSetup({ refresh }: { refresh: () => Promise<void> }) {
  const [mode, setMode] = useState<'create'|'join'>('create')
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { if (mode === 'create') await createGroup(name); else await joinGroup(code); await refresh() } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível continuar.') } finally { setBusy(false) } }
  return <div className="setup-shell"><div className="brand"><span className="brand-mark"><Flame size={22}/></span> juntos<span className="brand-dot">.</span></div><div className="setup-card"><span className="section-kicker">O PRIMEIRO PASSO</span><h1>Vamos reunir a família?</h1><p>Crie um espaço para seus desafios ou entre em um grupo com o código de convite.</p><div className="segmented"><button className={mode==='create'?'active':''} onClick={()=>setMode('create')}>Criar grupo</button><button className={mode==='join'?'active':''} onClick={()=>setMode('join')}>Entrar com código</button></div><form onSubmit={submit}><label>{mode==='create'?'Nome do grupo':'Código de convite'}<input required maxLength={mode==='create'?60:12} value={mode==='create'?name:code} onChange={e=>mode==='create'?setName(e.target.value):setCode(e.target.value.toUpperCase())} placeholder={mode==='create'?'Ex.: Família em movimento':'Ex.: A1B2C3D4'}/></label>{error&&<p className="form-message">{error}</p>}<button disabled={busy} className="primary full">{busy?'Aguarde...':mode==='create'?'Criar meu grupo':'Entrar no grupo'} <ArrowRight size={17}/></button></form><button className="text-button" onClick={()=>supabase?.auth.signOut()}>Sair da conta</button></div></div>
}

function GoalModal({ data, initial, onClose, onSave }: { data: AppData; initial?: Goal; onClose: () => void; onSave: (goal: Omit<Goal, 'id'|'created_at'>) => Promise<void> }) {
  const [title, setTitle] = useState(initial?.title ?? ''); const [description, setDescription] = useState(initial?.description ?? ''); const [category, setCategory] = useState(initial?.category ?? 'Saúde'); const [target, setTarget] = useState(initial?.target_value?.toString() ?? ''); const [unit, setUnit] = useState(initial?.unit ?? ''); const [deadline, setDeadline] = useState(initial?.deadline ?? ''); const [fine, setFine] = useState(initial?.fine_amount?.toString() ?? ''); const [weekly, setWeekly] = useState(initial?.weekly_target?.toString() ?? ''); const [recurrence, setRecurrence] = useState<RecurrenceType>(initial?.recurrence_type ?? 'none'); const [startDate, setStartDate] = useState(initial?.start_date ?? today()); const [fixedDays, setFixedDays] = useState(initial?.recurrence_type === 'weekly' && initial.weekday_mask != null); const [dailyCustomDays, setDailyCustomDays] = useState(initial?.recurrence_type === 'daily' && initial.weekday_mask != null); const [weekdayMask, setWeekdayMask] = useState(initial?.weekday_mask ?? 31); const [restDates, setRestDates] = useState(initial?.rest_dates ?? []); const [restDateInput, setRestDateInput] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  function addRestDate() {
    if (!restDateInput || restDateInput < today() || restDateInput < startDate || restDateInput > deadline) { setError('Escolha uma data de folga entre hoje e a data final do objetivo.'); return }
    if (restDates.includes(restDateInput)) { setError('Esta data já está marcada como folga.'); return }
    if (dailyCustomDays && !(weekdayMask & (1 << ((new Date(`${restDateInput}T12:00:00`).getDay() + 6) % 7)))) { setError('Este dia já é folga semanal.'); return }
    setRestDates(dates => [...dates, restDateInput].sort()); setRestDateInput(''); setError('')
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      if (recurrence !== 'none' && startDate > deadline) throw new Error('A data inicial precisa ser anterior ou igual à data final.')
      const weeklyTarget = recurrence === 'weekly' && fixedDays ? selectedWeekdayCount(weekdayMask) : Number(weekly)
      if (recurrence === 'weekly' && (!Number.isInteger(weeklyTarget) || weeklyTarget < 1 || weeklyTarget > 7)) throw new Error('Escolha de 1 a 7 dias por semana.')
      if (recurrence === 'daily' && dailyCustomDays && selectedWeekdayCount(weekdayMask) < 1) throw new Error('Deixe ao menos um dia ativo na semana.')
      if (recurrence === 'daily' && restDates.some(day => day < startDate || day > deadline)) throw new Error('As folgas precisam estar dentro do período do objetivo.')
      if (recurrence === 'weekly' && fixedDays && !Array.from({ length: 7 }, (_, index) => { const day = new Date(`${startDate}T12:00:00`); day.setDate(day.getDate() + index); return day }).some(day => day <= new Date(`${deadline}T12:00:00`) && Boolean(weekdayMask & (1 << ((day.getDay() + 6) % 7))))) throw new Error('Escolha um período que inclua ao menos um dos dias selecionados.')
      await onSave({ group_id: data.group.id, owner_id: data.me, title: title.trim(), description: description.trim(), category, target_value: Number(target), weekly_target: recurrence === 'weekly' ? weeklyTarget : weekly ? Number(weekly) : null, weekday_mask: recurrence === 'weekly' && fixedDays || recurrence === 'daily' && dailyCustomDays ? weekdayMask : null, rest_dates: recurrence === 'daily' ? restDates : [], unit: unit.trim(), deadline, fine_amount: Number(fine || 0), recurrence_type: recurrence, start_date: recurrence === 'none' ? null : startDate, fine_paid_at: initial?.fine_paid_at ?? null, deleted_at: null })
      onClose()
    } catch(err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar o objetivo.') } finally { setBusy(false) }
  }
  return <Modal onClose={onClose}><div className="modal-heading"><span className="section-kicker">UM NOVO COMEÇO</span><h2>{initial ? 'Pedir edição' : 'Criar objetivo'}</h2><p>{initial ? 'As mudanças serão aplicadas quando a família autorizar.' : 'Uma grande conquista começa com uma meta bem definida.'}</p></div><form className="modal-form" onSubmit={submit}>
    <label>Qual é o objetivo?<input autoFocus required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Ir à academia 20 vezes"/></label>
    <label>Conte um pouco mais<textarea maxLength={500} value={description} onChange={e=>setDescription(e.target.value)} placeholder="O que você pretende fazer?" rows={3}/></label>
    <div className="form-grid"><label>Categoria<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Data final<input required type="date" min={today()} value={deadline} onChange={e=>setDeadline(e.target.value)}/></label></div>
    <label>Repetição<select value={recurrence} onChange={e=>{const next=e.target.value as RecurrenceType; setRecurrence(next); if (next === 'daily') setWeekdayMask(127); if (next === 'weekly') setWeekdayMask(31)}}><option value="none">Uma vez, até a data final</option><option value="daily">Todos os dias</option><option value="weekly">Vários dias por semana</option><option value="monthly">Todo mês</option><option value="yearly">Todo ano</option></select></label>
    {recurrence !== 'none' && <label>Começar em<input required type="date" min={initial?.start_date && initial.start_date < today() ? initial.start_date : today()} max={deadline || undefined} value={startDate} onChange={e=>setStartDate(e.target.value)}/></label>}
    <div className="form-grid"><label>{recurrence === 'none' ? 'Meta numérica' : recurrence === 'weekly' ? 'Meta em cada dia escolhido' : recurrence === 'daily' ? 'Meta por dia' : recurrence === 'monthly' ? 'Meta por mês' : 'Meta por ano'}<input required type="number" min="0.01" step="0.01" value={target} onChange={e=>setTarget(e.target.value)} placeholder={recurrence === 'daily' ? 'Ex.: 4' : 'Ex.: 20'}/></label><label>Unidade<input required maxLength={30} value={unit} onChange={e=>setUnit(e.target.value)} placeholder="treinos, km, horas..."/></label></div>
    {recurrence === 'weekly' && <label>Como escolher os dias?<select value={fixedDays ? 'fixed' : 'flexible'} onChange={e=>setFixedDays(e.target.value === 'fixed')}><option value="flexible">Quaisquer dias da semana</option><option value="fixed">Dias fixos da semana</option></select></label>}
    {recurrence === 'daily' && <label>Folgas semanais<select value={dailyCustomDays ? 'custom' : 'none'} onChange={e=>{setDailyCustomDays(e.target.value === 'custom'); if (e.target.value === 'custom' && weekdayMask === 31) setWeekdayMask(127)}}><option value="none">Sem folga semanal (todos os dias)</option><option value="custom">Escolher dias de folga</option></select></label>}
    {recurrence === 'weekly' && fixedDays && <fieldset className="weekday-picker"><legend>Em quais dias?</legend><div>{weekdayNames.map((name, index) => <label key={name} className={weekdayMask & (1 << index) ? 'selected' : ''}><input type="checkbox" checked={Boolean(weekdayMask & (1 << index))} onChange={() => setWeekdayMask(mask => mask ^ (1 << index))}/>{name}</label>)}</div><small>{selectedWeekdayCount(weekdayMask)} {selectedWeekdayCount(weekdayMask) === 1 ? 'dia selecionado' : 'dias selecionados'} por semana.</small></fieldset>}
    {recurrence === 'daily' && dailyCustomDays && <fieldset className="weekday-picker"><legend>Quais dias são folga?</legend><div>{weekdayNames.map((name, index) => <label key={name} className={!(weekdayMask & (1 << index)) ? 'selected' : ''}><input type="checkbox" checked={!Boolean(weekdayMask & (1 << index))} onChange={() => setWeekdayMask(mask => mask ^ (1 << index))}/>{name}</label>)}</div><small>{selectedWeekdayCount(weekdayMask)} {selectedWeekdayCount(weekdayMask) === 1 ? 'dia ativo' : 'dias ativos'} por semana, cada um avaliado separadamente.</small></fieldset>}
    {recurrence === 'daily' && <div className="rest-date-picker"><label>Folga em data específica (feriado ou exceção)<input type="date" min={startDate > today() ? startDate : today()} max={deadline || undefined} value={restDateInput} onChange={e=>setRestDateInput(e.target.value)}/></label><button type="button" className="outline" onClick={addRestDate}>Adicionar folga</button>{restDates.length > 0 && <div className="rest-date-list">{restDates.map(day => <span key={day}>{formatDate(day)}{day >= today() && <button type="button" aria-label={`Remover folga em ${formatDate(day)}`} onClick={() => setRestDates(dates => dates.filter(date => date !== day))}><X size={14}/></button>}</span>)}</div>}<small>Folgas pontuais devem ser cadastradas antes do dia terminar. Em objetivos já criados, a família precisa aprovar a mudança.</small></div>}
    {(recurrence === 'none' || recurrence === 'weekly' && !fixedDays) && <label>{recurrence === 'weekly' ? 'Quantos dias por semana?' : 'Frequência por semana (opcional)'}<input type="number" required={recurrence === 'weekly'} min="1" max="7" step="1" value={weekly} onChange={e=>setWeekly(e.target.value)} placeholder="Ex.: 5 dias por semana"/></label>}
    <label>{recurrence === 'none' ? 'Multa se não cumprir (R$)' : 'Multa por ocorrência não cumprida (R$)'}<input type="number" min="0" step="0.01" value={fine} onChange={e=>setFine(e.target.value)} placeholder="0,00"/></label>
    {recurrence !== 'none' && <p className="recurrence-hint">{recurrence === 'daily' ? `Cada dia ativo exige ${target || 'a meta'} ${unit || 'unidade(s)'} e é avaliado separadamente. Folgas semanais e datas específicas não geram multa.` : recurrence === 'weekly' ? fixedDays ? `Cada dia selecionado precisa atingir ${target || 'a meta'} ${unit}. Os demais dias não contam nem geram multa.` : `Cada dia precisa atingir ${target || 'a meta'} ${unit}; ${weekly || 'N'} dias por semana.` : recurrence === 'monthly' ? 'A meta é reiniciada a cada mês, inclusive no primeiro e no último mês.' : 'A meta é reiniciada a cada ano, inclusive no primeiro e no último ano.'} Registros recorrentes só podem ser feitos no próprio dia; esquecer de registrar não pode ser corrigido depois. Períodos encerrados com falta geram multa por ocorrência.</p>}
    <p className="helper"><CircleHelp size={15}/> A multa é informativa; o QR Code Pix fica na página Minha família.</p>{error&&<p className="form-message">{error}</p>}<div className="modal-actions"><button type="button" className="outline" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy?'Salvando...':initial?'Enviar pedido':'Criar objetivo'} <ArrowRight size={16}/></button></div>
  </form></Modal>
}
function EntryModal({ goal, data, onClose, onSave }: { goal: Goal; data: AppData; onClose: () => void; onSave: (entry: Omit<Entry,'id'|'created_at'>, photo?: File) => Promise<void> }) {
  const [date, setDate] = useState(today()); const [amount, setAmount] = useState(goal.recurrence_type === 'daily' || goal.recurrence_type === 'weekly' ? String(goal.target_value) : '1'); const [note, setNote] = useState(''); const [photo, setPhoto] = useState<File>(); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { await onSave({ goal_id: goal.id, author_id: data.me, entry_date: goal.recurrence_type === 'none' ? date : today(), amount: Number(amount), note: note.trim(), photo_path: null }, photo); onClose() } catch(err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar o registro.') } finally { setBusy(false) } }
  return <Modal onClose={onClose}><div className="modal-heading"><span className="section-kicker">CADA PASSO IMPORTA</span><h2>Registrar progresso</h2><p>{goal.title}</p></div><form className="modal-form" onSubmit={submit}><div className="form-grid">{goal.recurrence_type === 'none' ? <label>Data<input type="date" required max={goal.deadline < today() ? goal.deadline : today()} value={date} onChange={e=>setDate(e.target.value)}/></label> : <label>Data do registro<input type="date" value={today()} disabled/><small>Metas recorrentes só aceitam registros de hoje.</small></label>}<label>Quanto avançou? ({goal.unit})<input type="number" required min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label></div><label>Como foi?<textarea rows={4} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Conte como foi seu dia, uma pequena vitória ou algo que aprendeu..."/></label><label className="photo-input"><Camera size={20}/><span>{photo ? photo.name : 'Adicionar foto (opcional, até 5 MB)'}</span><input type="file" accept="image/*" onChange={e=>setPhoto(e.target.files?.[0])}/></label>{error&&<p className="form-message">{error}</p>}<div className="modal-actions"><button type="button" className="outline" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy?'Salvando...':'Salvar progresso'} <Check size={17}/></button></div></form></Modal>
}
function RestDayModal({ goal, onClose, onSave }: { goal: Goal; onClose: () => void; onSave: (date: string) => Promise<void> }) {
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try { await onSave(date); onClose() }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível pedir a folga.') }
    finally { setBusy(false) }
  }
  return <Modal onClose={onClose}><div className="modal-heading"><span className="section-kicker">UMA PAUSA COMBINADA</span><h2>Pedir dia de folga</h2><p>{goal.title}</p></div><form className="modal-form" onSubmit={submit}><label>Data da folga<input required type="date" min={goal.start_date && goal.start_date > today() ? goal.start_date : today()} max={goal.deadline} value={date} onChange={e=>setDate(e.target.value)}/></label><p className="recurrence-hint">Peça até o próprio dia. A folga entra em vigor após a aprovação da família, mesmo que a votação termine depois.</p>{error && <p className="form-message" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="outline" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy ? 'Enviando...' : 'Enviar pedido'} <ArrowRight size={16}/></button></div></form></Modal>
}
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) { return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal" role="dialog" aria-modal="true"><button className="modal-close" aria-label="Fechar" onClick={onClose}><X size={20}/></button>{children}</div></div> }
function Photo({ path }: { path: string }) { const [url,setUrl] = useState<string|null>(null); useEffect(()=>{let alive=true; (path.startsWith('data:') ? Promise.resolve(path) : photoUrl(path)).then(result=>{if(alive)setUrl(result)}); return ()=>{alive=false}},[path]); return url ? <img className="entry-photo" src={url} alt="Foto do progresso"/> : null }

function GoalDetail({ goal, data, onBack, onRegister, onCompleteToday, completingToday, onEdit, onRestDay, onDeleteGoal, onDeleteEntry, onFinePaid, onRecurringFinePaid, onVote, onCancel }: { goal: Goal; data: AppData; onBack: () => void; onRegister: () => void; onCompleteToday: () => Promise<void>; completingToday: boolean; onEdit: () => void; onRestDay: () => void; onDeleteGoal: () => Promise<void>; onDeleteEntry: (entry: Entry) => Promise<void>; onFinePaid: (paid: boolean) => Promise<void>; onRecurringFinePaid: (fine: RecurringFine, paid: boolean) => Promise<void>; onVote: (request: GoalChangeRequest, approved: boolean) => Promise<void>; onCancel: (request: GoalChangeRequest) => Promise<void> }) {
  const owner = data.members.find(m => m.id === goal.owner_id)
  const entries = data.entries.filter(entry => entry.goal_id === goal.id).sort((a, b) => b.entry_date.localeCompare(a.entry_date))
  const pct = progress(goal, data.entries)
  const overdue = fineIsDue(goal, data.entries)
  const recurring = goal.recurrence_type !== 'none'
  const recurringStatus = recurring ? recurringProgress(goal, data.entries, today()) : null
  const recurringFineItems = recurring ? recurringFines(goal, data.entries, data.finePayments, today()) : []
  const unpaidRecurring = recurringFineItems.filter(fine => !fine.paid)
  const isDone = pct >= 100 && (!recurring || goal.deadline < today())
  const todayAmount = entries.filter(entry => entry.entry_date === today()).reduce((sum, entry) => sum + Number(entry.amount), 0)
  const canRegisterToday = goal.deadline >= today() && (!goal.start_date || goal.start_date <= today()) && isScheduledDay(goal, today())
  const mine = goal.owner_id === data.me
  const pending = data.requests.find(request => request.goal_id === goal.id && request.status === 'pending')
  return <div className="page-content">
    <button className="back-link" onClick={onBack}><ArrowLeft size={18}/> Voltar aos objetivos</button>
    <div className="detail-hero"><div><div className="row gap"><CardIcon category={goal.category}/><span className="eyebrow">{goal.category}</span></div><h1>{goal.title}</h1><p>{goal.description}</p><div className="detail-meta"><span><Avatar name={owner?.name||'?'} color={owner?.color||'#ccc'} small/> {owner?.name}</span><span><CalendarDays size={16}/> {recurring && goal.start_date ? `De ${formatDate(goal.start_date)} até ${formatDate(goal.deadline)}` : `Até ${formatDate(goal.deadline)}`}</span><span><Wallet size={16}/> Multa {money(goal.fine_amount)}{recurring ? ' por ocorrência' : ''}</span></div></div><div className="detail-ring"><strong>{pct}%</strong><small>concluído</small></div></div>
    <div className="detail-grid"><div>
      <div className="white-card goal-summary"><div className="row spread"><h2>Sua jornada</h2><span className={`status-pill ${isDone?'done':overdue?'late':''}`}>{isDone?'Concluído':goal.deadline < today()?'Encerrado':'Em andamento'}</span></div>
        {recurring ? <div className="weekly-detail"><Flame size={16}/> {recurrenceLabel(goal)}: <strong>{goal.target_value} {goal.unit}{goal.recurrence_type === 'weekly' ? ' em cada dia' : ''}</strong></div> : goal.weekly_target && goal.deadline >= today() && <><div className="weekly-detail"><Flame size={16}/> Nesta semana: <strong>{weekCount(goal,data.entries)} de {goal.weekly_target} dias</strong></div><WeekStrip goal={goal} entries={data.entries}/></>}
        {goal.recurrence_type === 'daily' && Boolean(goal.rest_dates?.length) && <p className="rest-summary">Folgas pontuais: {goal.rest_dates?.map(formatDate).join(', ')}</p>}
        <div className="big-progress"><strong>{recurringStatus ? goal.recurrence_type === 'weekly' ? recurringStatus.recorded : recurringStatus.achieved : completed(goal,data.entries)}</strong><span> / {recurringStatus ? `${recurringStatus.expected} ocorrências` : `${goal.target_value} ${goal.unit}`}</span></div><ProgressBar value={pct}/>
        {goal.recurrence_type === 'weekly' && recurringStatus && recurringStatus.recorded > recurringStatus.achieved && <p>{recurringStatus.recorded - recurringStatus.achieved} {recurringStatus.recorded - recurringStatus.achieved === 1 ? 'dia extra registrado' : 'dias extras registrados'} além da meta mínima.</p>}
        <p>{recurring ? 'Registre no próprio dia. Não é possível recuperar um dia esquecido depois.' : goal.deadline < today() ? 'O prazo terminou. O progresso considera registros feitos até a data final.' : 'Continue registrando cada passo. O importante é seguir em frente!'}</p>
        {recurring && goal.start_date && goal.start_date > today() && <p className="start-notice"><CalendarDays size={16}/> Esta meta começa em {formatDate(goal.start_date)}. Você poderá registrar a partir desse dia. Para começar hoje, peça a edição da data inicial.</p>}
        {recurring && goal.recurrence_type === 'weekly' && goal.weekday_mask != null && goal.start_date && goal.start_date <= today() && goal.deadline >= today() && !isScheduledDay(goal, today()) && <p className="start-notice"><CalendarDays size={16}/> Hoje não é um dos dias escolhidos para esta meta. Registre apenas nos dias indicados acima.</p>}
        {recurring && goal.recurrence_type === 'daily' && goal.start_date && goal.start_date <= today() && goal.deadline >= today() && !isScheduledDay(goal, today()) && <p className="start-notice"><CalendarDays size={16}/> Hoje é folga neste objetivo. Não há registro obrigatório nem multa para este dia.</p>}
        {mine && <div className="detail-actions">{canRegisterToday && (goal.recurrence_type === 'daily' || goal.recurrence_type === 'weekly') && todayAmount < Number(goal.target_value) && <button className="primary" disabled={completingToday} onClick={onCompleteToday}><Check size={17}/> {completingToday ? 'Salvando...' : 'Marcar hoje como cumprido'}</button>}{canRegisterToday && (goal.recurrence_type === 'daily' || goal.recurrence_type === 'weekly') && todayAmount >= Number(goal.target_value) && <span className="today-done"><CheckCircle2 size={16}/> Hoje cumprido</span>}{canRegisterToday && <button className="outline" onClick={onRegister}><Plus size={17}/> Registrar progresso</button>}{goal.recurrence_type === 'daily' && goal.deadline >= today() && !pending && <button className="outline" onClick={onRestDay}><CalendarDays size={16}/> Pedir folga</button>}{goal.deadline >= today() && !pending && <button className="outline" onClick={onEdit}>Pedir edição</button>}{!pending && <button className="outline danger-button" onClick={onDeleteGoal}><Trash2 size={15}/> Pedir exclusão</button>}</div>}
      </div>
      {recurringStatus && <div className="white-card recurring-calendar"><div className="row spread"><h2>Ocorrências</h2><small>{goal.recurrence_type === 'weekly' ? recurringStatus.recorded : recurringStatus.achieved} de {recurringStatus.expected} registradas</small></div><div className="recurring-period-list">{recurringStatus.periods.slice(-40).reverse().map(period => <div key={period.start} className="recurring-period"><span>{goal.recurrence_type === 'daily' ? formatDate(period.start) : `${formatDate(period.start)} – ${formatDate(period.end)}`}</span><strong className={period.closed && period.missed ? 'recurring-missed' : period.achieved >= period.expected ? 'recurring-met' : ''}>{goal.recurrence_type === 'weekly' ? period.recorded : period.achieved}/{period.expected}{period.recorded > period.achieved ? ` · +${period.recorded - period.achieved} extra` : ''}{period.closed && period.missed ? ` · ${period.missed} pendente${period.missed === 1 ? '' : 's'}` : ''}</strong></div>)}</div>{recurringStatus.periods.length > 40 && <small>Mostrando os 40 períodos mais recentes.</small>}</div>}
      {pending && <div className="goal-request"><RequestCard request={pending} data={data} onVote={onVote} onCancel={onCancel}/></div>}
      <div className="section-heading activity-heading"><div><span className="section-kicker">DIÁRIO DE BORDO</span><h2>Registros de progresso</h2></div><span className="count-pill">{entries.length} registros</span></div>
      {entries.length === 0 ? <Empty title="Ainda não há registros" text="O primeiro passo pode ser hoje."/> : <div className="timeline">{entries.map(entry => <div className="timeline-entry" key={entry.id}><span className="timeline-dot"/><div className="entry-head"><span>{formatDate(entry.entry_date)}</span><div className="row gap"><strong>+{entry.amount} {goal.unit}</strong>{mine && <button className="entry-delete" aria-label="Excluir registro" title="Excluir registro" onClick={() => onDeleteEntry(entry)}><Trash2 size={15}/></button>}</div></div>{entry.note && <p>{entry.note}</p>}{entry.photo_path && <Photo path={entry.photo_path}/>}</div>)}</div>}
    </div><aside className="detail-aside"><div className="aside-card"><span className="aside-icon"><Sparkles size={21}/></span><h3>Um dia de cada vez</h3><p>As grandes conquistas são feitas de pequenos passos consistentes. Continue!</p></div>
      <div className="aside-card subtle"><h3>Sobre a multa</h3>{recurring ? <><p><strong>{money(goal.fine_amount)}</strong> por ocorrência não cumprida. Pendente: <strong>{money(unpaidRecurring.length * Number(goal.fine_amount))}</strong>.</p><div className="recurring-fines">{recurringFineItems.map(fine => <div className="recurring-fine" key={`${fine.periodStart}:${fine.occurrenceIndex}`}><span>{fine.label}<small>{fine.paid ? 'Pagamento marcado como feito' : money(goal.fine_amount)}</small></span>{mine && goal.fine_amount > 0 && <button className="outline" onClick={() => onRecurringFinePaid(fine, !fine.paid)}>{fine.paid ? 'Desfazer' : 'Marcar paga'}</button>}</div>)}</div>{!recurringFineItems.length && <p>Nenhuma ocorrência vencida com multa.</p>}</> : <><p>{overdue ? 'O objetivo terminou sem atingir a meta.' : `Se a meta não for atingida até ${formatDate(goal.deadline)}, a multa combinada é de`} <strong>{money(goal.fine_amount)}</strong>.</p>
      {overdue && goal.fine_paid_at && <p className="fine-paid"><CheckCircle2 size={15}/> Pagamento marcado como feito</p>}
      {overdue && mine && goal.fine_amount > 0 && <button className="outline fine-button" onClick={() => onFinePaid(!goal.fine_paid_at)}>{goal.fine_paid_at ? 'Desfazer pagamento' : 'Marcar como paga'}</button>}</>}
      {(recurring ? unpaidRecurring.length > 0 : overdue && !goal.fine_paid_at) && goal.fine_amount > 0 && data.group.pix_qr_path && <div className="pix-payment"><strong>Pix do grupo para pagar a multa</strong><PixImage path={data.group.pix_qr_path}/><small>Confira o destinatário antes de pagar.</small></div>}
      <p>O pagamento é combinado entre vocês, fora do site.</p></div>
      <div className="aside-card subtle"><h3>Regra do grupo</h3><p>{ruleText(data.group, Math.max(0, data.members.length - 1))} para cada pedido de edição ou exclusão.</p></div>
    </aside></div>
  </div>
}

function App() {
  const [demo, setDemo] = useState(!cloudEnabled)
  const [userId, setUserId] = useState<string|null>(null)
  const [authReady, setAuthReady] = useState(!cloudEnabled)
  const [data, setData] = useState<AppData|null>(!cloudEnabled ? loadDemo() : null)
  const [refreshingGoals, setRefreshingGoals] = useState(false)
  const [refreshGoalsError, setRefreshGoalsError] = useState('')
  const [page, setPage] = useState<Page>('overview')
  const [selectedGoal, setSelectedGoal] = useState<string|null>(null)
  const [modal, setModal] = useState<'goal'|'edit_goal'|'entry'|'rest_day'|null>(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [filter, setFilter] = useState<'all'|'mine'>('all')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [completingToday, setCompletingToday] = useState(false)
  const [, setCalendarDay] = useState(today())
  useEffect(() => { const timer = window.setInterval(() => { const current = today(); setCalendarDay(previous => previous === current ? previous : current) }, 60000); return () => window.clearInterval(timer) }, [])
  useEffect(()=>{ if(!supabase)return; supabase.auth.getUser().then(({data})=>{setUserId(data.user?.id||null);setAuthReady(true)}); const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{setUserId(session?.user?.id||null);setAuthReady(true)}); return ()=>subscription.unsubscribe() },[])
  async function refresh(id=userId) { if(!id)return; const next=await fetchData(id); setData(next) }
  useEffect(()=>{ if(!demo&&userId) refresh(userId).catch(err=>setError(err.message)); else if(!demo) setData(null) },[userId,demo])
  function updateDemo(next: AppData) { saveDemo(next); setData(next) }
  async function refreshGoals() {
    if (refreshingGoals) return
    setRefreshingGoals(true)
    setRefreshGoalsError('')
    try {
      if (demo) setData(loadDemo())
      else await refresh()
      setNotice('Objetivos atualizados!')
    } catch (err) {
      setRefreshGoalsError(err instanceof Error ? err.message : 'Não foi possível atualizar os objetivos.')
    } finally {
      setRefreshingGoals(false)
    }
  }
  async function chooseRank(name: string) {
    if (!data) return
    if (demo) updateDemo({ ...data, members: data.members.map(member => member.id === data.me ? { ...member, selected_rank: name } : member) })
    else { await saveSelectedRank(data.me, name); await refresh() }
    setNotice(`Patente ${name} selecionada!`)
  }
  async function saveGoal(goal: Omit<Goal,'id'|'created_at'>) {
    if (modal === 'edit_goal' && detail) {
      const proposal: GoalProposal = { title: goal.title, description: goal.description, category: goal.category, target_value: goal.target_value, weekly_target: goal.weekly_target, weekday_mask: goal.weekday_mask ?? null, rest_dates: goal.rest_dates ?? [], unit: goal.unit, deadline: goal.deadline, fine_amount: goal.fine_amount, recurrence_type: goal.recurrence_type, start_date: goal.start_date }
      if (demo) updateDemo(requestDemoChange(data!, detail, 'edit', proposal))
      else { await requestGoalChange(detail, 'edit', proposal); await refresh() }
      setNotice(data!.members.length === 1 ? 'Objetivo atualizado!' : 'Pedido de edição enviado à família.')
    } else {
      if (demo) updateDemo({ ...data!, goals: [{ ...goal, id: crypto.randomUUID(), created_at: new Date().toISOString() }, ...data!.goals] })
      else { await addGoal(goal); await refresh() }
      setNotice('Objetivo criado com sucesso!')
    }
  }
  async function requestRestDay(day: string) {
    if (!data || !detail || detail.owner_id !== data.me || detail.recurrence_type !== 'daily') return
    if (!day || day < today() || (detail.start_date && day < detail.start_date) || day > detail.deadline) throw new Error('Escolha uma data de hoje até o fim do objetivo.')
    if (!isScheduledDay(detail, day)) throw new Error('Este dia já é folga neste objetivo.')
    const proposal: GoalProposal = { title: detail.title, description: detail.description, category: detail.category, target_value: detail.target_value, weekly_target: detail.weekly_target, weekday_mask: detail.weekday_mask ?? null, rest_dates: [...(detail.rest_dates ?? []), day].sort(), unit: detail.unit, deadline: detail.deadline, fine_amount: detail.fine_amount, recurrence_type: detail.recurrence_type, start_date: detail.start_date }
    if (demo) updateDemo(requestDemoChange(data, detail, 'edit', proposal))
    else { await requestGoalChange(detail, 'edit', proposal); await refresh() }
    setNotice(data.members.length === 1 ? 'Folga marcada!' : 'Pedido de folga enviado à família.')
  }
  async function deleteGoal() {
    if (!data || !detail || detail.owner_id !== data.me || !window.confirm(`Solicitar a exclusão de "${detail.title}"? A família precisará autorizar conforme a regra do grupo.`)) return
    try {
      if (demo) updateDemo(requestDemoChange(data, detail, 'delete', null))
      else { await requestGoalChange(detail, 'delete'); await refresh() }
      if (data.members.length === 1) setSelectedGoal(null)
      setNotice(data.members.length === 1 ? 'Objetivo excluído.' : 'Pedido de exclusão enviado à família.')
    } catch (err) { window.alert(err instanceof Error ? err.message : 'Não foi possível solicitar a exclusão.') }
  }
  async function voteRequest(request: GoalChangeRequest, approved: boolean) {
    if (!data) return
    try {
      if (demo) updateDemo(voteDemoChange(data, request, approved))
      else { await voteGoalChange(request.id, approved); await refresh() }
      setNotice(approved ? 'Seu voto foi registrado.' : 'Sua recusa foi registrada.')
    } catch (err) { window.alert(err instanceof Error ? err.message : 'Não foi possível registrar o voto.') }
  }
  async function cancelRequest(request: GoalChangeRequest) {
    if (!data || !window.confirm('Cancelar este pedido?')) return
    try {
      if (demo) updateDemo(cancelDemoChange(data, request))
      else { await cancelGoalChange(request.id); await refresh() }
      setNotice('Pedido cancelado.')
    } catch (err) { window.alert(err instanceof Error ? err.message : 'Não foi possível cancelar o pedido.') }
  }
  async function saveEntry(entry: Omit<Entry,'id'|'created_at'>, photo?: File) {
    const goal = data?.goals.find(item => item.id === entry.goal_id)
    if (!goal || entry.entry_date > goal.deadline || entry.entry_date > today() || (goal.start_date && entry.entry_date < goal.start_date)) throw new Error('Escolha uma data dentro do período do objetivo.')
    if (goal.recurrence_type !== 'none' && entry.entry_date !== today()) throw new Error('Metas recorrentes só aceitam registros feitos no próprio dia.')
    if (!isScheduledDay(goal, entry.entry_date)) throw new Error('Este dia não faz parte dos dias escolhidos para o objetivo.')
    if (demo && data) {
      if (photo) {
        if (!photo.type.startsWith('image/') || photo.size > 1024 * 1024) throw new Error('Na demonstração, escolha uma imagem de até 1 MB.')
        entry.photo_path = await new Promise<string>((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Não foi possível ler a foto.')); reader.readAsDataURL(photo) })
      }
      updateDemo({ ...data, entries: [{ ...entry, id: crypto.randomUUID(), created_at: new Date().toISOString() }, ...data.entries] })
    } else { await addEntry(entry, photo); await refresh() }
    setNotice('Progresso registrado!')
  }
  async function completeToday() {
    if (!data || !detail || detail.owner_id !== data.me || !['daily', 'weekly'].includes(detail.recurrence_type) || (detail.start_date !== null && detail.start_date > today()) || detail.deadline < today() || !isScheduledDay(detail, today()) || completingToday) return
    const logged = data.entries.filter(entry => entry.goal_id === detail.id && entry.entry_date === today()).reduce((sum, entry) => sum + Number(entry.amount), 0)
    const missing = Math.round((Number(detail.target_value) - logged) * 100) / 100
    if (missing <= 0) return
    setCompletingToday(true)
    try { await saveEntry({ goal_id: detail.id, author_id: data.me, entry_date: today(), amount: missing, note: 'Meta de hoje cumprida.', photo_path: null }) }
    catch (err) { window.alert(err instanceof Error ? err.message : 'Não foi possível registrar hoje.') }
    finally { setCompletingToday(false) }
  }
  async function deleteLog(entry: Entry) {
    if (!data || entry.author_id !== data.me || !window.confirm('Excluir este registro? O progresso será recalculado.')) return
    try {
      if (demo) updateDemo({ ...data, entries: data.entries.filter(item => item.id !== entry.id) })
      else { await removeEntry(entry); await refresh() }
      setNotice('Registro excluído.')
    } catch (err) { window.alert(err instanceof Error ? err.message : 'Não foi possível excluir o registro.') }
  }
  async function changeFinePaid(paid: boolean) {
    if (!data || !detail || detail.owner_id !== data.me || !fineIsDue(detail, data.entries)) return
    try {
      if (demo) updateDemo({ ...data, goals: data.goals.map(item => item.id === detail.id ? { ...item, fine_paid_at: paid ? new Date().toISOString() : null } : item) })
      else { await setFinePaid(detail, paid); await refresh() }
      setNotice(paid ? 'Multa marcada como paga.' : 'Pagamento desfeito.')
    } catch (err) { window.alert(err instanceof Error ? err.message : 'Não foi possível atualizar a multa.') }
  }
  async function changeRecurringFinePaid(fine: RecurringFine, paid: boolean) {
    if (!data || !detail || detail.owner_id !== data.me || detail.recurrence_type === 'none') return
    try {
      if (demo) updateDemo({ ...data, finePayments: paid ? [...data.finePayments, { goal_id: detail.id, period_start: fine.periodStart, occurrence_index: fine.occurrenceIndex, paid_at: new Date().toISOString() }] : data.finePayments.filter(item => !(item.goal_id === detail.id && item.period_start === fine.periodStart && item.occurrence_index === fine.occurrenceIndex)) })
      else { await setRecurringFinePaid(detail, fine.periodStart, fine.occurrenceIndex, paid); await refresh() }
      setNotice(paid ? 'Multa marcada como paga.' : 'Pagamento desfeito.')
    } catch (err) { window.alert(err instanceof Error ? err.message : 'Não foi possível atualizar a multa.') }
  }
  async function changeGroupRule(mode: ApprovalMode, value: number) {
    if (!data || data.group.created_by !== data.me) return
    if (demo) updateDemo({ ...data, group: { ...data.group, approval_mode: mode, approval_value: value } })
    else { await saveGroupRule(data.group, mode, value); await refresh() }
    setNotice('Regra do grupo atualizada.')
  }
  async function changeGroupPix(file: File) {
    if (!data || data.group.created_by !== data.me) return
    if (demo) {
      if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 1024 * 1024) throw new Error('Na demonstração, escolha uma imagem PNG, JPG, WebP ou GIF de até 1 MB.')
      const path = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Não foi possível ler a imagem.')); reader.readAsDataURL(file) })
      updateDemo({ ...data, group: { ...data.group, pix_qr_path: path } })
    } else { await uploadGroupPix(data.group, file); await refresh() }
    setNotice('QR Code Pix salvo.')
  }
  async function clearGroupPix() {
    if (!data || data.group.created_by !== data.me || !window.confirm('Remover o QR Code Pix do grupo?')) return
    if (demo) updateDemo({ ...data, group: { ...data.group, pix_qr_path: null } })
    else { await removeGroupPix(data.group); await refresh() }
    setNotice('QR Code Pix removido.')
  }
  function navigate(next:Page) {setPage(next);setSelectedGoal(null);setMobileMenu(false);window.scrollTo(0,0);if((next==='family'||next==='achievements')&&!demo)refresh().catch(err=>setError(err.message))}
  if(!authReady) return <div className="loading">Carregando...</div>
  if(!demo&&!userId) return <Auth onDemo={()=>{setDemo(true);setData(loadDemo())}}/>
  if(!demo&&!data) return error ? <div className="setup-shell"><div className="setup-card"><h2>Não foi possível carregar</h2><p>{error}</p><button className="primary" onClick={()=>refresh().catch(err=>setError(err.message))}>Tentar novamente</button></div></div> : <GroupSetup refresh={async()=>{await refresh()}}/>
  if(!data) return <div className="loading">Carregando...</div>
  const me=data.members.find(m=>m.id===data.me) || data.members[0]
  const myGoals=data.goals.filter(g=>g.owner_id===data.me)
  const activeGoals=data.goals.filter(g=>g.deadline>=today()&&(g.recurrence_type!=='none'||progress(g,data.entries)<100))
  const doneGoals=data.goals.filter(g=>progress(g,data.entries)>=100&&(g.recurrence_type==='none'||g.deadline<today()))
  const totalFines=data.goals.reduce((sum,g)=>sum+(g.recurrence_type!=='none'?recurringFines(g,data.entries,data.finePayments,today()).filter(fine=>!fine.paid).length:Number(unpaidFine(g,data.entries)))*Number(g.fine_amount),0)
  const ranking=data.members.map(member=>{const goals=data.goals.filter(g=>g.owner_id===member.id); const pct=goals.length?Math.round(goals.reduce((sum,g)=>sum+progress(g,data.entries),0)/goals.length):0; const entryDates=data.entries.filter(e=>goals.some(g=>g.id===e.goal_id)).map(e=>e.entry_date).sort().reverse(); return {...member, goals:goals.length, completed:goals.filter(g=>progress(g,data.entries)>=100&&(g.recurrence_type==='none'||g.deadline<today())).length, pct, absent:entryDates.length?daysSince(entryDates[0]):null}}).sort((a,b)=>b.pct-a.pct)
  const detail=data.goals.find(g=>g.id===selectedGoal)
  const navItems: {id:Page; label:string; Icon:typeof Home}[]=[{id:'overview',label:'Visão geral',Icon:Home},{id:'goals',label:'Objetivos',Icon:Target},{id:'ranking',label:'Ranking',Icon:Trophy},{id:'achievements',label:'Conquistas',Icon:Award},{id:'family',label:'Minha família',Icon:Users}]
  return <div className="app-shell"><aside className={`sidebar ${mobileMenu?'open':''}`}><div className="brand"><span className="brand-mark"><Flame size={22}/></span> juntos<span className="brand-dot">.</span></div><div className="sidebar-label">MENU PRINCIPAL</div><nav>{navItems.map(({id,label,Icon})=><button key={id} onClick={()=>navigate(id)} className={page===id&&!selectedGoal?'active':''}><Icon size={20}/>{label}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-promo"><span className="promo-sparkle"><Sparkles size={21}/></span><strong>Juntos vamos mais longe.</strong><p>Celebre cada pequena conquista com a sua família.</p></div><button className="profile" onClick={()=>{if(demo&&cloudEnabled){setDemo(false);setData(null)}else if(!demo)supabase?.auth.signOut()}}><Avatar name={me.name} color={me.color}/><span><strong>{me.name}</strong><small>{demo?'Modo demonstração':'Minha conta'}</small></span>{cloudEnabled&&<LogOut size={16}/>}</button></div></aside><div className="main-area"><header className="topbar"><button className="mobile-menu" onClick={()=>setMobileMenu(!mobileMenu)} aria-label="Abrir menu"><Menu size={22}/></button><div className="topbar-breadcrumb">{data.group.name} <span>/</span> <strong>{detail?'Objetivo':navItems.find(x=>x.id===page)?.label}</strong></div><div className="topbar-right">{demo&&<span className="demo-badge">Demonstração</span>}<Avatar name={me.name} color={me.color} small/></div></header><main>{notice&&<div className="toast" role="status"><CheckCircle2 size={18}/>{notice}<button onClick={()=>setNotice('')}><X size={16}/></button></div>}{detail?<GoalDetail goal={detail} data={data} onBack={()=>setSelectedGoal(null)} onRegister={()=>setModal('entry')} onCompleteToday={completeToday} completingToday={completingToday} onEdit={()=>setModal('edit_goal')} onRestDay={()=>setModal('rest_day')} onDeleteGoal={deleteGoal} onDeleteEntry={deleteLog} onFinePaid={changeFinePaid} onRecurringFinePaid={changeRecurringFinePaid} onVote={voteRequest} onCancel={cancelRequest}/>:<div className="page-content">
  {page==='overview'&&<><div className="welcome"><div><span className="section-kicker">SEU ESPAÇO DE CONQUISTAS</span><h1>Olá, {me.name.split(' ')[0]} <span className="wave">✳</span></h1><p>Pequenos passos hoje, grandes conquistas amanhã. Veja como a família está indo!</p></div><button className="primary" onClick={()=>setModal('goal')}><Plus size={18}/> Novo objetivo</button></div><div className="hero-banner"><div className="hero-pattern p1"/><div className="hero-pattern p2"/><div className="hero-banner-content"><span className="hero-banner-kicker"><Sparkles size={15}/> UMA JORNADA COMPARTILHADA</span><h2>O melhor de cada meta<br/>é ter com quem <em>celebrar.</em></h2><p>Registre seu progresso, inspire sua família e siga em frente.</p><button onClick={()=>navigate('goals')}>Ver todos os objetivos <ArrowRight size={16}/></button></div><div className="hero-illustration"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><span className="hero-star star-one">✦</span><span className="hero-star star-two">✳</span><div className="hero-trophy"><Trophy size={76} strokeWidth={1.5}/></div><span className="hero-blob blob-one"/><span className="hero-blob blob-two"/></div></div><div className="stat-grid"><div className="stat-card"><span className="stat-icon sage"><Target size={20}/></span><span>Objetivos ativos</span><strong>{activeGoals.length.toString().padStart(2,'0')}</strong><small>Metas em andamento</small></div><div className="stat-card"><span className="stat-icon lavender"><CheckCircle2 size={20}/></span><span>Concluídos</span><strong>{doneGoals.length.toString().padStart(2,'0')}</strong><small>Conquistas da família</small></div><div className="stat-card"><span className="stat-icon peach"><Users size={20}/></span><span>Participantes</span><strong>{data.members.length.toString().padStart(2,'0')}</strong><small>Juntos nessa jornada</small></div><div className="stat-card"><span className="stat-icon yellow"><Wallet size={20}/></span><span>Multas pendentes</span><strong className="stat-money">{money(totalFines)}</strong><small>Metas vencidas e incompletas</small></div></div><div className="dashboard-grid"><div><div className="section-heading"><div><span className="section-kicker">ACOMPANHE DE PERTO</span><h2>Objetivos em destaque</h2></div><button className="link-button" onClick={()=>navigate('goals')}>Ver todos <ArrowRight size={16}/></button></div><div className="goal-grid">{data.goals.slice(0,4).map(goal=><GoalCard key={goal.id} goal={goal} data={data} onClick={()=>{setSelectedGoal(goal.id);window.scrollTo(0,0)}}/>)}</div></div><aside className="dashboard-aside"><div className="section-heading"><div><span className="section-kicker">CELEBRE CADA PASSO</span><h2>Quem está na frente?</h2></div></div><div className="ranking-card">{ranking.slice(0,4).map((member,i)=><div className="ranking-row" key={member.id}><span className={`rank-number rank-${i+1}`}>{i+1}</span><Avatar name={member.name} color={member.color} small/><span className="rank-name">{member.name}</span><strong>{member.pct}%</strong></div>)}<button onClick={()=>navigate('ranking')}>Ver ranking completo <ArrowRight size={16}/></button></div><div className="aside-card encouragement"><span className="aside-icon"><Flame size={21}/></span><h3>Você consegue!</h3><p>A consistência vale mais que a perfeição. Que tal registrar seu progresso de hoje?</p></div></aside></div></>}
  {page==='goals'&&<><div className="page-title-row"><div><span className="section-kicker">CADA META CONTA</span><h1>Objetivos da família</h1><p>Acompanhe o que cada um está construindo, dia após dia.</p></div><div className="goal-heading-actions"><button className="outline" onClick={refreshGoals} disabled={refreshingGoals} aria-busy={refreshingGoals}><RefreshCw size={17}/>{refreshingGoals ? 'Atualizando...' : 'Atualizar objetivos'}</button><button className="primary" onClick={()=>setModal('goal')}><Plus size={18}/> Novo objetivo</button></div></div>{refreshGoalsError&&<p className="form-message" role="alert">{refreshGoalsError}</p>}<div className="filter-tabs"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Todos <span>{data.goals.length}</span></button><button className={filter==='mine'?'active':''} onClick={()=>setFilter('mine')}>Meus objetivos <span>{myGoals.length}</span></button></div>{(filter==='all'?data.goals:myGoals).length?<div className="goal-grid all-goals">{(filter==='all'?data.goals:myGoals).map(goal=><GoalCard key={goal.id} goal={goal} data={data} onClick={()=>{setSelectedGoal(goal.id);window.scrollTo(0,0)}}/>)}</div>:<Empty title="Nenhum objetivo por aqui" text="Crie o primeiro objetivo e comece sua jornada."/>}</>}
  {page==='ranking'&&<><div className="page-title-row"><div><span className="section-kicker">CELEBRAR TAMBÉM MOTIVA</span><h1>Ranking da família</h1><p>Uma visão carinhosa do progresso de todos.</p></div><span className="ranking-decoration"><Trophy size={38}/></span></div><div className="ranking-intro"><Sparkles size={21}/><span>O ranking usa a <strong>média de progresso dos objetivos</strong> de cada pessoa. Cada conquista tem seu próprio ritmo!</span></div><div className="ranking-list">{ranking.map((member,i)=><div className="ranking-list-row" key={member.id}><span className={`rank-number big rank-${i+1}`}>{i+1}</span><Avatar name={member.name} color={member.color}/><div className="ranking-person"><strong>{member.name}</strong><small>{member.goals} {member.goals===1?'objetivo':'objetivos'} · {member.completed} {member.completed===1?'concluído':'concluídos'}</small></div><div className="ranking-bar"><ProgressBar value={member.pct} color={i===0?'orange':'green'}/></div><strong className="ranking-percent">{member.pct}%</strong></div>)}</div><div className="section-heading activity-heading"><div><span className="section-kicker">UM EMPURRÃOZINHO FAZ BEM</span><h2>Tempo desde o último registro</h2></div></div><div className="absence-list">{[...ranking].sort((a,b)=>(b.absent??999)-(a.absent??999)).map(member=><div key={member.id}><Avatar name={member.name} color={member.color} small/><span>{member.name}</span><strong>{member.absent===null?'Sem registros':member.absent===0?'Registrou hoje':`${member.absent} ${member.absent===1?'dia':'dias'} sem registrar`}</strong></div>)}</div></>}
  {page==='achievements'&&<Achievements data={data} onSelectGoal={id=>{setSelectedGoal(id);window.scrollTo(0,0)}} onSelectRank={chooseRank}/>}
  {page==='family'&&<><div className="page-title-row"><div><span className="section-kicker">MELHOR QUANDO É JUNTO</span><h1>Minha família</h1><p>O seu time de apoio nessa jornada.</p></div><span className="ranking-decoration"><Users size={38}/></span></div><div className="family-grid"><div className="white-card family-card"><span className="section-kicker">NOSSO GRUPO</span><h2>{data.group.name}</h2><p>{data.members.length} participantes reunidos para crescer juntos.</p><div className="family-avatars">{data.members.map(member=><Avatar key={member.id} name={member.name} color={member.color}/>)}</div></div><div className="white-card invite-card"><span className="section-kicker">CHAME MAIS GENTE</span><h2>Convide seus primos</h2><p>Compartilhe o código abaixo. Eles podem criar uma conta e entrar no seu grupo.</p><div className="invite-code"><strong>{data.group.invite_code}</strong><button onClick={async()=>{try {await navigator.clipboard.writeText(data.group.invite_code);setNotice('Código copiado!')}catch{setNotice('Selecione e copie o código exibido.')}}}>Copiar código</button></div>{demo&&<small>Este código é apenas ilustrativo. Crie um grupo real para convidar pessoas.</small>}</div></div><GroupSettings group={data.group} memberCount={data.members.length} me={data.me} onSaveRule={changeGroupRule} onUploadPix={changeGroupPix} onRemovePix={clearGroupPix}/>{demo&&<div className="demo-switch"><label>Testar como participante<select value={data.me} onChange={e=>updateDemo({...data,me:e.target.value})}>{data.members.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select></label><p>Na demonstração, troque de participante para testar as votações.</p></div>}<RequestsSection data={data} onVote={voteRequest} onCancel={cancelRequest} onRefresh={async()=>{if(demo)setData(loadDemo());else await refresh()}}/><div className="section-heading activity-heading"><div><span className="section-kicker">QUEM FAZ PARTE</span><h2>Participantes</h2></div></div><div className="member-grid">{data.members.map(member=><div className="member-card" key={member.id}><Avatar name={member.name} color={member.color}/><div><strong>{member.name}{member.id===data.me?' (você)':''}</strong><small>{data.goals.filter(g=>g.owner_id===member.id).length} objetivos</small></div></div>)}</div></>}
</div>}</main></div>{(modal==='goal'||modal==='edit_goal')&&<GoalModal data={data} initial={modal==='edit_goal'?detail:undefined} onClose={()=>setModal(null)} onSave={saveGoal}/ >}{modal==='entry'&&detail&&<EntryModal goal={detail} data={data} onClose={()=>setModal(null)} onSave={saveEntry}/ >}{modal==='rest_day'&&detail&&<RestDayModal goal={detail} onClose={()=>setModal(null)} onSave={requestRestDay}/>}</div>
}
export default App
