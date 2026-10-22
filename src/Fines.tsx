import { ArrowRight, Wallet } from 'lucide-react'
import { type AppData, initials, money } from './types'
import { pendingFines } from './fines'

export function Fines({ data, onSelectGoal }: { data: AppData; onSelectGoal: (id: string) => void }) {
  const fines = pendingFines(data)
  const total = fines.reduce((sum, fine) => sum + fine.amount, 0)
  const people = [...new Set(fines.map(fine => fine.goal.owner_id))].map(id => ({ member: data.members.find(member => member.id === id) ?? { id, name: 'Participante', color: '#d9e1d5' }, fines: fines.filter(fine => fine.goal.owner_id === id) }))
  return <div className="fines-page">
    <div className="page-title-row"><div><span className="section-kicker">ACERTOS DA FAMÍLIA</span><h1>Multas pendentes</h1><p>Veja quem precisa pagar, por qual objetivo e o motivo de cada cobrança.</p></div><span className="ranking-decoration"><Wallet size={38}/></span></div>
    <div className="fines-overview"><span>Total pendente<strong>{money(total)}</strong></span><span>Ocorrências em aberto<strong>{fines.length}</strong></span><span>Participantes com multas<strong>{people.length}</strong></span></div>
    {people.length ? <><p className="fines-help">Abra o objetivo para ver o Pix do grupo ou marcar uma multa sua como paga.</p><div className="fine-groups">{people.map(({ member, fines: memberFines }) => <section className="fine-group" key={member.id}><div className="fine-group-head"><span className="fine-person"><span className="avatar small" style={{ background: member.color }}>{initials(member.name)}</span><span><strong>{member.name}</strong><small>{memberFines.length} {memberFines.length === 1 ? 'multa pendente' : 'multas pendentes'}</small></span></span><strong>{money(memberFines.reduce((sum, fine) => sum + fine.amount, 0))}</strong></div><div className="fine-list">{memberFines.map(fine => <div className="fine-item" key={fine.key}><div><span className="fine-period">{fine.label}</span><h3>{fine.goal.title}</h3><p>{fine.reason}</p></div><div className="fine-item-side"><strong>{money(fine.amount)}</strong><button className="link-button" onClick={() => onSelectGoal(fine.goal.id)}>Ver objetivo <ArrowRight size={15}/></button></div></div>)}</div></section>)}</div></> : <div className="empty"><Wallet size={32}/><h3>Nenhuma multa pendente</h3><p>As multas aparecerão aqui quando algum prazo terminar sem a meta ser cumprida.</p></div>}
  </div>
}
