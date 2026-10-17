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
    const done = new Set([...c.filter(x=>x.status==='DONE').map(x=>x.day), ...(db.protectedDays||[])])
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
const KEY = 'habitquest-demo-v2'
let db = JSON.parse(localStorage.getItem(KEY) || 'null')
function seed() {
  const t = today(), past = n => ds(addDays(new Date(), -n))
  const d = { nextId: 100, goals: [
      { id:1, name:'Estar en forma', emoji:'💪', targetPoints:600 },
      { id:2, name:'Más foco, menos scroll', emoji:'🧠', targetPoints:400 } ],
    habits: [
      { id:11, name:'Caminar 8000 pasos', emoji:'🚶', size:'LARGE', frequency:'DAILY', timesPerWeek:1, type:'STEPS', target:8000, createdDay:past(45) },
      { id:12, name:'Menos de 2h de Instagram', emoji:'📵', size:'MEDIUM', frequency:'DAILY', timesPerWeek:1, type:'SCREEN_TIME', target:120, app:'Instagram', createdDay:past(45) },
      { id:13, name:'Tomar 2L de agua', emoji:'💧', size:'SMALL', frequency:'DAILY', timesPerWeek:1, type:'MANUAL', target:0, createdDay:past(45) },
      { id:14, name:'Leer 20 minutos', reminder:'18:00', emoji:'📚', size:'MEDIUM', frequency:'DAILY', timesPerWeek:1, type:'MANUAL', target:0, createdDay:past(45) },
      { id:15, name:'Ir al gimnasio', emoji:'🏋️', size:'EPIC', frequency:'WEEKLY', timesPerWeek:3, type:'MANUAL', target:0, createdDay:past(45) } ],
    links: [[11,1],[15,1],[13,1],[12,2],[14,2]].map(([habitId,goalId])=>({habitId,goalId})),
    completions: [], readings: { 11: 3200, 12: 45 } }
  for (let n=45;n>=1;n--) {
    for (const h of d.habits) {
      if (h.frequency==='WEEKLY' && n%2) continue
      const done = n%11!==0 && (n+h.id)%5!==0
      d.completions.push({habitId:h.id,day:past(n),status:done?'DONE':'MISSED',points:done?SIZES[h.size].points:0,auto:h.type!=='MANUAL'})
    }
  }
  d.premium = false; d.plan = 'premium_yearly'; d.theme = 'matte'
  d.messages = []; d.achievements = []; d.protectedDays = []; d.freezes = {}
  d.settings = {daily:true,time:'09:00',reminders:true,risk:true,weekly:true}
  d.motivation = 0
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
  checkAchievements()
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
  reset(){ if(!confirm('¿Reiniciar la demo? Se borran tus datos locales.')) return; db = seed(); refresh(); ['DAILY_PLAN','STREAK_RISK','WEEKLY_SUMMARY','MOTIVATION'].forEach(type=>generateMessage(type,false)); checkAchievements(); save(); lastLevel = Game.level(xp()); tab=0; dialog=null; render(); confetti() },
  addHabit(){ if (!db.premium && db.habits.length>=6) return A.paywall(); dialog = { kind:'habit', name:'', emoji:'⭐', size:'MEDIUM', freq:'DAILY', times:'3', type:'MANUAL', target:'', app:null, goals:[] }; render() },
  addGoal(){ if (!db.premium && db.goals.length>=2) return A.paywall(); dialog = { kind:'goal', name:'', emoji:'🎯', pts:'500' }; render() },
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
  <div class="demo">🧪 Demo web · pasos, pantalla, compras y notificaciones son <b>simulados</b> · datos guardados en tu navegador</div>`
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
  const icon = '⋮'
  const items = [`<button data-a="editHabit" data-id="${h.id}">Editar</button>`,h.type==='MANUAL' && (done ? `<button data-a="toggle" data-id="${h.id}">Desmarcar</button>` : `<button data-a="toggle" data-id="${h.id}">✅ Marcar cumplido</button>`),
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
    <div style="font-size:13px">${pts} / ${g.targetPoints} pts${ok?' · ¡Logrado! 🏆':''}</div></div><button class="iconbtn" data-a="editGoal" data-id="${g.id}" aria-label="Editar objetivo">✎</button><button class="iconbtn" data-a="delGoal" data-id="${g.id}">🗑</button></div>
    <div class="gbar ${ok?'ok':''}"><i data-w="${p*100}" style="width:0"></i></div>
    <div class="gl">${linked.length?linked.map(h=>`${esc(h.emoji)} ${esc(h.name)}`).join('&nbsp;&nbsp;'):'Sin hábitos vinculados'}</div></div>`
  }).join('')
}

function profileScreen() {
  const done = db.completions.filter(c=>c.status==='DONE').length, missed = db.completions.filter(c=>c.status==='MISSED').length
  const stat = (e,v,l,c) => `<div class="stat ${c}"><b>${e} ${v}</b>${l}</div>`
  return `${premiumProfile()}${notificationSettings()}${achievementsHtml()}<div class="stats">${stat('⭐',xp(),'XP total','pos')}${stat('🔥',Game.globalStreak(db.completions),'Racha','')}
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
  if (dialog.kind==='paywall' || dialog.kind==='purchase') return paywallHtml()
  const d = dialog, chip = (on, attrs, txt) => `<button class="chip ${on?'on':''}" ${attrs}>${txt}</button>`
  if (d.kind==='goal') return `<div class="scrim"><div class="dlg"><h2>${d.id?'Editar objetivo':'Nuevo objetivo'}</h2>
    <div class="row"><label class="fld">Ícono<input data-f="emoji" value="${esc(d.emoji)}" maxlength="2"></label><label class="fld">Nombre<input data-f="name" value="${esc(d.name)}"></label></div>
    <label class="fld">Puntos para lograrlo<input data-f="pts" inputmode="numeric" value="${esc(d.pts)}"></label>
    <div style="font-size:12px">Vinculá hábitos al crearlos: los puntos que ganes en ellos suman a este objetivo.</div>
    <div class="acts"><button class="btn text" data-a="close">Cancelar</button><button class="btn" data-a="createGoal" ${d.name.trim()?'':'disabled'}>${d.id?'Guardar':'Crear'}</button></div></div></div>`
  const valid = d.name.trim() && (d.type==='MANUAL' || +d.target>0) && (d.type!=='SCREEN_TIME' || d.app)
  return `<div class="scrim"><div class="dlg"><h2>${d.id?'Editar hábito':'Nuevo hábito'}</h2>
    <div class="row"><label class="fld">Ícono<input data-f="emoji" value="${esc(d.emoji)}" maxlength="2"></label><label class="fld">Nombre<input data-f="name" value="${esc(d.name)}"></label></div>
    <div class="lbl">Tamaño</div><div class="chips">${Object.entries(SIZES).map(([k,s])=>chip(d.size===k,`data-set="size" data-v="${k}"`,`${s.emoji} ${s.label} +${s.points}`)).join('')}</div>
    <div class="lbl">Frecuencia</div><div class="chips">${Object.entries(FREQ).map(([k,l])=>chip(d.freq===k,`data-set="freq" data-v="${k}"`,l)).join('')}</div>
    ${d.freq==='WEEKLY'?`<label class="fld" style="margin-top:8px">Veces por semana<input data-f="times" inputmode="numeric" value="${esc(d.times)}"></label>`:''}
    <div class="lbl">Tipo</div><div class="chips">${Object.entries(TYPES).map(([k,l])=>chip(d.type===k,`data-set="type" data-v="${k}"`,l)).join('')}</div>
    ${d.type==='STEPS'?`<label class="fld" style="margin-top:8px">Pasos objetivo (ej. 8000)<input data-f="target" inputmode="numeric" value="${esc(d.target)}"></label>`:''}
    ${d.type==='SCREEN_TIME'?`<label class="fld" style="margin-top:8px">Máximo de minutos por día (ej. 120)<input data-f="target" inputmode="numeric" value="${esc(d.target)}"></label>
      <div class="lbl">App a controlar</div><div class="chips">${APPS.map(a=>chip(d.app===a,`data-set="app" data-v="${a}"`,a)).join('')}</div>`:''}
    ${db.goals.length?`<div class="lbl">Objetivos vinculados</div><div class="chips">${db.goals.map(g=>chip(d.goals.includes(g.id),`data-goal="${g.id}"`,`${esc(g.emoji)} ${esc(g.name)}`)).join('')}</div>`:''}
    <label class="fld">Hora de recordatorio (opcional)<input type="time" data-f="reminder" value="${esc(d.reminder||'')}"></label><div class="acts"><button class="btn text" data-a="close">Cancelar</button><button class="btn" data-a="createHabit" ${valid?'':'disabled'}>${d.id?'Guardar':'Crear'}</button></div></div></div>`
}

A.editHabit = id => { const h=db.habits.find(h=>h.id==id); dialog={...h,kind:'habit',freq:h.frequency,times:String(h.timesPerWeek),target:String(h.target),goals:db.links.filter(l=>l.habitId===h.id).map(l=>l.goalId)}; openMenu=null; render() }
A.editGoal = id => { const g=db.goals.find(g=>g.id==id); dialog={...g,kind:'goal',pts:String(g.targetPoints)}; render() }
A.createHabit = () => { const d = dialog
  if (!d.name.trim() || (d.type!=='MANUAL' && !(+d.target>0))) return
  if (!db.premium && ((!d.id && db.habits.length>=6) || (d.type!=='MANUAL' && db.habits.some(h=>h.id!==d.id && h.type===d.type)))) return A.paywall()
  const id=d.id || db.nextId++, old=db.habits.find(h=>h.id===id)
  const h = { id, name:d.name.trim(), emoji:d.emoji.trim()||'⭐', size:d.size, frequency:d.freq, timesPerWeek:Math.min(7,Math.max(1,parseInt(d.times)||1)),
    type:d.type, target:parseInt(d.target)||0, app:d.app, reminder:d.reminder||'', createdDay:old?.createdDay||today() }
  db.habits=db.habits.filter(h=>h.id!==id); db.habits.push(h)
  db.links=db.links.filter(l=>l.habitId!==id); d.goals.forEach(goalId=>db.links.push({habitId:id,goalId}))
  if (h.type!=='MANUAL') { db.readings[id] ??= 0; evalToday(h) }
  dialog=null; afterChange() }
A.createGoal = () => { const d=dialog; if (!d.name.trim()) return
  if (!db.premium && !d.id && db.goals.length>=2) return A.paywall()
  const g={id:d.id||db.nextId++,name:d.name.trim(),emoji:d.emoji.trim()||'🎯',targetPoints:Math.max(10,parseInt(d.pts)||500)}
  db.goals=db.goals.filter(x=>x.id!==g.id); db.goals.push(g); dialog=null; afterChange() }

function render() {
  const main = app.querySelector('main'), scroll = main?.scrollTop || 0
  app.innerHTML = `${header()}<main>${[todayScreen,goalsScreen,historyScreen,messagesScreen,profileScreen][tab]()}</main>
  ${tab<2?`<button class="fab" data-a="${tab===0?'addHabit':'addGoal'}">＋ ${tab===0?'Nuevo hábito':'Nuevo objetivo'}</button>`:''}
  <nav>${[['⌂','Hoy'],['☆','Objetivos'],['▦','Historial'],['✉','Mensajes'],['○','Perfil']].map(([i,l],k)=>`<button class="${tab===k?'on':''}" data-a="tab" data-id="${k}"><span class="pill">${i}${k===3 && unread()?`<b class="badge">${unread()}</b>`:''}</span>${l}</button>`).join('')}</nav>
  ${dialogHtml()}`
  app.querySelector('main').scrollTop = scroll
  document.getElementById('phone').dataset.theme = db.theme
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

// ===== Historial, mensajes y Premium =====
let historyMonth = new Date(new Date().getFullYear(),new Date().getMonth(),1), historyFilter = 0, selectedDay = today(), bannerTimer
const cutoff = () => ds(addDays(parse(today()),-29))
const unread = () => db.messages.filter(m=>!m.read).length
const doneRecords = () => db.completions.filter(c=>c.status==='DONE')
function bestStreak() {
  const days=[...new Set([...doneRecords().map(c=>c.day),...db.protectedDays])].sort()
  let best=0, n=0, prev=''
  days.forEach(day=>{ n=prev && ds(addDays(parse(prev),1))===day?n+1:1; best=Math.max(best,n); prev=day }); return best
}
function rate(records) { return records.length?Math.round(records.filter(c=>c.status==='DONE').length/records.length*100):0 }
function historyScreen() {
  if (!db.premium && selectedDay<cutoff()) selectedDay=today()
  const y=historyMonth.getFullYear(), m=historyMonth.getMonth(), start=(new Date(y,m,1).getDay()+6)%7, count=new Date(y,m+1,0).getDate()
  const records=db.completions.filter(c=>!historyFilter || c.habitId===historyFilter)
  const recent=records.filter(c=>c.day>=cutoff() && c.day<=today())
  const cells=Array.from({length:start},()=>'<span></span>')
  for(let i=1;i<=count;i++) {
    const day=ds(new Date(y,m,i)), locked=!db.premium && day<cutoff(), cs=records.filter(c=>c.day===day), done=cs.filter(c=>c.status==='DONE').length
    const daily=db.habits.filter(h=>h.frequency==='DAILY' && h.createdDay<=day)
    const perfect=historyFilter?done>0:daily.length>0 && daily.every(h=>cs.some(c=>c.habitId===h.id && c.status==='DONE'))
    const state=perfect?'full':done?'partial':cs.some(c=>c.status==='MISSED')?'failed':''
    cells.push(`<button class="day ${locked?'':state} ${selectedDay===day?'selected':''}" data-a="day" data-id="${day}" ${day>today()?'disabled':''}>${i}${locked?'<small>🔒</small>':db.protectedDays.includes(day)?'<small>◇</small>':''}</button>`)
  }
  const detail=records.filter(c=>c.day===selectedDay)
  return `<div class="month"><button class="chip" data-a="month" data-id="-1">◀</button><b>${esc(historyMonth.toLocaleDateString('es-AR',{month:'long',year:'numeric'}))}</b><button class="chip" data-a="month" data-id="1">▶</button></div>
  <div class="chips filters"><button class="chip ${!historyFilter?'on':''}" data-a="filter" data-id="0">Todos</button>${db.habits.map(h=>`<button class="chip ${historyFilter===h.id?'on':''}" data-a="filter" data-id="${h.id}">${esc(h.emoji)} ${esc(h.name)}</button>`).join('')}</div>
  <div class="calendar">${['L','M','M','J','V','S','D'].map(x=>`<b>${x}</b>`).join('')}${cells.join('')}</div><p class="small">Verde: todos · verde tenue: algunos · rojo: fallados · gris: sin datos.</p>
  ${!db.premium?'<button class="btn out" data-a="paywall">🔒 Gratis: últimos 30 días · Desbloqueá todo</button>':''}
  <div class="sec">${esc(selectedDay)}</div><div class="card">${db.protectedDays.includes(selectedDay)?'<p class="positive">◇ Día protegido</p>':''}${detail.length?detail.map(c=>{const h=db.habits.find(h=>h.id===c.habitId); return `<p class="detail ${c.status==='DONE'?'positive':'negative'}">${esc(h?.emoji||'')} ${esc(h?.name||'Hábito eliminado')} · ${c.status==='DONE'?'Cumplido':'Fallado'}</p>`}).join(''):'Sin registros para este día.'}</div>
  <div class="sec">ESTADÍSTICAS</div><div class="card">Cumplimiento (30 días): <b>${rate(recent)}%</b><br>Mejor racha: <b>${bestStreak()} días</b><br>Total completados: <b>${doneRecords().length}</b></div>
  ${db.premium?advancedStats(): '<button class="btn out" data-a="paywall">🔒 Tasa por hábito y mejor día de la semana</button>'}`
}
function advancedStats() {
  const weekdays=['lunes','martes','miércoles','jueves','viernes','sábado','domingo']
  const ranked=weekdays.map((name,i)=>({name,records:db.completions.filter(c=>(parse(c.day).getDay()+6)%7===i)})).filter(x=>x.records.length).sort((a,b)=>rate(b.records)-rate(a.records))
  return `<div class="card">${db.habits.map(h=>`<p class="detail">${esc(h.name)}: ${rate(db.completions.filter(c=>c.habitId===h.id))}%</p>`).join('')}<b>Mejor día: ${ranked.length?`${ranked[0].name} (${rate(ranked[0].records)}%)`:'sin datos'}</b></div>`
}
A.month = delta => { const next=new Date(historyMonth.getFullYear(),historyMonth.getMonth()+Number(delta),1); if(next>new Date()) return; historyMonth=next; render() }
A.filter = id => {historyFilter=+id;render()}
A.day = day => {if(!db.premium && day<cutoff()) return A.paywall(); selectedDay=day;render()}
const MOTIVATIONS=['Un día a la vez. Hoy cuenta.','No tiene que ser perfecto, tiene que ser hoy.','La constancia le gana al talento.','Chiquito pero todos los días.','Tu yo del futuro te lo va a agradecer.','Arrancá por el más fácil y seguí rodando.','Racha que se cuida, racha que crece.']
function addMessage(type,title,body,notify=false) {
  const message={id:db.nextId++,type,title,body,timestamp:Date.now(),read:false}; db.messages.push(message); save()
  if(notify) showNotification(message)
}
function generateMessage(type,notify=true) {
  const daily=db.habits.filter(h=>h.frequency==='DAILY' && todayOf(h)?.status!=='DONE')
  const pending=db.habits.filter(h=>h.frequency==='DAILY'?todayOf(h)?.status!=='DONE':Game.weekCount(h,db.completions)<h.timesPerWeek)
  const names=hs=>hs.map(h=>`${h.emoji} ${h.name}`).join(', ')
  const phrase=MOTIVATIONS[db.motivation++%MOTIVATIONS.length]
  let title='',body=''
  if(type==='DAILY_PLAN') {if(!db.settings.daily && notify) return toast('Activá el plan diario en Notificaciones.'); title='Tu plan de hoy';body=(pending.length?`Hoy tenés que: ${names(pending)}. `:'¡Ya completaste tu plan de hoy! ')+phrase}
  if(type==='HABIT_REMINDER') {
    if(!db.settings.reminders && notify) return toast('Activá los recordatorios en Notificaciones.')
    const h=db.habits.find(h=>h.reminder && todayOf(h)?.status!=='DONE')
    if(!h) return notify?toast('Configurá una hora en un hábito pendiente para probarlo.'):undefined
    title=`⏰ ${h.name}`;body=`Es la hora. Sumá +${Game.pointsFor(h,Game.habitStreak(h,db.completions))} XP 💪`
  }
  if(type==='STREAK_RISK') {
    const n=Game.globalStreak(db.completions)
    if(!n || !daily.length || (!db.settings.risk && notify)) return notify?toast('Sin alerta: necesitás una racha y diarios pendientes, con el aviso activo.'):undefined
    title=`🔥 Tu racha de ${n} días está en riesgo`;body=`Te faltan: ${names(daily)}. Todavía estás a tiempo.`
  }
  if(type==='WEEKLY_SUMMARY') {
    if(!db.settings.weekly && notify) return toast('Activá el resumen semanal en Notificaciones.')
    const start=ds(weekStart()), records=db.completions.filter(c=>c.day>=start && c.day<=today()), done=records.filter(c=>c.status==='DONE')
    let expected=0
    for(const h of db.habits) {for(let day=weekStart();ds(day)<=today();day=addDays(day,1)) if(h.frequency==='DAILY' && ds(day)>=h.createdDay) expected++; if(h.frequency==='WEEKLY') expected+=h.timesPerWeek}
    const best=db.habits.map(h=>({h,n:done.filter(c=>c.habitId===h.id).length})).sort((a,b)=>b.n-a.n)[0]
    const completed=db.habits.reduce((sum,h)=>sum+Math.min(done.filter(c=>c.habitId===h.id).length,h.frequency==='WEEKLY'?h.timesPerWeek:7),0)
    title='📊 Tu semana';body=`Cumpliste ${completed} de ${expected} (${expected?Math.round(completed/expected*100):0}%). Ganaste ${done.reduce((a,c)=>a+c.points,0)} XP. Mejor hábito: ${best?.n?best.h.name:'todavía sin completados'}.`
  }
  if(type==='MOTIVATION') {title='Dale, vos podés';body=phrase}
  if(title) addMessage(type,title,body,notify)
}
function showNotification(message) {
  document.querySelector('.notification')?.remove();clearTimeout(bannerTimer)
  const el=document.createElement('button');el.className='notification';el.innerHTML=`<small>Rachazo · ahora</small><b>${esc(message.title)}</b><span>${esc(message.body)}</span>`
  el.onclick=()=>{tab=3;message.read=true;save();el.remove();render()};document.getElementById('phone').appendChild(el);bannerTimer=setTimeout(()=>el.remove(),4000)
  if('Notification' in window && Notification.permission==='granted') {try {const n=new Notification(message.title,{body:message.body});n.onclick=()=>{window.focus();tab=3;message.read=true;save();render()}} catch { /* El navegador puede requerir un service worker. */ }}
}
function simulationHtml() {return `<div class="card"><b>Simular notificaciones</b><p class="small">Probá los avisos con tus datos actuales.</p><div class="chips">${[['DAILY_PLAN','Plan de hoy'],['HABIT_REMINDER','Recordatorio'],['STREAK_RISK','Racha en riesgo'],['WEEKLY_SUMMARY','Resumen semanal']].map(([id,name])=>`<button class="chip" data-a="notify" data-id="${id}">${name}</button>`).join('')}</div></div>`}
function messagesScreen() {return `<div class="month"><h2>Mensajes</h2><button class="chip" data-a="readAll">Marcar todo como leído</button></div>${simulationHtml()}${[...db.messages].sort((a,b)=>b.timestamp-a.timestamp || b.id-a.id).map(m=>`<article class="card"><div class="message-head"><button class="message-title" data-a="read" data-id="${m.id}">${!m.read?'<i class="unread-dot"></i>':''}<b>${esc(m.title)}</b></button><button class="iconbtn" data-a="deleteMessage" data-id="${m.id}" aria-label="Borrar mensaje">×</button></div><p class="small">${esc(m.body)}</p><small class="muted">${new Date(m.timestamp).toLocaleString('es-AR')}</small></article>`).join('')||'<p class="empty">No tenés mensajes.</p>'}`}
A.notify = type=>{generateMessage(type);render()}
A.readAll=()=>{db.messages.forEach(m=>m.read=true);save();render()}
A.read=id=>{db.messages.find(m=>m.id==id).read=true;save();render()}
A.deleteMessage=id=>{db.messages=db.messages.filter(m=>m.id!=id);save();render()}
A.browserNotifications=async()=>{if(!('Notification' in window)) return toast('Este navegador no admite notificaciones.');try{const result=await Notification.requestPermission();toast(result==='granted'?'Notificaciones permitidas.':'Permiso no concedido.')}catch{toast('No se pudo solicitar el permiso.')}}
function notificationSettings() {return `<div class="sec">NOTIFICACIONES</div><div class="card">${[['daily','Plan diario (9:00 por defecto)'],['reminders','Recordatorios por hábito'],['risk','Racha en riesgo · 20:30'],['weekly','Resumen semanal · domingo 20:00']].map(([key,label])=>`<label class="switch">${label}<input type="checkbox" data-setting="${key}" ${db.settings[key]?'checked':''}></label>`).join('')}<label class="fld">Hora del plan diario<input type="time" data-setting="time" value="${db.settings.time}"></label><p class="small">En esta demo los avisos se disparan con los botones de simulación.</p><button class="btn out" data-a="browserNotifications">Permitir notificaciones del navegador</button></div>${simulationHtml()}`}
app.addEventListener('change',e=>{const t=e.target;if(t.dataset.setting){db.settings[t.dataset.setting]=t.type==='checkbox'?t.checked:t.value;save()}})
const ACHIEVEMENTS=[
 ['first_done','Primer paso','Completá tu primer hábito',1,()=>doneRecords().length],
 ['streak_3','En llamas','Racha global de 3 días',3,bestStreak],['streak_7','Semana perfecta','Racha de 7 días',7,bestStreak],['streak_30','Imparable','Racha de 30 días',30,bestStreak],
 ['perfect_day','Día redondo','Completá todos los diarios de un día',1,()=>Number([...new Set(doneRecords().map(c=>c.day))].some(day=>{const hs=db.habits.filter(h=>h.frequency==='DAILY' && h.createdDay<=day);return hs.length && hs.every(h=>db.completions.some(c=>c.day===day && c.habitId===h.id && c.status==='DONE'))}))],
 ['done_50','Medio centenar','50 hábitos completados',50,()=>doneRecords().length],['done_100','Centurión','100 completados',100,()=>doneRecords().length],
 ['level_5','Aventurero','Llegá a nivel 5',5,()=>Game.level(xp())],['level_10','Guerrero','Llegá a nivel 10',10,()=>Game.level(xp())],
 ['goal_done','Misión cumplida','Completá un objetivo',1,()=>Number(db.goals.some(g=>Game.goalPoints(g,db.links,db.completions)>=g.targetPoints))],
 ['steps_auto','Caminante','Cumplí un hábito de pasos automáticamente',1,()=>Number(doneRecords().some(c=>c.auto && db.habits.find(h=>h.id===c.habitId)?.type==='STEPS'))],
 ['focus_auto','Dueño de tu tiempo','Cumplí un hábito de tiempo de pantalla',1,()=>Number(doneRecords().some(c=>c.auto && db.habits.find(h=>h.id===c.habitId)?.type==='SCREEN_TIME'))]
]
function checkAchievements(){for(const [id,name,,target,value] of ACHIEVEMENTS) if(!db.achievements.includes(id) && value()>=target){db.achievements.push(id);fx.confetti=true;addMessage('ACHIEVEMENT',`🏆 Logro desbloqueado: ${name}`,'¡Seguí así! Cada paso cuenta.')}}
function achievementsHtml(){return `<div class="sec">LOGROS · ${db.achievements.length}/12</div>${ACHIEVEMENTS.map(([id,name,description,target,value])=>`<div class="card achievement ${db.achievements.includes(id)?'unlocked':''}"><b>${db.achievements.includes(id)?'✓':'🔒'} ${name}</b><p class="small">${description}</p><small>${db.achievements.includes(id)?'Desbloqueado':`${Math.min(target,value())} / ${target}`}</small></div>`).join('')}`}
const PLANS=[['premium_monthly','Mensual','USD 2.99','por mes'],['premium_yearly','Anual','USD 19.99','por año'],['premium_lifetime','De por vida','USD 39.99','pago único']]
A.paywall=()=>{dialog={kind:'paywall',plan:db.plan||'premium_yearly'};render()}
A.selectPlan=id=>{dialog.plan=id;render()}
A.continuePurchase=()=>{dialog={kind:'purchase',plan:dialog.plan};render()}
A.confirmPurchase=()=>{db.premium=true;db.plan=dialog.plan;dialog=null;fx.confetti=true;afterChange();toast('¡Ya tenés Rachazo Premium!')}
A.restore=()=>toast(db.premium?'Tu compra demo está activa.':'No hay compras demo para restaurar en este navegador.')
A.free=()=>{db.premium=false;db.theme='matte';save();render()}
A.theme=id=>{if(id!=='matte' && !db.premium)return A.paywall();db.theme=id;save();render()}
A.freeze=()=>{if(!db.premium)return A.paywall();const month=today().slice(0,7), day=ds(addDays(parse(today()),-1));if(db.protectedDays.includes(day))return toast('Ayer ya está protegido.');if((db.freezes[month]||0)>=2)return toast('Ya usaste tus 2 protectores del mes.');if(db.completions.some(c=>c.day===day && c.status==='DONE'))return toast('Tu racha de ayer ya está a salvo.');db.protectedDays.push(day);db.freezes[month]=(db.freezes[month]||0)+1;afterChange();toast('Ayer quedó protegido. Tu racha sigue.')}
function premiumProfile(){return `<div class="card"><h2>${db.premium?'✓ Premium activo':'Rachazo Premium'}</h2><p class="small">${db.premium?esc(PLANS.find(p=>p[0]===db.plan)?.[1]||'Premium'):'Más espacio para tus hábitos y tu historia.'}</p><button class="btn out" data-a="paywall">${db.premium?'Gestionar':'Conocé Premium'}</button>${db.premium?'<button class="btn out" data-a="free">Volver a gratis (demo)</button>':''}</div><div class="sec">TEMAS</div><div class="chips">${[['matte','Negro mate'],['amoled','AMOLED'],['graphite','Grafito']].map(([id,label])=>`<button class="chip ${db.theme===id?'on':''}" data-a="theme" data-id="${id}">${id!=='matte'&&!db.premium?'🔒 ':''}${label}</button>`).join('')}</div><div class="card protector"><b>Protector de racha</b><p class="small">Salvá un día fallado. ${db.freezes[today().slice(0,7)]||0}/2 usados este mes.</p><button class="btn out" data-a="freeze">${db.premium?'':'🔒 '}Proteger ayer</button></div>`}
function paywallHtml(){const d=dialog, p=PLANS.find(p=>p[0]===d.plan)
 if(d.kind==='purchase')return `<div class="scrim purchase"><div class="dlg"><p class="muted">Google Play · DEMO</p><h2>Compra de prueba — no se cobra nada</h2><p>${p[1]} · ${p[2]} ${p[3]}</p><p class="small">La compra es simulada y se guarda solo en este navegador.</p><div class="acts"><button class="btn text" data-a="close">Cancelar</button><button class="btn" data-a="confirmPurchase">Confirmar</button></div></div></div>`
 return `<div class="scrim"><div class="dlg"><h2>Rachazo Premium</h2><p class="positive">✓ Hábitos y objetivos ilimitados<br>✓ Automáticos ilimitados<br>✓ Historial completo + estadísticas avanzadas<br>✓ Temas AMOLED y Grafito<br>✓ 2 protectores de racha por mes</p><p class="small">Sin publicidad en ninguna versión. Recordatorios, mensajes, logros y XP incluidos gratis.</p>${PLANS.map(([id,name,price,per])=>`<button class="plan ${id===d.plan?'selected':''}" data-a="selectPlan" data-id="${id}">${id==='premium_yearly'?'<small class="positive">Más elegido · ahorrás 44%</small>':''}<b>${name} · ${price}</b><span>${per}${id==='premium_yearly'?' · 7 días de prueba gratis':''}</span></button>`).join('')}<button class="btn full" data-a="continuePurchase">Continuar</button><button class="btn out" data-a="restore">Restaurar compras</button><p class="small muted">Se renueva automáticamente. Cancelás cuando quieras desde Google Play. La compra de por vida es un pago único. Compras simuladas en esta demo.</p><button class="btn text" data-a="close">Cerrar</button></div></div>`}

refresh()
if (!db.messages.length) { ['DAILY_PLAN','STREAK_RISK','WEEKLY_SUMMARY','MOTIVATION'].forEach(type=>generateMessage(type,false)) }
checkAchievements(); save(); lastLevel = Game.level(xp()); render(); if (fx.confetti) { confetti(); fx.confetti=false }
