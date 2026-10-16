import './style.css'
// ===== Modelo (espejo de data/Model.kt y data/Game.kt) =====
const SIZES = { SMALL:{label:'Chico',points:5,emoji:'🌱'}, MEDIUM:{label:'Mediano',points:10,emoji:'🌿'}, LARGE:{label:'Grande',points:20,emoji:'🌳'}, EPIC:{label:'Épico',points:50,emoji:'🐉'} }
const SIZE_COLORS = { SMALL:'#222225', MEDIUM:'#2C2C30', LARGE:'#3A3A3F', EPIC:'#4A4A50' }
const FREQ = { DAILY:'Diario', WEEKLY:'Semanal' }
const TYPES = { MANUAL:'Manual', STEPS:'Pasos (simulado)', SCREEN_TIME:'Tiempo de pantalla (simulado)' }
const APPS = ['Instagram','TikTok','YouTube','X','WhatsApp','Netflix']
const pad = n => String(n).padStart(2,'0')
const ds = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
const parse = s => { const [y,m,d] = s.split('-').map(Number); return new Date(y,m-1,d) }
const addDays = (d,n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x }
const today = () => ds(new Date())
const weekStart = (d = new Date()) => { const x = new Date(d.getFullYear(),d.getMonth(),d.getDate()); return addDays(x, -((x.getDay()+6)%7)) }

const Game = {
  level: xp => Math.floor(Math.sqrt(xp/50)) + 1,
  xpForLevel: l => 50*(l-1)*(l-1),
  title: l => l<3?'Aprendiz':l<6?'Aventurero':l<10?'Guerrero':l<15?'Campeón':l<25?'Leyenda':'Mítico',
  pointsFor: (h, streak) => Math.floor(SIZES[h.size].points * (1 + Math.min(0.5, Math.floor(streak/7)*0.1))),
  globalStreak(c) {
    const done = new Set(c.filter(x=>x.status==='DONE').map(x=>x.day))
    let d = new Date(); if (!done.has(ds(d))) d = addDays(d,-1)
    let n = 0; while (done.has(ds(d))) { n++; d = addDays(d,-1) } return n
  },
  habitStreak(h, c) {
    const mine = c.filter(x=>x.habitId===h.id && x.status==='DONE')
    if (h.frequency==='DAILY') {
      const days = new Set(mine.map(x=>x.day)); let d = new Date(); if (!days.has(ds(d))) d = addDays(d,-1)
      let n = 0; while (days.has(ds(d))) { n++; d = addDays(d,-1) } return n
    }
    const per = {}; mine.forEach(x => { const k = ds(weekStart(parse(x.day))); per[k]=(per[k]||0)+1 })
    let w = weekStart(); if ((per[ds(w)]||0) < h.timesPerWeek) w = addDays(w,-7)
    let n = 0; while ((per[ds(w)]||0) >= h.timesPerWeek) { n++; w = addDays(w,-7) } return n
  },
  weekCount: (h,c) => { const ws = ds(weekStart()); return c.filter(x=>x.habitId===h.id && x.status==='DONE' && x.day>=ws).length },
  goalPoints: (g, links, c) => { const hs = new Set(links.filter(l=>l.goalId===g.id).map(l=>l.habitId)); return c.filter(x=>hs.has(x.habitId)&&x.status==='DONE').reduce((a,x)=>a+x.points,0) },
}

// ===== Persistencia (localStorage) =====
const KEY = 'habitquest-demo-v1'
let db = JSON.parse(localStorage.getItem(KEY) || 'null')
function seed() {
  const t = today(), past = n => ds(addDays(new Date(), -n))
  const d = { nextId: 100, goals: [
      { id:1, name:'Estar en forma', emoji:'💪', targetPoints:600 },
      { id:2, name:'Más foco, menos scroll', emoji:'🧠', targetPoints:400 } ],
    habits: [
      { id:11, name:'Caminar 8000 pasos', emoji:'🚶', size:'LARGE', frequency:'DAILY', timesPerWeek:1, type:'STEPS', target:8000, createdDay:past(3) },
      { id:12, name:'Menos de 2h de Instagram', emoji:'📵', size:'MEDIUM', frequency:'DAILY', timesPerWeek:1, type:'SCREEN_TIME', target:120, app:'Instagram', createdDay:past(3) },
      { id:13, name:'Tomar 2L de agua', emoji:'💧', size:'SMALL', frequency:'DAILY', timesPerWeek:1, type:'MANUAL', target:0, createdDay:past(3) },
      { id:14, name:'Leer 20 minutos', emoji:'📚', size:'MEDIUM', frequency:'DAILY', timesPerWeek:1, type:'MANUAL', target:0, createdDay:past(3) },
      { id:15, name:'Ir al gimnasio', emoji:'🏋️', size:'EPIC', frequency:'WEEKLY', timesPerWeek:3, type:'MANUAL', target:0, createdDay:past(3) } ],
    links: [[11,1],[15,1],[13,1],[12,2],[14,2]].map(([habitId,goalId])=>({habitId,goalId})),
    completions: [], readings: { 11: 3200, 12: 45 } }
  // un poco de historia para que se vean rachas y progreso
  for (const n of [3,2,1]) {
    d.completions.push({ habitId:13, day:past(n), status:'DONE', points:5 })
    d.completions.push({ habitId:11, day:past(n), status: n===2?'MISSED':'DONE', points: n===2?0:20, auto:true })
    d.completions.push({ habitId:12, day:past(n), status:'DONE', points:10, auto:true })
  }
  d.completions.push({ habitId:14, day:past(1), status:'DONE', points:10 })
  return d
}
if (!db) db = seed()
const save = () => localStorage.setItem(KEY, JSON.stringify(db))

const xp = () => db.completions.filter(c=>c.status==='DONE').reduce((a,c)=>a+c.points,0)
const todayOf = h => db.completions.find(c=>c.habitId===h.id && c.day===today())
const setComp = (h, day, status, auto=false) => {
  db.completions = db.completions.filter(c=>!(c.habitId===h.id && c.day===day))
  const points = status==='DONE' ? Game.pointsFor(h, Game.habitStreak(h, db.completions)) : 0
  db.completions.push({ habitId:h.id, day, status, points, auto })
}
const removeComp = (h, day) => { db.completions = db.completions.filter(c=>!(c.habitId===h.id && c.day===day)) }

// ===== UI state =====
let tab = 0, openMenu = null, dialog = null, bumpId = null, shakeId = null, lastLevel = Game.level(xp())
const fx = { confetti: false, level: null }

function afterChange() {
  save()
  const lvl = Game.level(xp())
  if (lvl > lastLevel) { fx.level = lvl; fx.confetti = true }
  lastLevel = lvl
  render()
  if (fx.confetti) { confetti(); fx.confetti = false }
}

// Reglas automáticas (equivalente a refresh() del ViewModel), con datos simulados
function refresh() {
  const now = new Date()
  for (const h of db.habits) {
    const created = h.createdDay
    if (h.type==='MANUAL' && h.frequency==='DAILY') {
      for (let b=1;b<=7;b++) { const d = ds(addDays(now,-b)); if (d<created) break
        if (!db.completions.some(c=>c.habitId===h.id&&c.day===d)) db.completions.push({habitId:h.id,day:d,status:'MISSED',points:0}) }
    } else if (h.type!=='MANUAL') {
      for (let b=1;b<=7;b++) { const d = ds(addDays(now,-b)); if (d<created) break
        if (!db.completions.some(c=>c.habitId===h.id&&c.day===d)) db.completions.push({habitId:h.id,day:d,status:'MISSED',points:0,auto:true}) }
      evalToday(h, false)
    }
  }
  save()
}
function evalToday(h, celebrate=true) {
  const v = db.readings[h.id] ?? 0, cur = todayOf(h)
  if (h.type==='STEPS') {
    if (v >= h.target && cur?.status!=='DONE') { setComp(h,today(),'DONE',true); if (celebrate) { fx.confetti = true; bumpId = h.id } }
    else if (v < h.target && cur?.auto && cur.status==='DONE') removeComp(h,today())
  } else if (h.type==='SCREEN_TIME') {
    // hoy: se falla apenas pasás el límite; se cumple al cierre del día
    if (v > h.target && cur?.status!=='MISSED') { setComp(h,today(),'MISSED',true); if (celebrate) shakeId = h.id }
    else if (v <= h.target && cur?.auto && cur.status==='MISSED') removeComp(h,today())
  }
}

// ===== Acciones =====
const A = {
  tab(i){ tab=+i; openMenu=null; render() },
  toggle(id){ const h = db.habits.find(x=>x.id==id); if (h.type!=='MANUAL') return
    const c = todayOf(h); if (c?.status==='DONE') removeComp(h,today()); else { setComp(h,today(),'DONE'); fx.confetti = true }
    bumpId = h.id; openMenu=null; afterChange() },
  missed(id){ const h = db.habits.find(x=>x.id==id); setComp(h,today(),'MISSED'); shakeId=h.id; openMenu=null; afterChange() },
  clear(id){ const h = db.habits.find(x=>x.id==id); removeComp(h,today()); openMenu=null; afterChange() },
  delHabit(id){ id=+id; if(!confirm('¿Borrar este hábito?')) return; db.habits=db.habits.filter(h=>h.id!==id); db.links=db.links.filter(l=>l.habitId!==id); db.completions=db.completions.filter(c=>c.habitId!==id); openMenu=null; afterChange() },
  delGoal(id){ id=+id; if(!confirm('¿Borrar este objetivo?')) return; db.goals=db.goals.filter(g=>g.id!==id); db.links=db.links.filter(l=>l.goalId!==id); afterChange() },
  menu(id){ openMenu = openMenu==id ? null : +id; render() },
  sync(){ for (const h of db.habits) { if (h.type==='STEPS') db.readings[h.id] = Math.round((2000+Math.random()*9000)/10)*10
      if (h.type==='SCREEN_TIME') db.readings[h.id] = Math.round(Math.random()*h.target*1.4); evalToday(h) }
    afterChange(); toast('Datos simulados sincronizados 🔄') },
  reset(){ if(!confirm('¿Reiniciar la demo? Se borran tus datos locales.')) return; db = seed(); refresh(); lastLevel = Game.level(xp()); tab=0; render() },
  addHabit(){ dialog = { kind:'habit', name:'', emoji:'⭐', size:'MEDIUM', freq:'DAILY', times:'3', type:'MANUAL', target:'', app:null, goals:[] }; render() },
  addGoal(){ dialog = { kind:'goal', name:'', emoji:'🎯', pts:'500' }; render() },
  close(){ dialog = null; render() },
  closeLevel(){ fx.level = null; render() },
}

function toast(msg){ const t = document.createElement('div'); t.textContent = msg
  Object.assign(t.style,{position:'absolute',left:'50%',bottom:'170px',transform:'translateX(-50%)',background:'#222225',color:'#F2F2F2',border:'1px solid #2C2C30',padding:'10px 16px',borderRadius:'8px',zIndex:60,fontSize:'14px'})
  document.getElementById('phone').appendChild(t); setTimeout(()=>t.remove(),2000) }

// ===== Render =====
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const app = document.getElementById('app')

function header() {
  const x = xp(), l = Game.level(x), from = Game.xpForLevel(l), to = Game.xpForLevel(l+1), st = Game.globalStreak(db.completions)
  return `<div class="header"><div class="hrow"><div class="lvl">${l}</div><div class="grow"><div class="htitle">Nivel ${l} · ${Game.title(l)}</div>
  <div class="hsub">${x} XP · faltan ${to-x} para el nivel ${l+1}</div></div><div class="fire ${st>0?'on':''}">🔥 ${st}</div></div>
  <div class="bar"><i style="width:${Math.min(100,(x-from)/(to-from)*100)}%"></i></div></div>
  <div class="demo">🧪 Demo web · pasos y tiempo de pantalla son <b>simulados</b> · datos guardados en tu navegador</div>`
}

function habitCard(h) {
  const c = todayOf(h), done = c?.status==='DONE', missed = c?.status==='MISSED', streak = Game.habitStreak(h, db.completions)
  const s = SIZES[h.size], r = db.readings[h.id] ?? 0
  const sub = [`${s.emoji} ${s.label} · +${s.points}`]
  if (streak>0) sub.push(`🔥${streak}`)
  if (h.frequency==='WEEKLY') sub.push(`${Game.weekCount(h,db.completions)}/${h.timesPerWeek} esta semana`)
  if (h.type==='STEPS') sub.push(`👣 ${r}/${h.target}`)
  if (h.type==='SCREEN_TIME') sub.push(`📱 ${h.app||'App'} ${r}/${h.target} min`)
  const cls = ['card', done&&'done', missed&&'missed', bumpId===h.id&&'bump', shakeId===h.id&&'shake'].filter(Boolean).join(' ')
  const icon = done ? '✔' : missed ? '✖' : '⋮'
  const items = [h.type==='MANUAL' && (done ? `<button data-a="toggle" data-id="${h.id}">Desmarcar</button>` : `<button data-a="toggle" data-id="${h.id}">✅ Marcar cumplido</button>`),
    h.type==='MANUAL' && !missed && `<button data-a="missed" data-id="${h.id}">❌ Marcar fallado</button>`,
    h.type==='MANUAL' && missed && `<button data-a="clear" data-id="${h.id}">↩ Quitar estado</button>`,
    `<button data-a="delHabit" data-id="${h.id}">🗑 Borrar hábito</button>`].filter(Boolean).join('')
  let sim = ''
  if (h.type==='STEPS') sim = `<div class="mini"><i style="width:${Math.min(100,r/h.target*100)}%"></i></div>
    <div class="sim"><label><span>👣 Pasos de hoy <span class="tag">DEMO</span></span><span>${r}</span></label><input type="range" min="0" max="${Math.max(12000,h.target*1.5)}" step="100" value="${r}" data-sim="${h.id}"></div>`
  if (h.type==='SCREEN_TIME') sim = `<div class="sim"><label><span>📱 Minutos en ${esc(h.app||'la app')} <span class="tag">DEMO</span></span><span>${r} min</span></label><input type="range" min="0" max="${Math.max(240,h.target*2)}" step="5" value="${r}" data-sim="${h.id}"></div>`
  return `<div class="${cls}"><div class="hc ${h.type==='MANUAL'?'click':''}" ${h.type==='MANUAL'?`data-a="toggle" data-id="${h.id}"`:''}>
    <div class="ico" style="background:${SIZE_COLORS[h.size]}">${esc(h.emoji)}</div>
    <div class="grow"><div class="hname">${esc(h.name)}</div><div class="hsub2">${sub.join(' · ')}</div></div>
    <div class="menu"><button class="mbtn" data-a="menu" data-id="${h.id}">${icon}</button>${openMenu===h.id?`<div class="dd">${items}</div>`:''}</div></div>${sim}</div>`
}

function todayScreen() {
  const daily = db.habits.filter(h=>h.frequency==='DAILY'), weekly = db.habits.filter(h=>h.frequency==='WEEKLY')
  const n = daily.filter(h=>todayOf(h)?.status==='DONE').length
  return `<div class="hello">¡Hola, Ulises! Hoy llevás ${n}/${daily.length} 💥</div>
  ${daily.length?`<div class="sec">DIARIOS</div>${daily.map(habitCard).join('')}`:''}
  ${weekly.length?`<div class="sec">SEMANALES</div>${weekly.map(habitCard).join('')}`:''}
  ${db.habits.length?'':'<div class="empty">Todavía no tenés hábitos. ¡Creá el primero con el botón +!</div>'}`
}

function goalsScreen() {
  if (!db.goals.length) return '<div class="empty">No tenés objetivos todavía. ¡Creá uno!</div>'
  return db.goals.map(g => {
    const pts = Game.goalPoints(g, db.links, db.completions), p = Math.min(1, pts/g.targetPoints), ok = p>=1
    const linked = db.links.filter(l=>l.goalId===g.id).map(l=>db.habits.find(h=>h.id===l.habitId)).filter(Boolean)
    return `<div class="card goal ${ok?'ok':''}"><div class="gtop"><div class="gem">${ok?'🏆':esc(g.emoji)}</div><div class="grow"><div class="gname">${esc(g.name)}</div>
    <div style="font-size:13px">${pts} / ${g.targetPoints} pts${ok?' · ¡Logrado! 🏆':''}</div></div><button class="iconbtn" data-a="delGoal" data-id="${g.id}">🗑</button></div>
    <div class="gbar ${ok?'ok':''}"><i data-w="${p*100}" style="width:0"></i></div>
    <div class="gl">${linked.length?linked.map(h=>`${esc(h.emoji)} ${esc(h.name)}`).join('&nbsp;&nbsp;'):'Sin hábitos vinculados'}</div></div>`
  }).join('')
}

function profileScreen() {
  const done = db.completions.filter(c=>c.status==='DONE').length, missed = db.completions.filter(c=>c.status==='MISSED').length
  const stat = (e,v,l,c) => `<div class="stat ${c}"><b>${e} ${v}</b>${l}</div>`
  return `<div class="stats">${stat('⭐',xp(),'XP total','pos')}${stat('🔥',Game.globalStreak(db.completions),'Racha','')}
  ${stat('✅',done,'Cumplidos','pos')}${stat('❌',missed,'Fallados','neg')}</div>
  <div class="sec">INTEGRACIONES</div>
  <div class="card"><div class="int">👣 Health Connect (pasos) <span class="tag">DEMO</span><span class="dot" style="background:var(--done)"></span></div>
  <div class="small">En la web los pasos son simulados: movés el slider en el hábito o tocás "Sincronizar ahora" para generar datos falsos. En Android se leen de Health Connect.</div></div>
  <div class="card"><div class="int">📱 Tiempo de pantalla <span class="tag">DEMO</span><span class="dot" style="background:var(--done)"></span></div>
  <div class="small">Simulado en la web. En Android se usa "Acceso a datos de uso" (UsageStatsManager) para controlar tus límites por app.</div></div>
  <button class="btn out" data-a="sync">🔄 Sincronizar ahora (datos de demo)</button>
  <button class="btn out" data-a="reset" style="color:var(--missed)">♻ Reiniciar demo</button>`
}

function dialogHtml() {
  if (fx.level) { const l = fx.level; return `<div class="scrim"><div class="dlg lu"><h2>¡SUBISTE DE NIVEL!</h2><div class="trophy">🏆</div>
    <div style="font-weight:700;margin-top:8px">Ahora sos nivel ${l} · ${Game.title(l)}</div><div class="acts" style="justify-content:center"><button class="btn" data-a="closeLevel">¡Vamos!</button></div></div></div>` }
  if (!dialog) return ''
  const d = dialog, chip = (on, attrs, txt) => `<button class="chip ${on?'on':''}" ${attrs}>${txt}</button>`
  if (d.kind==='goal') return `<div class="scrim"><div class="dlg"><h2>Nuevo objetivo</h2>
    <div class="row"><label class="fld">Ícono<input data-f="emoji" value="${esc(d.emoji)}" maxlength="2"></label><label class="fld">Nombre<input data-f="name" value="${esc(d.name)}"></label></div>
    <label class="fld">Puntos para lograrlo<input data-f="pts" inputmode="numeric" value="${esc(d.pts)}"></label>
    <div style="font-size:12px">Vinculá hábitos al crearlos: los puntos que ganes en ellos suman a este objetivo.</div>
    <div class="acts"><button class="btn text" data-a="close">Cancelar</button><button class="btn" data-a="createGoal" ${d.name.trim()?'':'disabled'}>Crear</button></div></div></div>`
  const valid = d.name.trim() && (d.type==='MANUAL' || +d.target>0) && (d.type!=='SCREEN_TIME' || d.app)
  return `<div class="scrim"><div class="dlg"><h2>Nuevo hábito</h2>
    <div class="row"><label class="fld">Ícono<input data-f="emoji" value="${esc(d.emoji)}" maxlength="2"></label><label class="fld">Nombre<input data-f="name" value="${esc(d.name)}"></label></div>
    <div class="lbl">Tamaño</div><div class="chips">${Object.entries(SIZES).map(([k,s])=>chip(d.size===k,`data-set="size" data-v="${k}"`,`${s.emoji} ${s.label} +${s.points}`)).join('')}</div>
    <div class="lbl">Frecuencia</div><div class="chips">${Object.entries(FREQ).map(([k,l])=>chip(d.freq===k,`data-set="freq" data-v="${k}"`,l)).join('')}</div>
    ${d.freq==='WEEKLY'?`<label class="fld" style="margin-top:8px">Veces por semana<input data-f="times" inputmode="numeric" value="${esc(d.times)}"></label>`:''}
    <div class="lbl">Tipo</div><div class="chips">${Object.entries(TYPES).map(([k,l])=>chip(d.type===k,`data-set="type" data-v="${k}"`,l)).join('')}</div>
    ${d.type==='STEPS'?`<label class="fld" style="margin-top:8px">Pasos objetivo (ej. 8000)<input data-f="target" inputmode="numeric" value="${esc(d.target)}"></label>`:''}
    ${d.type==='SCREEN_TIME'?`<label class="fld" style="margin-top:8px">Máximo de minutos por día (ej. 120)<input data-f="target" inputmode="numeric" value="${esc(d.target)}"></label>
      <div class="lbl">App a controlar</div><div class="chips">${APPS.map(a=>chip(d.app===a,`data-set="app" data-v="${a}"`,a)).join('')}</div>`:''}
    ${db.goals.length?`<div class="lbl">Objetivos vinculados</div><div class="chips">${db.goals.map(g=>chip(d.goals.includes(g.id),`data-goal="${g.id}"`,`${esc(g.emoji)} ${esc(g.name)}`)).join('')}</div>`:''}
    <div class="acts"><button class="btn text" data-a="close">Cancelar</button><button class="btn" data-a="createHabit" ${valid?'':'disabled'}>Crear</button></div></div></div>`
}

A.createHabit = () => { const d = dialog, id = db.nextId++
  const h = { id, name:d.name.trim(), emoji:d.emoji.trim()||'⭐', size:d.size, frequency:d.freq, timesPerWeek:Math.min(7,Math.max(1,parseInt(d.times)||1)),
    type:d.type, target: parseInt(d.target)||0, app:d.app, createdDay: today() }
  db.habits.push(h); d.goals.forEach(goalId=>db.links.push({habitId:id,goalId}))
  if (h.type!=='MANUAL') db.readings[id] = 0
  dialog = null; afterChange() }
A.createGoal = () => { const d = dialog; db.goals.push({ id: db.nextId++, name:d.name.trim(), emoji:d.emoji.trim()||'🎯', targetPoints: Math.max(10, parseInt(d.pts)||500) }); dialog=null; afterChange() }

function render() {
  const main = app.querySelector('main'), scroll = main?.scrollTop || 0
  app.innerHTML = `${header()}<main>${[todayScreen,goalsScreen,profileScreen][tab]()}</main>
  ${tab<2?`<button class="fab" data-a="${tab===0?'addHabit':'addGoal'}">＋ ${tab===0?'Nuevo hábito':'Nuevo objetivo'}</button>`:''}
  <nav>${[['🏠','Hoy'],['⭐','Objetivos'],['👤','Perfil']].map(([i,l],k)=>`<button class="${tab===k?'on':''}" data-a="tab" data-id="${k}"><span class="pill">${i}</span>${l}</button>`).join('')}</nav>
  ${dialogHtml()}`
  app.querySelector('main').scrollTop = scroll
  bumpId = shakeId = null
  requestAnimationFrame(()=>requestAnimationFrame(()=>app.querySelectorAll('.gbar>i').forEach(el=>el.style.width=el.dataset.w+'%')))
}

app.addEventListener('click', e => {
  const t = e.target.closest('[data-a],[data-set],[data-goal]')
  if (!t) { if (openMenu) { openMenu=null; render() } return }
  if (t.dataset.set) { dialog[t.dataset.set] = t.dataset.v; return render() }
  if (t.dataset.goal) { const g=+t.dataset.goal; dialog.goals = dialog.goals.includes(g)?dialog.goals.filter(x=>x!==g):[...dialog.goals,g]; return render() }
  e.stopPropagation(); A[t.dataset.a]?.(t.dataset.id)
})
app.addEventListener('input', e => {
  const t = e.target
  if (t.dataset.f) { dialog[t.dataset.f] = t.value
    const btn = app.querySelector('[data-a=createHabit],[data-a=createGoal]'), d = dialog
    if (btn) btn.disabled = d.kind==='goal' ? !d.name.trim() : !(d.name.trim() && (d.type==='MANUAL'||+d.target>0) && (d.type!=='SCREEN_TIME'||d.app)) }
  if (t.dataset.sim) { const h = db.habits.find(x=>x.id==t.dataset.sim); db.readings[h.id] = +t.value
    const lbl = t.previousElementSibling.lastElementChild; lbl.textContent = h.type==='STEPS' ? t.value : `${t.value} min` }
})
app.addEventListener('change', e => { const t = e.target
  if (t.dataset.sim) { const h = db.habits.find(x=>x.id==t.dataset.sim); evalToday(h); afterChange() } })

// ===== Confetti (espejo de Effects.kt) =====
const cv = document.getElementById('confetti'), cx = cv.getContext('2d')
const COLORS = ['#3FC47E','#3FC47E','#F2F2F2','#F2F2F2','#8A8A8F','#5A5A5F']
function confetti() {
  const W = cv.width = cv.offsetWidth * devicePixelRatio, H = cv.height = cv.offsetHeight * devicePixelRatio
  const ps = Array.from({length:120}, () => ({ x:Math.random(), vx:Math.random()*.6-.3, vy:Math.random()*.8+.4, c:COLORS[Math.random()*6|0], r:Math.random()*720, s:(Math.random()*14+8)*devicePixelRatio }))
  const t0 = performance.now()
  ;(function f(now){ const p = Math.min(1,(now-t0)/2200); cx.clearRect(0,0,W,H)
    if (p>=1) return
    for (const q of ps) { const x=(q.x+q.vx*p)*W, y=(-.1+q.vy*p+.6*p*p)*H
      cx.save(); cx.translate(x,y); cx.rotate(q.r*p*Math.PI/180); cx.globalAlpha=1-p*.6; cx.fillStyle=q.c; cx.fillRect(0,0,q.s,q.s*.5); cx.restore() }
    requestAnimationFrame(f) })(t0)
}

refresh(); lastLevel = Game.level(xp()); render()
