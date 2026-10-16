import { useEffect, useState, type FormEvent } from 'react'
import { Activity, ArrowLeft, ArrowRight, BookOpen, CalendarDays, Camera, Check, CheckCircle2, CircleHelp, Flame, Home, LogOut, Menu, Plus, Sparkles, Target, Trash2, TrendingUp, Trophy, Users, Wallet, X } from 'lucide-react'
import { addEntry, addGoal, cloudEnabled, createGroup, editGoal, fetchData, joinGroup, photoUrl, removeEntry, setFinePaid, supabase } from './cloud'
import { loadDemo, saveDemo } from './demo'
import { type AppData, type Entry, type Goal, completed, daysSince, fineIsDue, formatDate, initials, money, progress, today, unpaidFine, weekCount, weekDates } from './types'

type Page = 'overview' | 'goals' | 'ranking' | 'family'
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
  const isDone = pct >= 100
  const overdue = goal.deadline < today() && !isDone
  return <button className="goal-card" onClick={onClick}>
    <div className="goal-card-top"><CardIcon category={goal.category}/><span className={`status-pill ${isDone ? 'done' : overdue ? 'late' : ''}`}>{isDone ? 'Concluído' : overdue ? 'Encerrado' : 'Em andamento'}</span></div>
    <div className="goal-card-body"><span className="eyebrow">{goal.category}</span><h3>{goal.title}</h3><p>{goal.description || 'Cada passo conta nessa jornada.'}</p></div>
    <div className="goal-card-progress">{goal.weekly_target && <div className="weekly-pill"><Flame size={12}/> Esta semana: {weekCount(goal,data.entries)}/{goal.weekly_target} dias</div>}<div className="row spread"><span>Progresso</span><strong>{pct}%</strong></div><ProgressBar value={pct}/><div className="row spread muted tiny"><span>{completed(goal, data.entries)} de {goal.target_value} {goal.unit}</span><span><CalendarDays size={13}/> {formatDate(goal.deadline)}</span></div></div>
    <div className="goal-card-footer"><div className="row"><Avatar name={owner?.name || '?'} color={owner?.color || '#ccc'} small/><span>{owner?.name || 'Participante'}</span></div><span className="fine">{fineIsDue(goal,data.entries) && goal.fine_paid_at ? "Multa paga" : `Multa ${money(goal.fine_amount)}`}</span></div>
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
  const [title, setTitle] = useState(initial?.title ?? ''); const [description, setDescription] = useState(initial?.description ?? ''); const [category, setCategory] = useState(initial?.category ?? 'Saúde'); const [target, setTarget] = useState(initial?.target_value?.toString() ?? ''); const [unit, setUnit] = useState(initial?.unit ?? ''); const [deadline, setDeadline] = useState(initial?.deadline ?? ''); const [fine, setFine] = useState(initial?.fine_amount?.toString() ?? ''); const [weekly, setWeekly] = useState(initial?.weekly_target?.toString() ?? ''); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { await onSave({ group_id: data.group.id, owner_id: data.me, title: title.trim(), description: description.trim(), category, target_value: Number(target), weekly_target: weekly ? Number(weekly) : null, unit: unit.trim(), deadline, fine_amount: Number(fine || 0), fine_paid_at: initial?.fine_paid_at ?? null }); onClose() } catch(err) { setError(err instanceof Error ? err.message : 'Não foi possível criar o objetivo.') } finally { setBusy(false) } }
  return <Modal onClose={onClose}><div className="modal-heading"><span className="section-kicker">UM NOVO COMEÇO</span><h2>{initial ? "Editar objetivo" : "Criar objetivo"}</h2><p>Uma grande conquista começa com uma meta bem definida.</p></div><form className="modal-form" onSubmit={submit}><label>Qual é o objetivo?<input autoFocus required maxLength={100} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex.: Ir à academia 20 vezes"/></label><label>Conte um pouco mais<textarea maxLength={500} value={description} onChange={e=>setDescription(e.target.value)} placeholder="O que você pretende fazer?" rows={3}/></label><div className="form-grid"><label>Categoria<select value={category} onChange={e=>setCategory(e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>Data final<input required type="date" min={today()} value={deadline} onChange={e=>setDeadline(e.target.value)}/></label></div><div className="form-grid"><label>Meta numérica<input required type="number" min="0.01" step="0.01" value={target} onChange={e=>setTarget(e.target.value)} placeholder="Ex.: 20"/></label><label>Unidade<input required maxLength={30} value={unit} onChange={e=>setUnit(e.target.value)} placeholder="treinos, km, horas..."/></label></div><label>Frequência por semana (opcional)<input type="number" min="1" max="7" step="1" value={weekly} onChange={e=>setWeekly(e.target.value)} placeholder="Ex.: 5 dias por semana"/></label><label>Multa se não cumprir (R$)<input type="number" min="0" step="0.01" value={fine} onChange={e=>setFine(e.target.value)} placeholder="0,00"/></label><p className="helper"><CircleHelp size={15}/> A multa é apenas registrada; o site não faz cobranças.</p>{error&&<p className="form-message">{error}</p>}<div className="modal-actions"><button type="button" className="outline" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy?'Salvando...':initial?'Salvar alterações':'Criar objetivo'} <ArrowRight size={16}/></button></div></form></Modal>
}
function EntryModal({ goal, data, onClose, onSave }: { goal: Goal; data: AppData; onClose: () => void; onSave: (entry: Omit<Entry,'id'|'created_at'>, photo?: File) => Promise<void> }) {
  const [date, setDate] = useState(today()); const [amount, setAmount] = useState('1'); const [note, setNote] = useState(''); const [photo, setPhoto] = useState<File>(); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); setError(''); try { await onSave({ goal_id: goal.id, author_id: data.me, entry_date: date, amount: Number(amount), note: note.trim(), photo_path: null }, photo); onClose() } catch(err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar o registro.') } finally { setBusy(false) } }
  return <Modal onClose={onClose}><div className="modal-heading"><span className="section-kicker">CADA PASSO IMPORTA</span><h2>Registrar progresso</h2><p>{goal.title}</p></div><form className="modal-form" onSubmit={submit}><div className="form-grid"><label>Data<input type="date" required max={goal.deadline < today() ? goal.deadline : today()} value={date} onChange={e=>setDate(e.target.value)}/></label><label>Quanto avançou? ({goal.unit})<input type="number" required min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label></div><label>Como foi?<textarea rows={4} maxLength={1000} value={note} onChange={e=>setNote(e.target.value)} placeholder="Conte como foi seu dia, uma pequena vitória ou algo que aprendeu..."/></label><label className="photo-input"><Camera size={20}/><span>{photo ? photo.name : 'Adicionar foto (opcional, até 5 MB)'}</span><input type="file" accept="image/*" onChange={e=>setPhoto(e.target.files?.[0])}/></label>{error&&<p className="form-message">{error}</p>}<div className="modal-actions"><button type="button" className="outline" onClick={onClose}>Cancelar</button><button className="primary" disabled={busy}>{busy?'Salvando...':'Salvar progresso'} <Check size={17}/></button></div></form></Modal>
}
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) { return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal" role="dialog" aria-modal="true"><button className="modal-close" aria-label="Fechar" onClick={onClose}><X size={20}/></button>{children}</div></div> }
function Photo({ path }: { path: string }) { const [url,setUrl] = useState<string|null>(null); useEffect(()=>{let alive=true; (path.startsWith('data:') ? Promise.resolve(path) : photoUrl(path)).then(result=>{if(alive)setUrl(result)}); return ()=>{alive=false}},[path]); return url ? <img className="entry-photo" src={url} alt="Foto do progresso"/> : null }

function GoalDetail({ goal, data, onBack, onRegister, onEdit, onDeleteEntry, onFinePaid }: { goal: Goal; data: AppData; onBack: () => void; onRegister: () => void; onEdit: () => void; onDeleteEntry: (entry: Entry) => Promise<void>; onFinePaid: (paid: boolean) => Promise<void> }) {
  const owner = data.members.find(m => m.id === goal.owner_id)
  const entries = data.entries.filter(entry => entry.goal_id === goal.id).sort((a, b) => b.entry_date.localeCompare(a.entry_date))
  const pct = progress(goal, data.entries)
  const overdue = fineIsDue(goal, data.entries)
  const mine = goal.owner_id === data.me
  return <div className="page-content">
    <button className="back-link" onClick={onBack}><ArrowLeft size={18}/> Voltar aos objetivos</button>
    <div className="detail-hero"><div><div className="row gap"><CardIcon category={goal.category}/><span className="eyebrow">{goal.category}</span></div><h1>{goal.title}</h1><p>{goal.description}</p><div className="detail-meta"><span><Avatar name={owner?.name||'?'} color={owner?.color||'#ccc'} small/> {owner?.name}</span><span><CalendarDays size={16}/> Até {formatDate(goal.deadline)}</span><span><Wallet size={16}/> Multa {money(goal.fine_amount)}</span></div></div><div className="detail-ring"><strong>{pct}%</strong><small>concluído</small></div></div>
    <div className="detail-grid"><div>
      <div className="white-card goal-summary"><div className="row spread"><h2>Sua jornada</h2><span className={`status-pill ${pct>=100?'done':overdue?'late':''}`}>{pct>=100?'Concluído':overdue?'Encerrado':'Em andamento'}</span></div>
        {goal.weekly_target && goal.deadline >= today() && <><div className="weekly-detail"><Flame size={16}/> Nesta semana: <strong>{weekCount(goal,data.entries)} de {goal.weekly_target} dias</strong></div><WeekStrip goal={goal} entries={data.entries}/></>}
        <div className="big-progress"><strong>{completed(goal,data.entries)}</strong><span> / {goal.target_value} {goal.unit}</span></div><ProgressBar value={pct}/>
        <p>{goal.deadline < today() ? 'O prazo terminou. O progresso considera registros feitos até a data final.' : 'Continue registrando cada passo. O importante é seguir em frente!'}</p>
        {mine && goal.deadline >= today() && <div className="detail-actions"><button className="primary" onClick={onRegister}><Plus size={17}/> Registrar progresso</button><button className="outline" onClick={onEdit}>Editar objetivo</button></div>}
      </div>
      <div className="section-heading activity-heading"><div><span className="section-kicker">DIÁRIO DE BORDO</span><h2>Registros de progresso</h2></div><span className="count-pill">{entries.length} registros</span></div>
      {entries.length === 0 ? <Empty title="Ainda não há registros" text="O primeiro passo pode ser hoje."/> : <div className="timeline">{entries.map(entry => <div className="timeline-entry" key={entry.id}><span className="timeline-dot"/><div className="entry-head"><span>{formatDate(entry.entry_date)}</span><div className="row gap"><strong>+{entry.amount} {goal.unit}</strong>{mine && <button className="entry-delete" aria-label="Excluir registro" title="Excluir registro" onClick={() => onDeleteEntry(entry)}><Trash2 size={15}/></button>}</div></div>{entry.note && <p>{entry.note}</p>}{entry.photo_path && <Photo path={entry.photo_path}/>}</div>)}</div>}
    </div><aside className="detail-aside"><div className="aside-card"><span className="aside-icon"><Sparkles size={21}/></span><h3>Um dia de cada vez</h3><p>As grandes conquistas são feitas de pequenos passos consistentes. Continue!</p></div>
      <div className="aside-card subtle"><h3>Sobre a multa</h3><p>{overdue ? 'O objetivo terminou sem atingir a meta.' : `Se a meta não for atingida até ${formatDate(goal.deadline)}, a multa combinada é de`} <strong>{money(goal.fine_amount)}</strong>.</p>
      {overdue && goal.fine_paid_at && <p className="fine-paid"><CheckCircle2 size={15}/> Pagamento marcado como feito</p>}
      {overdue && mine && goal.fine_amount > 0 && <button className="outline fine-button" onClick={() => onFinePaid(!goal.fine_paid_at)}>{goal.fine_paid_at ? 'Desfazer pagamento' : 'Marcar como paga'}</button>}
      <p>O pagamento é combinado entre vocês, fora do site.</p></div>
    </aside></div>
  </div>
}

function App() {
  const [demo, setDemo] = useState(!cloudEnabled)
  const [userId, setUserId] = useState<string|null>(null)
  const [authReady, setAuthReady] = useState(!cloudEnabled)
  const [data, setData] = useState<AppData|null>(!cloudEnabled ? loadDemo() : null)
  const [page, setPage] = useState<Page>('overview')
  const [selectedGoal, setSelectedGoal] = useState<string|null>(null)
  const [modal, setModal] = useState<'goal'|'edit_goal'|'entry'|null>(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [filter, setFilter] = useState<'all'|'mine'>('all')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(()=>{ if(!supabase)return; supabase.auth.getUser().then(({data})=>{setUserId(data.user?.id||null);setAuthReady(true)}); const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{setUserId(session?.user?.id||null);setAuthReady(true)}); return ()=>subscription.unsubscribe() },[])
  async function refresh(id=userId) { if(!id)return; const next=await fetchData(id); setData(next) }
  useEffect(()=>{ if(!demo&&userId) refresh(userId).catch(err=>setError(err.message)); else if(!demo) setData(null) },[userId,demo])
  function updateDemo(next: AppData) { saveDemo(next); setData(next) }
  async function saveGoal(goal: Omit<Goal,'id'|'created_at'>) {
    if (modal === 'edit_goal' && detail) {
      const updated = { ...detail, ...goal }
      if (demo) updateDemo({ ...data!, goals: data!.goals.map(item => item.id === detail.id ? updated : item) })
      else { await editGoal(updated); await refresh() }
      setNotice('Objetivo atualizado!')
    } else {
      if (demo) updateDemo({ ...data!, goals: [{ ...goal, id: crypto.randomUUID(), created_at: new Date().toISOString() }, ...data!.goals] })
      else { await addGoal(goal); await refresh() }
      setNotice('Objetivo criado com sucesso!')
    }
  }
  async function saveEntry(entry: Omit<Entry,'id'|'created_at'>, photo?: File) {
    const goal = data?.goals.find(item => item.id === entry.goal_id)
    if (!goal || entry.entry_date > goal.deadline || entry.entry_date > today()) throw new Error('Escolha uma data até o prazo do objetivo.')
    if (demo && data) {
      if (photo) {
        if (!photo.type.startsWith('image/') || photo.size > 1024 * 1024) throw new Error('Na demonstração, escolha uma imagem de até 1 MB.')
        entry.photo_path = await new Promise<string>((resolve,reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('Não foi possível ler a foto.')); reader.readAsDataURL(photo) })
      }
      updateDemo({ ...data, entries: [{ ...entry, id: crypto.randomUUID(), created_at: new Date().toISOString() }, ...data.entries] })
    } else { await addEntry(entry, photo); await refresh() }
    setNotice('Progresso registrado!')
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
  function navigate(next:Page) {setPage(next);setSelectedGoal(null);setMobileMenu(false);window.scrollTo(0,0)}
  if(!authReady) return <div className="loading">Carregando...</div>
  if(!demo&&!userId) return <Auth onDemo={()=>{setDemo(true);setData(loadDemo())}}/>
  if(!demo&&!data) return error ? <div className="setup-shell"><div className="setup-card"><h2>Não foi possível carregar</h2><p>{error}</p><button className="primary" onClick={()=>refresh().catch(err=>setError(err.message))}>Tentar novamente</button></div></div> : <GroupSetup refresh={async()=>{await refresh()}}/>
  if(!data) return <div className="loading">Carregando...</div>
  const me=data.members.find(m=>m.id===data.me) || data.members[0]
  const myGoals=data.goals.filter(g=>g.owner_id===data.me)
  const activeGoals=data.goals.filter(g=>g.deadline>=today()&&progress(g,data.entries)<100)
  const doneGoals=data.goals.filter(g=>progress(g,data.entries)>=100)
  const totalFines=data.goals.filter(g=>unpaidFine(g,data.entries)).reduce((sum,g)=>sum+Number(g.fine_amount),0)
  const ranking=data.members.map(member=>{const goals=data.goals.filter(g=>g.owner_id===member.id); const pct=goals.length?Math.round(goals.reduce((sum,g)=>sum+progress(g,data.entries),0)/goals.length):0; const entryDates=data.entries.filter(e=>goals.some(g=>g.id===e.goal_id)).map(e=>e.entry_date).sort().reverse(); return {...member, goals:goals.length, completed:goals.filter(g=>progress(g,data.entries)>=100).length, pct, absent:entryDates.length?daysSince(entryDates[0]):null}}).sort((a,b)=>b.pct-a.pct)
  const detail=data.goals.find(g=>g.id===selectedGoal)
  const navItems: {id:Page; label:string; Icon:typeof Home}[]=[{id:'overview',label:'Visão geral',Icon:Home},{id:'goals',label:'Objetivos',Icon:Target},{id:'ranking',label:'Ranking',Icon:Trophy},{id:'family',label:'Minha família',Icon:Users}]
  return <div className="app-shell"><aside className={`sidebar ${mobileMenu?'open':''}`}><div className="brand"><span className="brand-mark"><Flame size={22}/></span> juntos<span className="brand-dot">.</span></div><div className="sidebar-label">MENU PRINCIPAL</div><nav>{navItems.map(({id,label,Icon})=><button key={id} onClick={()=>navigate(id)} className={page===id&&!selectedGoal?'active':''}><Icon size={20}/>{label}</button>)}</nav><div className="sidebar-bottom"><div className="sidebar-promo"><span className="promo-sparkle"><Sparkles size={21}/></span><strong>Juntos vamos mais longe.</strong><p>Celebre cada pequena conquista com a sua família.</p></div><button className="profile" onClick={()=>{if(demo&&cloudEnabled){setDemo(false);setData(null)}else if(!demo)supabase?.auth.signOut()}}><Avatar name={me.name} color={me.color}/><span><strong>{me.name}</strong><small>{demo?'Modo demonstração':'Minha conta'}</small></span>{cloudEnabled&&<LogOut size={16}/>}</button></div></aside><div className="main-area"><header className="topbar"><button className="mobile-menu" onClick={()=>setMobileMenu(!mobileMenu)} aria-label="Abrir menu"><Menu size={22}/></button><div className="topbar-breadcrumb">{data.group.name} <span>/</span> <strong>{detail?'Objetivo':navItems.find(x=>x.id===page)?.label}</strong></div><div className="topbar-right">{demo&&<span className="demo-badge">Demonstração</span>}<Avatar name={me.name} color={me.color} small/></div></header><main>{notice&&<div className="toast" role="status"><CheckCircle2 size={18}/>{notice}<button onClick={()=>setNotice('')}><X size={16}/></button></div>}{detail?<GoalDetail goal={detail} data={data} onBack={()=>setSelectedGoal(null)} onRegister={()=>setModal('entry')} onEdit={()=>setModal('edit_goal')} onDeleteEntry={deleteLog} onFinePaid={changeFinePaid}/>:<div className="page-content">
  {page==='overview'&&<><div className="welcome"><div><span className="section-kicker">SEU ESPAÇO DE CONQUISTAS</span><h1>Olá, {me.name.split(' ')[0]} <span className="wave">✳</span></h1><p>Pequenos passos hoje, grandes conquistas amanhã. Veja como a família está indo!</p></div><button className="primary" onClick={()=>setModal('goal')}><Plus size={18}/> Novo objetivo</button></div><div className="hero-banner"><div className="hero-pattern p1"/><div className="hero-pattern p2"/><div className="hero-banner-content"><span className="hero-banner-kicker"><Sparkles size={15}/> UMA JORNADA COMPARTILHADA</span><h2>O melhor de cada meta<br/>é ter com quem <em>celebrar.</em></h2><p>Registre seu progresso, inspire sua família e siga em frente.</p><button onClick={()=>navigate('goals')}>Ver todos os objetivos <ArrowRight size={16}/></button></div><div className="hero-illustration"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><span className="hero-star star-one">✦</span><span className="hero-star star-two">✳</span><div className="hero-trophy"><Trophy size={76} strokeWidth={1.5}/></div><span className="hero-blob blob-one"/><span className="hero-blob blob-two"/></div></div><div className="stat-grid"><div className="stat-card"><span className="stat-icon sage"><Target size={20}/></span><span>Objetivos ativos</span><strong>{activeGoals.length.toString().padStart(2,'0')}</strong><small>Metas em andamento</small></div><div className="stat-card"><span className="stat-icon lavender"><CheckCircle2 size={20}/></span><span>Concluídos</span><strong>{doneGoals.length.toString().padStart(2,'0')}</strong><small>Conquistas da família</small></div><div className="stat-card"><span className="stat-icon peach"><Users size={20}/></span><span>Participantes</span><strong>{data.members.length.toString().padStart(2,'0')}</strong><small>Juntos nessa jornada</small></div><div className="stat-card"><span className="stat-icon yellow"><Wallet size={20}/></span><span>Multas pendentes</span><strong className="stat-money">{money(totalFines)}</strong><small>Metas vencidas e incompletas</small></div></div><div className="dashboard-grid"><div><div className="section-heading"><div><span className="section-kicker">ACOMPANHE DE PERTO</span><h2>Objetivos em destaque</h2></div><button className="link-button" onClick={()=>navigate('goals')}>Ver todos <ArrowRight size={16}/></button></div><div className="goal-grid">{data.goals.slice(0,4).map(goal=><GoalCard key={goal.id} goal={goal} data={data} onClick={()=>{setSelectedGoal(goal.id);window.scrollTo(0,0)}}/>)}</div></div><aside className="dashboard-aside"><div className="section-heading"><div><span className="section-kicker">CELEBRE CADA PASSO</span><h2>Quem está na frente?</h2></div></div><div className="ranking-card">{ranking.slice(0,4).map((member,i)=><div className="ranking-row" key={member.id}><span className={`rank-number rank-${i+1}`}>{i+1}</span><Avatar name={member.name} color={member.color} small/><span className="rank-name">{member.name}</span><strong>{member.pct}%</strong></div>)}<button onClick={()=>navigate('ranking')}>Ver ranking completo <ArrowRight size={16}/></button></div><div className="aside-card encouragement"><span className="aside-icon"><Flame size={21}/></span><h3>Você consegue!</h3><p>A consistência vale mais que a perfeição. Que tal registrar seu progresso de hoje?</p></div></aside></div></>}
  {page==='goals'&&<><div className="page-title-row"><div><span className="section-kicker">CADA META CONTA</span><h1>Objetivos da família</h1><p>Acompanhe o que cada um está construindo, dia após dia.</p></div><button className="primary" onClick={()=>setModal('goal')}><Plus size={18}/> Novo objetivo</button></div><div className="filter-tabs"><button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Todos <span>{data.goals.length}</span></button><button className={filter==='mine'?'active':''} onClick={()=>setFilter('mine')}>Meus objetivos <span>{myGoals.length}</span></button></div>{(filter==='all'?data.goals:myGoals).length?<div className="goal-grid all-goals">{(filter==='all'?data.goals:myGoals).map(goal=><GoalCard key={goal.id} goal={goal} data={data} onClick={()=>{setSelectedGoal(goal.id);window.scrollTo(0,0)}}/>)}</div>:<Empty title="Nenhum objetivo por aqui" text="Crie o primeiro objetivo e comece sua jornada."/>}</>}
  {page==='ranking'&&<><div className="page-title-row"><div><span className="section-kicker">CELEBRAR TAMBÉM MOTIVA</span><h1>Ranking da família</h1><p>Uma visão carinhosa do progresso de todos.</p></div><span className="ranking-decoration"><Trophy size={38}/></span></div><div className="ranking-intro"><Sparkles size={21}/><span>O ranking usa a <strong>média de progresso dos objetivos</strong> de cada pessoa. Cada conquista tem seu próprio ritmo!</span></div><div className="ranking-list">{ranking.map((member,i)=><div className="ranking-list-row" key={member.id}><span className={`rank-number big rank-${i+1}`}>{i+1}</span><Avatar name={member.name} color={member.color}/><div className="ranking-person"><strong>{member.name}</strong><small>{member.goals} {member.goals===1?'objetivo':'objetivos'} · {member.completed} {member.completed===1?'concluído':'concluídos'}</small></div><div className="ranking-bar"><ProgressBar value={member.pct} color={i===0?'orange':'green'}/></div><strong className="ranking-percent">{member.pct}%</strong></div>)}</div><div className="section-heading activity-heading"><div><span className="section-kicker">UM EMPURRÃOZINHO FAZ BEM</span><h2>Tempo desde o último registro</h2></div></div><div className="absence-list">{[...ranking].sort((a,b)=>(b.absent??999)-(a.absent??999)).map(member=><div key={member.id}><Avatar name={member.name} color={member.color} small/><span>{member.name}</span><strong>{member.absent===null?'Sem registros':member.absent===0?'Registrou hoje':`${member.absent} ${member.absent===1?'dia':'dias'} sem registrar`}</strong></div>)}</div></>}
  {page==='family'&&<><div className="page-title-row"><div><span className="section-kicker">MELHOR QUANDO É JUNTO</span><h1>Minha família</h1><p>O seu time de apoio nessa jornada.</p></div><span className="ranking-decoration"><Users size={38}/></span></div><div className="family-grid"><div className="white-card family-card"><span className="section-kicker">NOSSO GRUPO</span><h2>{data.group.name}</h2><p>{data.members.length} participantes reunidos para crescer juntos.</p><div className="family-avatars">{data.members.map(member=><Avatar key={member.id} name={member.name} color={member.color}/>)}</div></div><div className="white-card invite-card"><span className="section-kicker">CHAME MAIS GENTE</span><h2>Convide seus primos</h2><p>Compartilhe o código abaixo. Eles podem criar uma conta e entrar no seu grupo.</p><div className="invite-code"><strong>{data.group.invite_code}</strong><button onClick={async()=>{try {await navigator.clipboard.writeText(data.group.invite_code);setNotice('Código copiado!')}catch{setNotice('Selecione e copie o código exibido.')}}}>Copiar código</button></div>{demo&&<small>Este código é apenas ilustrativo. Crie um grupo real para convidar pessoas.</small>}</div></div><div className="section-heading activity-heading"><div><span className="section-kicker">QUEM FAZ PARTE</span><h2>Participantes</h2></div></div><div className="member-grid">{data.members.map(member=><div className="member-card" key={member.id}><Avatar name={member.name} color={member.color}/><div><strong>{member.name}{member.id===data.me?' (você)':''}</strong><small>{data.goals.filter(g=>g.owner_id===member.id).length} objetivos</small></div></div>)}</div></>}
</div>}</main></div>{(modal==='goal'||modal==='edit_goal')&&<GoalModal data={data} initial={modal==='edit_goal'?detail:undefined} onClose={()=>setModal(null)} onSave={saveGoal}/ >}{modal==='entry'&&detail&&<EntryModal goal={detail} data={data} onClose={()=>setModal(null)} onSave={saveEntry}/>}</div>
}
export default App
