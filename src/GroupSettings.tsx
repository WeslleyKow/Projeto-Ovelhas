import { useEffect, useState } from 'react'
import { Camera, Trash2 } from 'lucide-react'
import { groupPixUrl } from './cloud'
import { ruleText } from './Approvals'
import { type ApprovalMode, type Group, money } from './types'

export function PixImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let alive = true
    setUrl(null)
    setLoaded(false)
    ;(path.startsWith('data:') ? Promise.resolve(path) : groupPixUrl(path)).then(result => { if (alive) { setUrl(result); setLoaded(true) } }).catch(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [path])
  return url ? <img className="group-pix-image" src={url} alt="QR Code Pix do grupo"/> : <p>{loaded ? 'Não foi possível carregar o QR Code.' : 'Carregando QR Code...'}</p>
}

export function GroupSettings({ group, memberCount, me, onSaveRule, onSaveHeartFine, onUploadPix, onRemovePix }: { group: Group; memberCount: number; me: string; onSaveRule: (mode: ApprovalMode, value: number) => Promise<void>; onSaveHeartFine: (amount: number) => Promise<void>; onUploadPix: (file: File) => Promise<void>; onRemovePix: () => Promise<void> }) {
  const creator = group.created_by === me
  const others = Math.max(0, memberCount - 1)
  const [mode, setMode] = useState<ApprovalMode>(group.approval_mode)
  const [value, setValue] = useState(String(group.approval_value))
  const [file, setFile] = useState<File | null>(null)
  const [heartFine, setHeartFine] = useState(group.heart_reset_fine?.toString() ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { setMode(group.approval_mode); setValue(String(group.approval_value)) }, [group.approval_mode, group.approval_value])
  useEffect(() => { setHeartFine(group.heart_reset_fine?.toString() ?? '') }, [group.heart_reset_fine])
  async function saveHeartFine() {
    setBusy(true); setError('')
    try { const amount = Number(heartFine); if (!Number.isFinite(amount) || amount <= 0 || amount >= 10000000000) throw new Error('Defina um valor maior que zero.'); await onSaveHeartFine(amount) }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar a multa.') } finally { setBusy(false) }
  }
  async function saveRule() {
    setBusy(true); setError('')
    try {
      const n = Number(value)
      if (!Number.isInteger(n) || n < 1 || n > (mode === 'percent' ? 100 : Math.max(1, others))) throw new Error('Revise a quantidade de aprovações exigida.')
      await onSaveRule(mode, n)
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar a regra.') } finally { setBusy(false) }
  }
  async function uploadPix() {
    if (!file) return
    setBusy(true); setError('')
    try { await onUploadPix(file); setFile(null) } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível enviar a imagem.') } finally { setBusy(false) }
  }
  async function removePix() {
    setBusy(true); setError('')
    try { await onRemovePix() } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível remover a imagem.') } finally { setBusy(false) }
  }
  return <div className="group-settings">
    <div className="white-card"><span className="section-kicker">UMA REGRA PARA O GRUPO</span><h2>Aprovações</h2><p>{ruleText(group, others)} para cada pedido de edição ou exclusão. O autor do objetivo não vota.</p>{creator ? <div className="group-rule-form"><div className="form-grid"><label>Tipo de regra<select value={mode} onChange={e => { setMode(e.target.value as ApprovalMode); setValue('1') }}><option value="count">Número de pessoas</option><option value="percent">Porcentagem</option></select></label><label>{mode === 'count' ? 'Aprovações necessárias' : 'Porcentagem necessária'}<input type="number" min="1" max={mode === 'count' ? Math.max(1, others) : 100} step="1" value={value} onChange={e => setValue(e.target.value)}/></label></div><small>{others ? `${others} ${others === 1 ? 'pessoa pode' : 'pessoas podem'} votar agora.` : 'Sem outros integrantes, pedidos são aplicados imediatamente.'} Uma mudança na regra vale para novos pedidos.</small><button className="primary" disabled={busy} onClick={saveRule}>Salvar regra do grupo</button></div> : <small>Somente quem criou o grupo pode mudar esta regra.</small>}</div>
    <div className="white-card"><span className="section-kicker">VIDAS DA FAMÍLIA</span><h2>Multa para resetar vidas</h2><p>Quem usar “Resetar vidas” recebe três corações na hora e uma multa deste valor. Todos recebem três vidas gratuitamente no dia 1º.</p>{creator ? <div className="group-rule-form"><label>Valor da multa (R$)<input type="number" min="0.01" step="0.01" value={heartFine} onChange={event => setHeartFine(event.target.value)} placeholder="Ex.: 50,00"/></label><button className="primary" disabled={busy} onClick={saveHeartFine}>Salvar valor do reset</button></div> : <small>{group.heart_reset_fine ? `Valor atual: ${money(Number(group.heart_reset_fine))}` : 'O criador da família ainda não definiu o valor.'}</small>}</div>
    <div className="white-card"><span className="section-kicker">PAGAMENTO DE MULTAS</span><h2>QR Code Pix do grupo</h2><p>Esta imagem é a mesma para todos os objetivos. Confira o destinatário no aplicativo bancário antes de pagar.</p>{group.pix_qr_path ? <PixImage path={group.pix_qr_path}/> : <div className="pix-empty">Nenhum QR Code enviado ainda.</div>}{creator && <div className="group-pix-controls"><label className="photo-input"><Camera size={18}/><span>{file ? file.name : group.pix_qr_path ? 'Trocar imagem do QR Code' : 'Enviar imagem do QR Code'}</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e => setFile(e.target.files?.[0] ?? null)}/></label>{file && <button className="primary" disabled={busy} onClick={uploadPix}>Salvar imagem</button>}{group.pix_qr_path && <button className="outline danger-button" disabled={busy} onClick={removePix}><Trash2 size={15}/> Remover imagem</button>}</div>}</div>
    {error && <p className="form-message">{error}</p>}
  </div>
}
