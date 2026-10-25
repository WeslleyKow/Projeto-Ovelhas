import { type AppData, today } from './types'
const daysFromNow = (days: number) => { const date = new Date(); date.setDate(date.getDate() + days); return date.toLocaleDateString('en-CA') }
const base: AppData = {
  group: { id: 'demo-group', name: 'Família em movimento', invite_code: 'DEMO2026', created_by: 'm1', approval_mode: 'percent', approval_value: 50, pix_qr_path: null },
  me: 'm1',
  members: [
    { id: 'm1', name: 'Você', color: '#b2c69d' },
    { id: 'm2', name: 'Marina', color: '#c4b9e8' },
    { id: 'm3', name: 'Rafael', color: '#f2c5a8' },
    { id: 'm4', name: 'Camila', color: '#9dc7c4' }
  ],
  goals: [
    { id: 'g1', group_id: 'demo-group', owner_id: 'm1', title: 'Movimentar o corpo', description: 'Ir à academia ou fazer uma caminhada, pelo menos 5 vezes por semana.', category: 'Saúde', target_value: 20, weekly_target: 5, unit: 'treinos', deadline: daysFromNow(20), fine_amount: 50, recurrence_type: 'none', start_date: null, deleted_at: null, created_at: today() },
    { id: 'g2', group_id: 'demo-group', owner_id: 'm1', title: 'Inglês todo dia', description: 'Praticar inglês por 30 minutos e conseguir ler um artigo no fim do mês.', category: 'Aprendizado', target_value: 30, weekly_target: 7, unit: 'sessões', deadline: daysFromNow(25), fine_amount: 30, recurrence_type: 'none', start_date: null, deleted_at: null, created_at: today() },
    { id: 'g3', group_id: 'demo-group', owner_id: 'm2', title: 'Ler um livro', description: 'Um capítulo de cada vez até terminar meu livro do mês.', category: 'Leitura', target_value: 16, weekly_target: null, unit: 'capítulos', deadline: daysFromNow(17), fine_amount: 25, recurrence_type: 'none', start_date: null, deleted_at: null, created_at: today() },
    { id: 'g4', group_id: 'demo-group', owner_id: 'm3', title: 'Criar meu projeto', description: 'Estudar uma hora por dia para montar um projeto de portfólio.', category: 'Carreira', target_value: 24, weekly_target: 5, unit: 'horas', deadline: daysFromNow(28), fine_amount: 40, recurrence_type: 'none', start_date: null, deleted_at: null, created_at: today() },
    { id: 'g5', group_id: 'demo-group', owner_id: 'm4', title: 'Correr 50 km', description: 'Registrar a distância de cada corrida durante o mês.', category: 'Saúde', target_value: 50, weekly_target: 3, unit: 'km', deadline: daysFromNow(23), fine_amount: 35, recurrence_type: 'none', start_date: null, deleted_at: null, created_at: today() }
  ],
  requests: [],
  votes: [],
  finePayments: [],
  heartSpends: [],
  entries: [
    ...Array.from({length: 12}, (_, i) => ({ id: `e1-${i}`, goal_id: 'g1', author_id: 'm1', entry_date: daysFromNow(-i * 2), amount: 1, note: i === 0 ? 'Treino de pernas concluído! Pequenos passos, grandes mudanças.' : 'Mais um treino feito!', photo_path: null, created_at: daysFromNow(-i * 2) })),
    ...Array.from({length: 18}, (_, i) => ({ id: `e2-${i}`, goal_id: 'g2', author_id: 'm1', entry_date: daysFromNow(-i), amount: 1, note: i === 1 ? 'Consegui entender um vídeo inteiro sem legenda.' : '30 minutos de prática.', photo_path: null, created_at: daysFromNow(-i) })),
    ...Array.from({length: 10}, (_, i) => ({ id: `e3-${i}`, goal_id: 'g3', author_id: 'm2', entry_date: daysFromNow(-i * 2), amount: 1, note: 'Capítulo lido.', photo_path: null, created_at: daysFromNow(-i * 2) })),
    ...Array.from({length: 9}, (_, i) => ({ id: `e4-${i}`, goal_id: 'g4', author_id: 'm3', entry_date: daysFromNow(-i * 3 - 3), amount: 1, note: 'Estudo concluído.', photo_path: null, created_at: daysFromNow(-i * 3 - 3) })),
    ...Array.from({length: 34}, (_, i) => ({ id: `e5-${i}`, goal_id: 'g5', author_id: 'm4', entry_date: daysFromNow(-i), amount: 1, note: 'Corrida do dia.', photo_path: null, created_at: daysFromNow(-i) }))
  ]
}
export function loadDemo(): AppData {
  try {
    const saved = localStorage.getItem('juntos-demo')
    if (!saved) return base
    const parsed = JSON.parse(saved) as AppData
    return { ...parsed, group: { ...parsed.group, created_by: parsed.group.created_by ?? 'm1', approval_mode: parsed.group.approval_mode ?? 'percent', approval_value: parsed.group.approval_value ?? 50, pix_qr_path: parsed.group.pix_qr_path ?? null }, requests: parsed.requests ?? [], votes: parsed.votes ?? [], finePayments: parsed.finePayments ?? [], heartSpends: parsed.heartSpends ?? [], goals: parsed.goals.map(goal => ({ ...goal, weekly_target: goal.weekly_target ?? null, weekday_mask: goal.weekday_mask ?? null, rest_dates: goal.rest_dates ?? [], recurrence_type: goal.recurrence_type ?? 'none', start_date: goal.start_date ?? null, fine_paid_at: goal.fine_paid_at ?? null, deleted_at: goal.deleted_at ?? null })) }
  } catch { return base }
}
export function saveDemo(data: AppData) { localStorage.setItem('juntos-demo', JSON.stringify(data)) }
