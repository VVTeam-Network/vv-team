// ================================================================
// VV TEAM CEO Panel — Logic v2.0
// Include: Dashboard, Users Manager, Bon Digital, Broadcast,
//          VVhi Tendinte, Moderare automata, VV Charter
// ================================================================

const db   = firebase.firestore();
const auth = firebase.auth();
const COIN_DEFAULT = 10;
const RANKS = ['Neofit','Explorer','Trainer','Master','Fondator'];

let currentCEO = null;
let currentSection = 'dashboard';
let _pendingUnsub = null;
let _activeUnsub  = null;
let _dashUnsub    = null;
let ceoMapInstance = null;

// ── SIDEBAR ──────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('main-content').classList.toggle('shifted');
}

// ── AUTH ─────────────────────────────────────────────────────
firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);

auth.onAuthStateChanged(async function(user) {
  if (!user) { showLogin(); return; }
  try {
    const doc = await db.collection('users').doc(user.uid).get();
    if (doc.exists && doc.data().role === 'ceo') {
      currentCEO = { uid: user.uid, ...doc.data() };
      hideLogin();
      initDashboard();
    } else { showLogin(); }
  } catch(e) { showLogin(); }
});

function showLogin() { document.getElementById('login-screen').classList.remove('hidden'); }
function hideLogin() { document.getElementById('login-screen').classList.add('hidden'); }

async function handleLogin(email, password) {
  const btn = document.querySelector('.login-btn');
  if (btn) { btn.textContent='SE VERIFICĂ...'; btn.disabled=true; }
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch(e) {
    if (btn) { btn.textContent='ACCES REFUZAT'; btn.disabled=false; setTimeout(()=>btn.textContent='INTRĂ',2000); }
  }
}

function handleLogout() {
  if (_pendingUnsub) { _pendingUnsub(); _pendingUnsub=null; }
  if (_activeUnsub)  { _activeUnsub();  _activeUnsub=null; }
  if (_dashUnsub)    { _dashUnsub();    _dashUnsub=null; }
  auth.signOut().then(()=>location.reload());
}

// ── DASHBOARD INIT ────────────────────────────────────────────
async function initDashboard() {
  showSection('dashboard');
  loadBadges();
}

async function loadBadges() {
  try {
    const [m,c,f,circ] = await Promise.all([
      db.collection('missions').where('status','==','pending').get(),
      db.collection('contracts').where('status','==','pending').get(),
      db.collection('feedback').where('status','==','nou').get(),
      db.collection('contributors').where('status','==','pending').get()
    ]);
    setBadge('missions',m.size); setBadge('contracts',c.size);
    setBadge('feedback',f.size); setBadge('circle',circ.size);
  } catch(e) {}
}

function setBadge(name,count) {
  const el=document.getElementById('badge-'+name);
  if (!el) return;
  el.textContent=count; el.style.display=count>0?'inline-block':'none';
}

// ── NAVIGARE ─────────────────────────────────────────────────
function showSection(name) {
  if (currentSection==='circle'&&name!=='circle') {
    if (_pendingUnsub){_pendingUnsub();_pendingUnsub=null;}
    if (_activeUnsub){_activeUnsub();_activeUnsub=null;}
  }
  document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const sec=document.getElementById('section-'+name);
  const nav=document.getElementById('nav-'+name);
  if (sec) sec.classList.add('active');
  if (nav) nav.classList.add('active');

  const titles={
    dashboard:'⬡ Dashboard',missions:'Galerie Misiuni',contracts:'Contracte',
    feedback:'Feedback & Suport',talent:'Talent Pool',leaderboard:'Leaderboard',
    keys:'Chei Beta',config:'Config Live',audit:'Audit Log',map:'Harta Misiuni',
    vvhi:'VVhi Shadow Mode',circle:'⬡ Inner Circle',users:'Users Manager',
    broadcast:'📡 Broadcast',transactions:'Bon Digital',charter:'VV CHARTER'
  };
  const titleEl=document.getElementById('section-heading');
  if (titleEl) titleEl.textContent=titles[name]||name;
  currentSection=name;

  if (name==='dashboard')    loadDashboard();
  if (name==='missions')     loadMissions('pending');
  if (name==='contracts')    loadContracts();
  if (name==='feedback')     loadFeedback();
  if (name==='talent')       loadTalentPool();
  if (name==='leaderboard')  loadLeaderboard();
  if (name==='keys')         loadKeys();
  if (name==='audit')        loadAuditLog();
  if (name==='map')          initCEOMap();
  if (name==='vvhi')         loadVVhi();
  if (name==='config')       loadConfig();
  if (name==='circle')       switchCircleTab('pending');
  if (name==='users')        loadUsersManager();
  if (name==='broadcast')    initBroadcast();
  if (name==='transactions') loadTransactions();
  if (name==='charter')      loadCharterEditor();

  logCEOAction('NAV',name);
  const sb=document.getElementById('sidebar');
  if (sb&&sb.classList.contains('open')&&window.innerWidth<768){
    sb.classList.remove('open');
    document.getElementById('main-content').classList.remove('shifted');
  }
}

// ================================================================
// DASHBOARD — Statistici live
// ================================================================
async function loadDashboard() {
  const el=document.getElementById('dashboard-content');
  if (!el) return;
  el.innerHTML='<div style="color:rgba(255,255,255,0.3);padding:20px;text-align:center;">Se încarcă...</div>';

  try {
    const today=new Date(); today.setHours(0,0,0,0);
    const todayTs=firebase.firestore.Timestamp.fromDate(today);

    const [users,founders,missionsToday,pulseToday,pendingMissions,pendingCircle] = await Promise.all([
      db.collection('users').get(),
      db.collection('contributors').where('status','==','active').get(),
      db.collection('missions').where('createdAt','>=',todayTs).get(),
      db.collection('vvhi_dataset').where('action','==','VV_PULSE_CONNECT').where('timestamp','>=',todayTs).get(),
      db.collection('missions').where('status','==','pending').get(),
      db.collection('contributors').where('status','==','pending').get()
    ]);

    // Zone fierbinti din misiuni
    var zoneMap={};
    missionsToday.forEach(function(doc){
      var d=doc.data();
      if(d.lat&&d.lng){
        var zone=d.lat.toFixed(2)+','+d.lng.toFixed(2);
        zoneMap[zone]=(zoneMap[zone]||0)+1;
      }
    });
    var topZone=Object.entries(zoneMap).sort((a,b)=>b[1]-a[1])[0];

    // Ore active
    var oreMap={};
    pulseToday.forEach(function(doc){
      var d=doc.data();
      if(d.timestamp){
        var ora=d.timestamp.toDate().getHours();
        oreMap[ora]=(oreMap[ora]||0)+1;
      }
    });
    var topOra=Object.entries(oreMap).sort((a,b)=>b[1]-a[1])[0];

    el.innerHTML=[
      // Stats grid
      '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px;">',
        mkDashStat(users.size,'USERI TOTAL','#fff'),
        mkDashStat(founders.size,'FONDATORI','#D4AF37'),
        mkDashStat(pulseToday.size,'PULSE AZI','#0A84FF'),
        mkDashStat(missionsToday.size,'MISIUNI AZI','#34c759'),
      '</div>',

      // Alerte
      pendingMissions.size>0?'<div style="background:rgba(255,149,0,0.08);border:1px solid rgba(255,149,0,0.2);border-radius:12px;padding:14px 16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;" onclick="showSection(\'missions\')"><span style="font-size:13px;font-weight:700;color:rgba(255,149,0,0.8);">⚠️ '+pendingMissions.size+' misiuni așteaptă aprobare</span><span style="color:rgba(255,149,0,0.5)">›</span></div>':'',
      pendingCircle.size>0?'<div style="background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.2);border-radius:12px;padding:14px 16px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;" onclick="showSection(\'circle\')"><span style="font-size:13px;font-weight:700;color:rgba(212,175,55,0.8);">⬡ '+pendingCircle.size+' cereri Inner Circle pending</span><span style="color:rgba(212,175,55,0.5)">›</span></div>':'',

      // VVhi insight
      '<div style="background:rgba(10,132,255,0.06);border:1px solid rgba(10,132,255,0.15);border-radius:14px;padding:16px;margin-bottom:12px;">',
        '<div style="font-size:10px;color:rgba(10,132,255,0.6);letter-spacing:3px;font-weight:700;margin-bottom:10px;">VVhi · TENDINȚE AZI</div>',
        topOra?'<div style="font-size:13px;color:rgba(255,255,255,0.7);margin-bottom:6px;">⏰ Ora de vârf: <strong style="color:#fff;">'+topOra[0]+':00</strong> ('+topOra[1]+' pulse-uri)</div>':'',
        topZone?'<div style="font-size:13px;color:rgba(255,255,255,0.7);">📍 Zonă activă: <strong style="color:#fff;">'+topZone[0]+'</strong> ('+topZone[1]+' misiuni)</div>':'<div style="font-size:12px;color:rgba(255,255,255,0.3);">Nicio activitate înregistrată azi.</div>',
      '</div>',

      // Actiuni rapide
      '<div style="font-size:10px;color:rgba(255,255,255,0.25);letter-spacing:3px;font-weight:700;margin-bottom:10px;">ACȚIUNI RAPIDE</div>',
      '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">',
        '<button onclick="showSection(\'broadcast\')" style="padding:14px;background:rgba(10,132,255,0.1);border:1px solid rgba(10,132,255,0.2);border-radius:12px;color:#0A84FF;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">📡 Broadcast</button>',
        '<button onclick="showSection(\'users\')" style="padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;color:rgba(255,255,255,0.6);font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">👥 Users</button>',
        '<button onclick="showSection(\'transactions\')" style="padding:14px;background:rgba(52,199,89,0.08);border:1px solid rgba(52,199,89,0.15);border-radius:12px;color:#34c759;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">🧾 Bon Digital</button>',
        '<button onclick="showSection(\'charter\')" style="padding:14px;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.15);border-radius:12px;color:#D4AF37;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">⬡ Charter</button>',
      '</div>'
    ].join('');

  } catch(e) { el.innerHTML='<div style="color:#ff3b30;padding:20px;">Eroare: '+e.message+'</div>'; }
}

function mkDashStat(val,lbl,color) {
  return '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:16px;text-align:center;"><div style="font-size:28px;font-weight:900;color:'+color+';font-family:\'Syne\',sans-serif;">'+val+'</div><div style="font-size:9px;color:rgba(255,255,255,0.3);letter-spacing:2px;font-weight:700;margin-top:4px;">'+lbl+'</div></div>';
}

// ================================================================
// USERS MANAGER
// ================================================================
async function loadUsersManager() {
  const el=document.getElementById('users-content')||document.getElementById('section-users');
  if (!el) return;

  try {
    const snap=await db.collection('users').orderBy('joinedAt','desc').limit(100).get();
    if (snap.empty) { el.innerHTML='<div style="color:rgba(255,255,255,0.3);padding:20px;">Niciun user.</div>'; return; }

    let html='<div style="margin-bottom:16px;"><input id="users-search" type="text" placeholder="Caută alias..." oninput="filterUsers()" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:12px 14px;color:#fff;font-size:13px;font-family:inherit;outline:none;"></div>';
    html+='<div id="users-list">';

    snap.forEach(function(doc) {
      const u=doc.data(); const uid=doc.id;
      const date=u.joinedAt?new Date(u.joinedAt.seconds*1000).toLocaleDateString('ro'):'—';
      const isFounder=u.isFounder?'<span style="font-size:9px;background:rgba(212,175,55,0.12);border:1px solid rgba(212,175,55,0.3);color:#D4AF37;padding:2px 7px;border-radius:4px;font-weight:700;letter-spacing:1px;">FONDATOR #'+u.founderNum+'</span>':'' ;
      html+='<div class="user-row" data-alias="'+(u.alias||'').toLowerCase()+'" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:14px;margin-bottom:8px;">';
      html+='<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">';
      html+='<div style="flex:1;min-width:0;">';
      html+='<div style="font-size:14px;font-weight:700;color:#fff;margin-bottom:4px;">'+(u.alias||'INSIDER')+' '+isFounder+'</div>';
      html+='<div style="font-size:11px;color:rgba(255,255,255,0.3);">⬡ '+(u.balance||0)+' VV &nbsp;·&nbsp; Intrat: '+date+'</div>';
      if (u.vvCoreId) html+='<div style="font-size:10px;color:rgba(212,175,55,0.5);font-family:monospace;margin-top:2px;">'+u.vvCoreId+'</div>';
      html+='</div>';
      html+='<div style="display:flex;gap:6px;flex-shrink:0;">';
      html+='<button onclick="msgUser(\''+uid+'\',\''+((u.alias||'INSIDER').replace(/'/g,"\\'"))+'\')" style="padding:7px 10px;background:rgba(10,132,255,0.1);border:1px solid rgba(10,132,255,0.2);border-radius:8px;color:#0A84FF;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">MSG</button>';
      html+='<button onclick="adjustBalance(\''+uid+'\',\''+((u.alias||'INSIDER').replace(/'/g,"\\'"))+'\')" style="padding:7px 10px;background:rgba(212,175,55,0.08);border:1px solid rgba(212,175,55,0.15);border-radius:8px;color:#D4AF37;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">VV</button>';
      html+='<button onclick="banUser(\''+uid+'\',\''+((u.alias||'INSIDER').replace(/'/g,"\\'"))+'\')" style="padding:7px 10px;background:rgba(255,59,48,0.08);border:1px solid rgba(255,59,48,0.15);border-radius:8px;color:#ff3b30;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">BAN</button>';
      html+='</div></div></div>';
    });
    html+='</div>';
    el.innerHTML=html;
  } catch(e) { if(el) el.innerHTML='<div style="color:#ff3b30;padding:20px;">Eroare: '+e.message+'</div>'; }
}

function filterUsers() {
  var q=(document.getElementById('users-search').value||'').toLowerCase();
  document.querySelectorAll('.user-row').forEach(function(row){
    row.style.display=(row.dataset.alias||'').includes(q)?'block':'none';
  });
}

async function msgUser(uid, alias) {
  var msg=prompt('Mesaj pentru '+alias+':');
  if (!msg||!msg.trim()) return;
  try {
    await db.collection('inbox').add({ to:uid, from:'CEO', alias:'VV Team', message:msg.trim(), type:'support_resolved', read:false, createdAt:firebase.firestore.FieldValue.serverTimestamp() });
    showNotif('✅ Mesaj trimis la '+alias);
    logCEOAction('MSG_USER', alias);
  } catch(e) { showNotif('Eroare: '+e.message,true); }
}

async function adjustBalance(uid, alias) {
  var val=prompt('Ajustare VV Coins pentru '+alias+' (ex: +50 sau -20):');
  if (!val) return;
  var amount=parseInt(val.replace('+',''));
  if (isNaN(amount)) { showNotif('Sumă invalidă.',true); return; }
  try {
    await db.collection('users').doc(uid).update({ balance:firebase.firestore.FieldValue.increment(amount) });
    // Bon digital
    await createBonDigital(uid, alias, amount, 'CEO_ADJUSTMENT');
    showNotif('✅ Balance ajustat: '+val+' VV pentru '+alias);
    logCEOAction('ADJUST_BALANCE', alias+' '+val);
  } catch(e) { showNotif('Eroare: '+e.message,true); }
}

async function banUser(uid, alias) {
  if (!confirm('Bannezi userul '+alias+'?\nAceasta va bloca accesul la aplicație.')) return;
  try {
    await db.collection('users').doc(uid).update({ banned:true, bannedAt:firebase.firestore.FieldValue.serverTimestamp(), bannedBy:'CEO' });
    await db.collection('inbox').add({ to:uid, from:'CEO', alias:'VV Team', message:'Contul tău a fost suspendat pentru încălcarea VV Charter. Contactează vv.ep.team@gmail.com pentru apel.', type:'ban_notice', read:false, createdAt:firebase.firestore.FieldValue.serverTimestamp() });
    showNotif('⛔ '+alias+' banat.');
    logCEOAction('BAN_USER', alias);
    loadUsersManager();
  } catch(e) { showNotif('Eroare: '+e.message,true); }
}

// ================================================================
// BON DIGITAL — Tranzacții
// ================================================================
async function createBonDigital(uid, alias, amount, source, missionId) {
  // Genereaza ID tranzactie
  var chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var txId='VV-TX-';
  for(var i=0;i<8;i++) txId+=chars[Math.floor(Math.random()*chars.length)];

  try {
    await db.collection('transactions').add({
      txId: txId,
      uid: uid,
      alias: alias||'INSIDER',
      amount: amount,
      source: source||'SISTEM',
      missionId: missionId||null,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      // Auto-stergere dupa 90 zile — marker pentru Cloud Function viitoare
      expiresAt: firebase.firestore.Timestamp.fromDate(new Date(Date.now()+90*24*60*60*1000))
    });
    return txId;
  } catch(e) { return null; }
}

async function loadTransactions() {
  const el=document.getElementById('transactions-content')||document.getElementById('section-transactions');
  if (!el) return;

  try {
    const snap=await db.collection('transactions').orderBy('timestamp','desc').limit(50).get();
    if (snap.empty) { el.innerHTML='<div style="color:rgba(255,255,255,0.3);padding:20px;text-align:center;">Nicio tranzacție înregistrată.</div>'; return; }

    let html='<div style="font-size:10px;color:rgba(255,255,255,0.25);letter-spacing:3px;font-weight:700;margin-bottom:12px;">ULTIMELE 50 TRANZACȚII</div>';
    snap.forEach(function(doc) {
      const t=doc.data();
      const date=t.timestamp?new Date(t.timestamp.seconds*1000).toLocaleString('ro'):'—';
      const isPlus=t.amount>0;
      html+='<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:12px 14px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center;">';
      html+='<div><div style="font-size:12px;font-weight:700;color:#fff;margin-bottom:2px;">'+(t.alias||'INSIDER')+'</div>';
      html+='<div style="font-size:10px;color:rgba(255,255,255,0.3);">'+t.source+' · '+date+'</div>';
      html+='<div style="font-size:9px;color:rgba(255,255,255,0.2);font-family:monospace;margin-top:2px;">'+(t.txId||'—')+'</div></div>';
      html+='<div style="font-size:16px;font-weight:900;color:'+(isPlus?'#34c759':'#ff3b30')+'">'+(isPlus?'+':'')+t.amount+' VV</div>';
      html+='</div>';
    });
    el.innerHTML=html;
  } catch(e) { if(el) el.innerHTML='<div style="color:#ff3b30;padding:20px;">Eroare: '+e.message+'</div>'; }
}

// ================================================================
// BROADCAST — Mesaj la toti userii
// ================================================================
function initBroadcast() {
  const el=document.getElementById('broadcast-content')||document.getElementById('section-broadcast');
  if (!el) return;
  el.innerHTML=[
    '<div style="background:rgba(10,132,255,0.06);border:1px solid rgba(10,132,255,0.15);border-radius:16px;padding:20px;margin-bottom:16px;">',
      '<div style="font-size:10px;color:rgba(10,132,255,0.6);letter-spacing:3px;font-weight:700;margin-bottom:12px;">📡 BROADCAST CĂTRE TOȚI INSIDERII</div>',
      '<textarea id="broadcast-msg" placeholder="Mesajul tău apare în Intelligence Inbox al fiecărui Insider..." style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:12px 14px;color:#fff;font-size:13px;font-family:inherit;outline:none;resize:none;min-height:100px;margin-bottom:10px;line-height:1.6;"></textarea>',
      '<select id="broadcast-type" style="width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:12px 14px;color:#fff;font-size:13px;font-family:inherit;outline:none;margin-bottom:10px;">',
        '<option value="official_warning">📢 Anunț oficial</option>',
        '<option value="reward_notification">⬡ Misiune specială cu bonus</option>',
        '<option value="support_resolved">💬 Update sistem</option>',
      '</select>',
      '<button onclick="sendBroadcast()" style="width:100%;padding:14px;background:rgba(10,132,255,0.9);border:none;border-radius:12px;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit;min-height:48px;">TRIMITE LA TOȚI INSIDERII</button>',
    '</div>',
    '<div style="font-size:10px;color:rgba(255,255,255,0.2);line-height:1.8;padding:12px 0;">',
      '⚠️ Broadcast-ul ajunge în Intelligence Inbox al tuturor userilor activi.<br>',
      'Folosește cu grijă — prea multe mesaje = userii ignoră inbox-ul.<br>',
      'Maxim 1-2 broadcast-uri pe săptămână recomandat.',
    '</div>'
  ].join('');
}

async function sendBroadcast() {
  var msg=(document.getElementById('broadcast-msg').value||'').trim();
  var type=document.getElementById('broadcast-type').value||'official_warning';
  if (!msg) { showNotif('Scrie un mesaj înainte să trimiți.',true); return; }
  if (!confirm('Trimiți acest mesaj TUTUROR userilor?\n\n"'+msg+'"')) return;

  try {
    const usersSnap=await db.collection('users').get();
    const batch=db.batch();
    var count=0;
    usersSnap.forEach(function(doc) {
      if (doc.data().banned) return;
      var ref=db.collection('inbox').doc();
      batch.set(ref,{
        to:doc.id, from:'CEO', alias:'VV Team', message:msg, type:type,
        read:false, createdAt:firebase.firestore.FieldValue.serverTimestamp()
      });
      count++;
    });
    await batch.commit();
    document.getElementById('broadcast-msg').value='';
    showNotif('📡 Broadcast trimis la '+count+' Insideri!');
    logCEOAction('BROADCAST',msg.substring(0,50));
  } catch(e) { showNotif('Eroare: '+e.message,true); }
}

// ================================================================
// VV CHARTER EDITOR
// ================================================================
async function loadCharterEditor() {
  const el=document.getElementById('charter-content')||document.getElementById('section-charter');
  if (!el) return;

  el.innerHTML=[
    '<div style="background:rgba(212,175,55,0.06);border:1px solid rgba(212,175,55,0.2);border-radius:16px;padding:20px;margin-bottom:16px;">',
      '<div style="font-size:10px;color:rgba(212,175,55,0.6);letter-spacing:3px;font-weight:700;margin-bottom:6px;">VV CHARTER · LEGEA ECOSISTEMULUI</div>',
      '<div style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.7;margin-bottom:16px;">Documentul pe care VVhi îl respectă. Editabil oricând fără deploy nou.</div>',
      '<button onclick="saveCharterNow()" style="width:100%;padding:13px;background:rgba(212,175,55,0.15);border:1px solid rgba(212,175,55,0.3);border-radius:12px;color:#D4AF37;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;margin-bottom:12px;">⬡ SALVEAZĂ CHARTER ÎN FIREBASE</button>',
    '</div>',
    '<div id="charter-articles" style="display:flex;flex-direction:column;gap:10px;">',
      '<div style="color:rgba(255,255,255,0.3);text-align:center;padding:20px;font-size:13px;">Se încarcă articolele...</div>',
    '</div>'
  ].join('');

  // Incarca articolele din Firebase sau local
  try {
    const doc=await db.collection('config').doc('vvhi_constitution').get();
    var articles=doc.exists?doc.data().articles:null;
    if (!articles && typeof VV_CHARTER !== 'undefined') articles=VV_CHARTER.articles;
    if (!articles) { document.getElementById('charter-articles').innerHTML='<div style="color:#ff3b30;padding:20px;">Charter nu a fost salvat încă. Apasă butonul de salvare.</div>'; return; }

    var html='';
    articles.forEach(function(art,i) {
      html+='<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:16px;">';
      html+='<div style="font-size:10px;color:rgba(212,175,55,0.5);letter-spacing:2px;font-weight:700;margin-bottom:6px;">'+art.id+'</div>';
      html+='<div style="font-size:14px;font-weight:800;color:#fff;margin-bottom:8px;">'+art.title+'</div>';
      html+='<div style="font-size:11px;color:rgba(255,255,255,0.45);line-height:1.8;white-space:pre-line;">'+art.text+'</div>';
      html+='</div>';
    });
    document.getElementById('charter-articles').innerHTML=html;
  } catch(e) { document.getElementById('charter-articles').innerHTML='<div style="color:#ff3b30;padding:20px;">Eroare: '+e.message+'</div>'; }
}

async function saveCharterNow() {
  if (typeof saveCharterToFirebase === 'function') {
    var ok=await saveCharterToFirebase(db);
    showNotif(ok?'✅ VV Charter salvat în Firebase!':'Eroare la salvare Charter.',!ok);
  } else {
    showNotif('Charter JS nu este încărcat.',true);
  }
  logCEOAction('SAVE_CHARTER','v1.0-beta');
}

// ================================================================
// VVHI TENDINTE — ce invata
// ================================================================
async function loadVVhi() {
  const tbody=document.getElementById('vvhi-body');
  const statsEl=document.getElementById('vvhi-stats');
  const trendsEl=document.getElementById('vvhi-trends');
  if (!tbody) return;

  try {
    const snap=await db.collection('vvhi_dataset').orderBy('timestamp','desc').limit(200).get();
    if (snap.empty) { tbody.innerHTML='<tr><td colspan="4" style="text-align:center;color:rgba(255,255,255,0.3);padding:20px">Nicio activitate înregistrată.</td></tr>'; return; }

    var approvals=0,rejections=0,pulses=0,zones={},ore={},tipuriMisiuni={};
    snap.forEach(function(d) {
      var v=d.data();
      if (v.action==='APPROVE_MISSION') approvals++;
      if (v.action==='REJECT_MISSION') rejections++;
      if (v.action==='VV_PULSE_CONNECT') pulses++;
      // Zone
      if (v.context&&v.context.lat) {
        var z=parseFloat(v.context.lat).toFixed(2)+','+parseFloat(v.context.lng||0).toFixed(2);
        zones[z]=(zones[z]||0)+1;
      }
      // Ore
      if (v.timestamp) {
        var ora=v.timestamp.toDate().getHours();
        ore[ora]=(ore[ora]||0)+1;
      }
    });

    // Stats
    if (statsEl) statsEl.innerHTML=[
      '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px;">',
        mkDashStat(approvals,'APROBĂRI','#34c759'),
        mkDashStat(rejections,'RESPINGERI','#ff3b30'),
        mkDashStat(pulses,'PULSE','#0A84FF'),
        mkDashStat(snap.size,'TOTAL EVENTS','rgba(255,255,255,0.6)'),
      '</div>'
    ].join('');

    // Tendinte
    if (trendsEl) {
      var topZone=Object.entries(zones).sort((a,b)=>b[1]-a[1]).slice(0,3);
      var topOre=Object.entries(ore).sort((a,b)=>b[1]-a[1]).slice(0,3);
      var trendsHtml='<div style="background:rgba(10,132,255,0.05);border:1px solid rgba(10,132,255,0.12);border-radius:14px;padding:16px;margin-bottom:12px;">';
      trendsHtml+='<div style="font-size:10px;color:rgba(10,132,255,0.6);letter-spacing:3px;font-weight:700;margin-bottom:12px;">VVhi · CE A ÎNVĂȚAT</div>';
      if (topOre.length>0) {
        trendsHtml+='<div style="font-size:12px;color:rgba(255,255,255,0.5);margin-bottom:8px;">⏰ ORE ACTIVE:</div>';
        topOre.forEach(function(o){ trendsHtml+='<div style="font-size:13px;color:#fff;margin-bottom:4px;">'+o[0]+':00 — <strong>'+o[1]+' evenimente</strong></div>'; });
      }
      if (topZone.length>0) {
        trendsHtml+='<div style="font-size:12px;color:rgba(255,255,255,0.5);margin:12px 0 8px;">📍 ZONE ACTIVE (coord):</div>';
        topZone.forEach(function(z){ trendsHtml+='<div style="font-size:12px;color:rgba(255,255,255,0.7);font-family:monospace;margin-bottom:4px;">'+z[0]+' — '+z[1]+' acțiuni</div>'; });
      }
      trendsHtml+='</div>';
      trendsEl.innerHTML=trendsHtml;
    }

    // Tabel
    var html='';
    snap.docs.slice(0,50).forEach(function(doc) {
      var v=doc.data(); var date=v.timestamp?new Date(v.timestamp.seconds*1000).toLocaleString('ro'):'—';
      var ctx=typeof v.context==='object'?JSON.stringify(v.context):(v.context||'—');
      html+='<tr><td style="font-weight:700;color:'+(v.action.includes('APPROVE')?'#34c759':v.action.includes('REJECT')?'#ff3b30':'#0A84FF')+'">'+(v.action||'—')+'</td><td style="font-size:11px;color:rgba(255,255,255,0.4)">'+ctx.slice(0,50)+'</td><td>'+(v.action.includes('APPROVE')?'✅':v.action.includes('REJECT')?'❌':'⬡')+'</td><td style="white-space:nowrap;font-size:11px">'+date+'</td></tr>';
    });
    tbody.innerHTML=html;
  } catch(e) { tbody.innerHTML='<tr><td colspan="4" style="color:#ff3b30">Eroare: '+e.message+'</td></tr>'; }
}

// ================================================================
// MODERARE AUTOMATA
// ================================================================
var BLOCKED_KEYWORDS=['pornografie','porn','sex explicit','nuditate','nud','droguri','cocaina','heroina','dealer','arma','pistol','bomba','explozibil','atac','secta','cult','manipulare','trafic','frauda','inselaciune','phishing','hack','ura','rasism','fascism'];

function moderateText(text) {
  if (!text) return {allowed:true};
  var lower=text.toLowerCase();
  var blocked=BLOCKED_KEYWORDS.find(function(kw){ return lower.includes(kw); });
  if (blocked) return {allowed:false,keyword:blocked};
  return {allowed:true};
}

// ================================================================
// MISIUNI
// ================================================================
async function loadMissions(status) {
  ['pending','approved','rejected'].forEach(function(s) {
    var t=document.getElementById('tab-'+s);
    if(t) t.classList.toggle('active',s===status);
  });
  const grid=document.getElementById('missions-grid');
  if (!grid) return;
  grid.innerHTML='<div style="color:rgba(255,255,255,0.3);padding:20px">Se încarcă...</div>';
  try {
    const snap=await db.collection('missions').where('status','==',status).orderBy('createdAt','desc').get();
    if (snap.empty) { grid.innerHTML='<div style="color:rgba(255,255,255,0.3);padding:20px">Nicio misiune.</div>'; return; }
    grid.innerHTML='';
    snap.forEach(function(doc){ grid.appendChild(buildMissionCard({id:doc.id,...doc.data()})); });
  } catch(e) { grid.innerHTML='<div style="color:#ff3b30;padding:20px">Eroare: '+e.message+'</div>'; }
}

function buildMissionCard(m) {
  const div=document.createElement('div');
  div.className='photo-card'; div.id='mission-'+m.id;
  const img=m.photoURL||m.imageUrl||'';
  const user=m.userName||m.userId||'Anonim';
  const reward=m.reward||COIN_DEFAULT;
  const date=m.createdAt?new Date(m.createdAt.seconds*1000).toLocaleDateString('ro'):'—';

  // Moderare automata la afisare
  var modResult=moderateText(m.description||m.message||'');
  var flaggedHtml=!modResult.allowed?'<div style="background:rgba(255,59,48,0.1);border:1px solid rgba(255,59,48,0.3);border-radius:6px;padding:6px 10px;font-size:11px;color:#ff3b30;margin-bottom:8px;">🚨 CONȚINUT FLAGGED: "'+modResult.keyword+'"</div>':'';

  div.innerHTML=`
    ${img?`<img class="photo-img" src="${img}" onclick="openLightbox('${img}')">`: '<div style="height:120px;background:#111;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.3);font-size:12px">Fără imagine</div>'}
    <div class="photo-info">
      ${flaggedHtml}
      ${m.status==='rejected'?'<span class="flag-badge">RESPINSĂ</span>':''}
      <div class="photo-msg">${m.description||m.message||'Fără descriere'}</div>
      <div class="photo-meta"><span>👤 ${user}</span><span>📅 ${date}</span></div>
      <div class="photo-meta" style="margin-top:6px"><span>🪙 <b style="color:var(--gold)">${reward} VVC</b></span><span>📍 ${m.location||'—'}</span></div>
      ${m.status==='pending'?`<div class="action-row"><button class="btn-approve" onclick="approveMission('${m.id}','${m.userId}',${reward})">✅ Aprobă</button><button class="btn-reject" onclick="rejectMission('${m.id}')">❌ Respinge</button></div>`:''}
      ${m.status==='approved'?`<div style="color:var(--safe-green);font-size:12px;margin-top:8px;font-weight:700">✅ Aprobată · +${reward} VVC</div>`:''}
    </div>`;
  return div;
}

async function approveMission(missionId, userId, reward) {
  if (!confirm('Aprobi misiunea și distribui '+reward+' VV Coins?')) return;
  try {
    const batch=db.batch();
    batch.update(db.collection('missions').doc(missionId),{status:'approved',validatedAt:firebase.firestore.FieldValue.serverTimestamp(),validatedBy:currentCEO.uid});
    if (userId&&userId!=='undefined') {
      batch.update(db.collection('users').doc(userId),{balance:firebase.firestore.FieldValue.increment(reward),missionsApproved:firebase.firestore.FieldValue.increment(1)});
    }
    await batch.commit();
    // Bon digital automat
    await createBonDigital(userId,'INSIDER',reward,'MISSION_APPROVED:'+missionId);
    logVVhi('APPROVE_MISSION',{missionId,userId,reward});
    logCEOAction('APPROVE_MISSION',missionId);
    document.getElementById('mission-'+missionId)?.remove();
    showNotif('✅ +'+reward+' VVC distribuit!');
    loadBadges();
  } catch(e) { showNotif('Eroare: '+e.message,true); }
}

async function rejectMission(missionId) {
  if (!confirm('Respingi această misiune?')) return;
  try {
    await db.collection('missions').doc(missionId).update({status:'rejected',rejectedAt:firebase.firestore.FieldValue.serverTimestamp()});
    logVVhi('REJECT_MISSION',{missionId});
    logCEOAction('REJECT_MISSION',missionId);
    document.getElementById('mission-'+missionId)?.remove();
    showNotif('Misiune respinsă.');
    loadBadges();
  } catch(e) { showNotif('Eroare: '+e.message,true); }
}

async function deleteAllRejected() {
  if (!confirm('Ștergi toate misiunile respinse?')) return;
  try {
    const snap=await db.collection('missions').where('status','==','rejected').get();
    const batch=db.batch(); snap.forEach(d=>batch.delete(d.ref)); await batch.commit();
    showNotif('🗑 '+snap.size+' misiuni șterse.'); loadMissions('rejected');
  } catch(e) { showNotif('Eroare: '+e.message,true); }
}

// ================================================================
// CONTRACTE, FEEDBACK, TALENT, LEADERBOARD, KEYS, CONFIG, AUDIT
// (pastrate identic din v1)
// ================================================================
async function loadContracts() {
  const list=document.getElementById('contracts-list'); if(!list)return;
  list.innerHTML='<div style="color:rgba(255,255,255,0.3);padding:20px">Se încarcă...</div>';
  try {
    const snap=await db.collection('contracts').orderBy('createdAt','desc').limit(50).get();
    if(snap.empty){list.innerHTML='<div style="color:rgba(255,255,255,0.3);padding:20px">Niciun contract.</div>';return;}
    list.innerHTML='';
    snap.forEach(function(doc){
      const c={id:doc.id,...doc.data()};
      const date=c.createdAt?new Date(c.createdAt.seconds*1000).toLocaleDateString('ro'):'—';
      const div=document.createElement('div');div.className='card';
      div.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap"><div><div style="font-size:14px;font-weight:700;margin-bottom:4px">${c.title||'Contract'}</div><div style="font-size:12px;color:rgba(255,255,255,0.4)">${c.description||'—'}</div><div style="font-size:11px;color:rgba(255,255,255,0.3);margin-top:6px">👤 ${c.userId||'Anonim'} · 📅 ${date} · 🪙 ${c.reward||0} VVC</div></div><div style="display:flex;gap:8px;flex-shrink:0">${c.status==='pending'?`<button class="btn-approve" onclick="activateContract('${c.id}')">Activează</button>`:''}<button class="btn-reject" onclick="deleteContract('${c.id}')">Șterge</button></div></div>`;
      list.appendChild(div);
    });
  } catch(e){list.innerHTML='<div style="color:#ff3b30;padding:20px">Eroare: '+e.message+'</div>';}
}
async function activateContract(id){try{await db.collection('contracts').doc(id).update({status:'active'});showNotif('Contract activat!');loadContracts();}catch(e){showNotif('Eroare: '+e.message,true);}}
async function deleteContract(id){if(!confirm('Ștergi contractul?'))return;try{await db.collection('contracts').doc(id).delete();showNotif('Contract șters.');loadContracts();}catch(e){showNotif('Eroare: '+e.message,true);}}

async function loadFeedback() {
  const list=document.getElementById('feedback-list');if(!list)return;
  list.innerHTML='<div style="color:rgba(255,255,255,0.3);padding:20px">Se încarcă...</div>';
  try {
    const snap=await db.collection('feedback').orderBy('timestamp','desc').limit(50).get();
    if(snap.empty){list.innerHTML='<div style="color:rgba(255,255,255,0.3);padding:20px">Niciun feedback.</div>';return;}
    list.innerHTML='';
    snap.forEach(function(doc){
      const f={id:doc.id,...doc.data()};
      const date=f.timestamp?new Date(f.timestamp.seconds*1000).toLocaleString('ro'):'—';
      const div=document.createElement('div');div.className='card';
      div.innerHTML=`${f.type==='bug_report'?'<span class="flag-badge">BUG REPORT</span>':''}<div style="font-size:13px;color:#fff;margin:8px 0">${f.message||'—'}</div><div style="font-size:11px;color:rgba(255,255,255,0.3)">👤 ${f.alias||f.uid||'Anonim'} · 📅 ${date}</div><div style="display:flex;gap:8px;margin-top:10px"><button class="btn-reply" onclick="replyFeedback('${f.id}','${(f.alias||'user').replace(/'/g,"\\'")}')">💬 Răspunde</button><button class="btn-reject" style="padding:6px 12px" onclick="resolveFeedback('${f.id}')">✓ Rezolvat</button></div>${f.reply?`<div style="background:rgba(10,132,255,0.08);border:1px solid rgba(10,132,255,0.2);border-radius:8px;padding:10px;font-size:12px;color:rgba(255,255,255,0.6);margin-top:8px">💬 ${f.reply}</div>`:''}`;
      list.appendChild(div);
    });
  } catch(e){list.innerHTML='<div style="color:#ff3b30;padding:20px">Eroare: '+e.message+'</div>';}
}
function replyFeedback(id,alias){const r=prompt('Răspuns pentru '+alias+':');if(!r)return;db.collection('feedback').doc(id).update({reply:r,status:'rezolvat',repliedAt:firebase.firestore.FieldValue.serverTimestamp()}).then(()=>{showNotif('Răspuns salvat!');loadFeedback();}).catch(e=>showNotif('Eroare: '+e.message,true));}
async function resolveFeedback(id){try{await db.collection('feedback').doc(id).update({status:'rezolvat'});showNotif('Rezolvat!');loadFeedback();}catch(e){showNotif('Eroare: '+e.message,true);}}
async function deleteAllFeedback(){if(!confirm('Ștergi tot feedback-ul rezolvat?'))return;try{const snap=await db.collection('feedback').where('status','==','rezolvat').get();const batch=db.batch();snap.forEach(d=>batch.delete(d.ref));await batch.commit();showNotif('🗑 Șters.');loadFeedback();}catch(e){showNotif('Eroare: '+e.message,true);}}

async function loadTalentPool(){
  const list=document.getElementById('talent-list');if(!list)return;
  list.innerHTML='<div style="color:rgba(255,255,255,0.3);padding:20px">Se încarcă...</div>';
  try{
    const snap=await db.collection('talent_pool').orderBy('appliedAt','desc').get();
    if(snap.empty){list.innerHTML='<div style="color:rgba(255,255,255,0.3);padding:20px">Niciun aplicant.</div>';return;}
    list.innerHTML='';
    snap.forEach(function(doc){
      const u={id:doc.id,...doc.data()};
      const div=document.createElement('div');div.className='talent-card';
      div.innerHTML=`<div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">${u.name||u.userId||'Anonim'}</div><div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:2px">${u.skills||'—'} · 🪙 ${u.vvCoins||0} VVC</div></div><select class="rank-select" onchange="updateRank('${u.userId||u.id}',this.value)">${RANKS.map(r=>`<option value="${r}" ${u.rank===r?'selected':''}>${r}</option>`).join('')}</select><button class="btn-reject" style="padding:8px 12px;font-size:11px" onclick="removeTalent('${u.id}')">✕</button>`;
      list.appendChild(div);
    });
  }catch(e){list.innerHTML='<div style="color:#ff3b30;padding:20px">Eroare: '+e.message+'</div>';}
}
async function updateRank(userId,rank){try{await db.collection('users').doc(userId).update({rank});showNotif('Rang: '+rank);}catch(e){showNotif('Eroare: '+e.message,true);}}
async function removeTalent(id){if(!confirm('Elimini?'))return;try{await db.collection('talent_pool').doc(id).delete();showNotif('Eliminat.');loadTalentPool();}catch(e){showNotif('Eroare: '+e.message,true);}}

async function loadLeaderboard(){
  const tbody=document.getElementById('leaderboard-body');if(!tbody)return;
  try{
    const snap=await db.collection('users').orderBy('balance','desc').limit(20).get();
    if(snap.empty){tbody.innerHTML='<tr><td colspan="5" style="text-align:center;color:rgba(255,255,255,0.3);padding:20px">Niciun utilizator.</td></tr>';return;}
    let html='',i=1;
    snap.forEach(function(doc){const u=doc.data();html+=`<tr><td class="${i<=3?'rank-gold':''}">${i===1?'🥇':i===2?'🥈':i===3?'🥉':'#'+i}</td><td>${u.alias||doc.id.slice(0,8)}</td><td><span class="badge-onyx">${u.rank||'Neofit'}</span></td><td style="color:var(--gold);font-weight:700">${u.balance||0} VV</td><td>${u.missionsApproved||0}</td></tr>`;i++;});
    tbody.innerHTML=html;
  }catch(e){tbody.innerHTML='<tr><td colspan="5" style="color:#ff3b30">Eroare: '+e.message+'</td></tr>';}
}

async function loadKeys(){
  const list=document.getElementById('keys-list');if(!list)return;
  try{
    const snap=await db.collection('access_keys').orderBy('createdAt','desc').limit(30).get();
    if(snap.empty){list.innerHTML='<div style="color:rgba(255,255,255,0.3);margin-top:12px">Nicio cheie generată.</div>';return;}
    list.innerHTML='';
    snap.forEach(function(doc){
      const k=doc.data();const div=document.createElement('div');div.className='key-item';
      div.innerHTML='<span style="font-family:monospace;font-size:14px;font-weight:700;color:#fff;letter-spacing:1px;">'+(k.key||doc.id)+'</span><span class="key-status" style="font-size:11px;font-weight:700;">'+(k.active===false?'🔴 FOLOSITĂ':'🟢 ACTIVĂ')+'</span>';
      list.appendChild(div);
    });
  }catch(e){}
}

function generateKey(){
  const key='VV-BETA-'+Math.random().toString(36).substr(2,4).toUpperCase()+'-'+Math.random().toString(36).substr(2,4).toUpperCase();
  db.collection('access_keys').add({key,active:true,createdAt:firebase.firestore.FieldValue.serverTimestamp(),used:false}).then(()=>{showNotif('🔑 '+key);logCEOAction('GEN_KEY',key);loadKeys();}).catch(e=>showNotif('Eroare: '+e.message,true));
}

async function loadConfig(){
  try{
    const snap=await db.collection('config').doc('global').get();
    if(snap.exists){const d=snap.data();const ci=document.getElementById('coin-value-input');const mi=document.getElementById('daily-message-input');if(ci&&d.coinValue)ci.value=d.coinValue;if(mi&&d.dailyMessage)mi.value=d.dailyMessage;}
  }catch(e){}
}
function setKillSwitch(isLive){db.collection('config').doc('maintenance').set({isLive},{merge:true}).then(()=>showNotif(isLive?'🟢 Site activ!':'🔴 Mentenanță!')).catch(e=>showNotif('Eroare: '+e.message,true));}
function updateCoinValue(){const val=parseInt(document.getElementById('coin-value-input')?.value)||10;db.collection('config').doc('global').set({coinValue:val},{merge:true}).then(()=>showNotif('🪙 '+val+' VVC/misiune')).catch(e=>showNotif('Eroare: '+e.message,true));}
function updateDailyMessage(){const msg=document.getElementById('daily-message-input')?.value||'';if(!msg)return;db.collection('config').doc('global').set({dailyMessage:msg},{merge:true}).then(()=>showNotif('📢 Mesaj publicat!')).catch(e=>showNotif('Eroare: '+e.message,true));}

function logCEOAction(action,details=''){if(!currentCEO)return;db.collection('audit_log').add({action,details,ceoUid:currentCEO.uid,timestamp:firebase.firestore.FieldValue.serverTimestamp()}).catch(()=>{});}

async function loadAuditLog(){
  const tbody=document.getElementById('audit-log-body');if(!tbody)return;
  try{
    const snap=await db.collection('audit_log').orderBy('timestamp','desc').limit(50).get();
    if(snap.empty){tbody.innerHTML='<tr><td colspan="3" style="text-align:center;color:rgba(255,255,255,0.3);padding:20px">Nicio acțiune.</td></tr>';return;}
    let html='';
    snap.forEach(function(doc){const l=doc.data();const date=l.timestamp?new Date(l.timestamp.seconds*1000).toLocaleString('ro'):'—';html+=`<tr><td style="font-weight:700;color:var(--gold)">${l.action}</td><td style="font-size:11px">${l.details||'—'}</td><td style="white-space:nowrap;font-size:11px">${date}</td></tr>`;});
    tbody.innerHTML=html;
  }catch(e){tbody.innerHTML='<tr><td colspan="3" style="color:#ff3b30">Eroare: '+e.message+'</td></tr>';}
}

// ── HARTA ────────────────────────────────────────────────────
function initCEOMap(){
  if(ceoMapInstance)return;
  if(typeof L==='undefined'){
    const css=document.createElement('link');css.rel='stylesheet';css.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';document.head.appendChild(css);
    const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';s.onload=buildCEOMap;document.head.appendChild(s);
  }else{buildCEOMap();}
}

function buildCEOMap(){
  const el=document.getElementById('ceo-map');if(!el||ceoMapInstance)return;
  ceoMapInstance=L.map('ceo-map',{center:[44.4268,26.1025],zoom:12});
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:19,subdomains:'abcd'}).addTo(ceoMapInstance);
  db.collection('missions').where('status','==','pending').get().then(function(snap){snap.forEach(function(doc){const m=doc.data();if(m.lat&&m.lng)L.circleMarker([m.lat,m.lng],{radius:8,color:'#D4AF37',fillColor:'#D4AF37',fillOpacity:0.8}).addTo(ceoMapInstance).bindPopup(`<b style="color:#D4AF37">${m.userName||'Anonim'}</b><br>${m.description||'—'}`);});}).catch(()=>{});
}

// ── VVHI LOG ─────────────────────────────────────────────────
function logVVhi(action,context){db.collection('vvhi_dataset').add({action,context,ceoUid:currentCEO?.uid||'ceo',timestamp:firebase.firestore.FieldValue.serverTimestamp()}).catch(()=>{});}

// ── LIGHTBOX ─────────────────────────────────────────────────
function openLightbox(src){const lb=document.getElementById('lightbox');const img=document.getElementById('lb-img');if(!lb||!img)return;img.src=src;lb.style.display='flex';}
function closeLightbox(){const lb=document.getElementById('lightbox');if(lb)lb.style.display='none';}

// ── NOTIF ────────────────────────────────────────────────────
function showNotif(msg,isError=false){
  let n=document.getElementById('vv-notif');
  if(!n){n=document.createElement('div');n.id='vv-notif';document.body.appendChild(n);}
  n.textContent=msg;
  n.style.borderColor=isError?'rgba(255,59,48,0.4)':'rgba(52,199,89,0.3)';
  n.classList.add('show');
  clearTimeout(n._t);
  n._t=setTimeout(()=>n.classList.remove('show'),3000);
}

// ── INNER CIRCLE ─────────────────────────────────────────────
var circleTab='pending';

function switchCircleTab(tab){
  circleTab=tab;
  const btnP=document.getElementById('circle-tab-pending');
  const btnA=document.getElementById('circle-tab-active');
  const listP=document.getElementById('circle-pending-list');
  const listA=document.getElementById('circle-active-list');
  if(tab==='pending'){
    if(btnP){btnP.style.background='#fff';btnP.style.color='#000';}
    if(btnA){btnA.style.background='transparent';btnA.style.color='rgba(255,255,255,0.4)';}
    if(listP)listP.style.display='block'; if(listA)listA.style.display='none';
    loadCirclePending();
  }else{
    if(btnA){btnA.style.background='#fff';btnA.style.color='#000';}
    if(btnP){btnP.style.background='transparent';btnP.style.color='rgba(255,255,255,0.4)';}
    if(listP)listP.style.display='none'; if(listA)listA.style.display='block';
    loadCircleActive();
  }
}

function genVVCoreId(){
  const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let p1='',p2='';
  for(let i=0;i<4;i++)p1+=c[Math.floor(Math.random()*c.length)];
  for(let i=0;i<2;i++)p2+=c[Math.floor(Math.random()*c.length)];
  return 'VV\u00B7CORE\u00B7'+p1+'-'+p2;
}

function loadCirclePending(){
  const list=document.getElementById('circle-pending-list');if(!list)return;
  if(_pendingUnsub){_pendingUnsub();_pendingUnsub=null;}
  list.innerHTML='<div style="text-align:center;padding:20px;color:rgba(255,255,255,0.3);font-size:13px">Se încarcă...</div>';
  _pendingUnsub=db.collection('contributors').where('status','==','pending').onSnapshot(function(snap){
    const badge=document.getElementById('badge-circle');
    if(badge){badge.textContent=snap.size;badge.style.display=snap.size>0?'inline-block':'none';}
    const stats=document.getElementById('circle-stats');
    if(stats)stats.textContent=snap.size+' pending';
    if(snap.empty){list.innerHTML='<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.25);font-size:13px">Nicio cerere în așteptare. 🎉</div>';return;}
    list.innerHTML='';
    snap.forEach(function(doc){
      const d=doc.data();const card=document.createElement('div');card.className='circle-card';
      const dateStr=d.submittedAt?d.submittedAt.toDate().toLocaleString('ro-RO'):'—';
      const docId=doc.id;const alias=(d.alias||'INSIDER').replace(/'/g,"\\'");
      card.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px"><div><div style="font-size:15px;font-weight:800;color:#fff;margin-bottom:3px">${d.alias||'INSIDER'}</div><div style="font-size:10px;color:rgba(255,255,255,0.3);font-family:monospace">${docId.substring(0,16)}...</div></div><div style="font-size:10px;color:rgba(212,175,55,0.6);text-align:right"><div style="font-weight:700">⏳ PENDING</div><div style="margin-top:2px;color:rgba(255,255,255,0.25)">${dateStr}</div></div></div><div style="display:flex;gap:8px"><button onclick="deployCircle('${docId}','${alias}',event)" style="flex:1;padding:12px;background:rgba(212,175,55,0.15);border:1px solid rgba(212,175,55,0.35);border-radius:10px;color:#D4AF37;font-weight:800;font-size:12px;cursor:pointer;min-height:44px;font-family:inherit">⬡ VERIFY & DEPLOY</button><button onclick="rejectCircle('${docId}')" style="padding:12px 14px;background:rgba(255,59,48,0.08);border:1px solid rgba(255,59,48,0.2);border-radius:10px;color:#ff3b30;font-weight:700;font-size:12px;cursor:pointer;min-height:44px;font-family:inherit">✕</button></div>`;
      list.appendChild(card);
    });
  },function(err){list.innerHTML='<div style="color:#ff3b30;padding:16px;font-size:12px">Eroare: '+err.message+'</div>';});
}

function loadCircleActive(){
  const list=document.getElementById('circle-active-list');if(!list)return;
  if(_activeUnsub){_activeUnsub();_activeUnsub=null;}
  _activeUnsub=db.collection('contributors').where('status','==','active').onSnapshot(function(snap){
    const stats=document.getElementById('circle-stats');
    if(stats)stats.textContent=snap.size+' activi / 100';
    if(snap.empty){list.innerHTML='<div style="text-align:center;padding:30px;color:rgba(255,255,255,0.25);font-size:13px">Niciun contributor activ.</div>';return;}
    list.innerHTML='';
    snap.forEach(function(doc){
      const d=doc.data();const dateStr=d.activatedAt?d.activatedAt.toDate().toLocaleDateString('ro-RO'):'—';
      const card=document.createElement('div');card.className='circle-active-card';
      card.innerHTML=`<div style="display:flex;align-items:center;gap:10px"><div><div style="font-size:13px;font-weight:700;color:#fff">${d.alias||'INSIDER'}</div><div style="font-size:11px;font-family:monospace;color:#D4AF37;margin-top:2px">${d.vvCoreId||'—'}</div><div style="font-size:10px;color:rgba(255,255,255,0.25);margin-top:1px">Fondator #${d.founderNum||'—'}</div></div></div><div style="text-align:right"><div style="font-size:10px;color:rgba(52,199,89,0.6);font-weight:700">ACTIV</div><div style="font-size:10px;color:rgba(255,255,255,0.25);margin-top:2px">${dateStr}</div></div>`;
      list.appendChild(card);
    });
  },function(err){list.innerHTML='<div style="color:#ff3b30;padding:16px;font-size:12px">Eroare: '+err.message+'</div>';});
}

// ── DEPLOY CIRCLE — FIX COMPLET ──────────────────────────────
async function deployCircle(uid,alias,event){
  if(!confirm('Ai verificat plata de 29 lei de la '+alias+' în Salt Bank?\n\nApasă OK pentru a activa identitatea VV·CORE.'))return;
  const btn=event.currentTarget;
  btn.textContent='SE DEPLOYEAZĂ...';btn.style.opacity='0.6';btn.style.pointerEvents='none';
  try{
    let newCoreId=genVVCoreId();
    const existing=await db.collection('contributors').where('vvCoreId','==',newCoreId).get();
    if(!existing.empty)newCoreId=genVVCoreId();
    const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let vvIdSuffix='';
    for(let i=0;i<6;i++)vvIdSuffix+=chars[Math.floor(Math.random()*chars.length)];
    const vvId='VV\u00B7ID\u00B7'+vvIdSuffix;
    let founderNum=1;
    await db.runTransaction(async function(tx){
      const statsRef=db.collection('stats').doc('founders');
      const statsDoc=await tx.get(statsRef);
      if(statsDoc.exists){founderNum=(statsDoc.data().total||0)+1;tx.update(statsRef,{total:firebase.firestore.FieldValue.increment(1)});}
      else{founderNum=1;tx.set(statsRef,{total:1});}
    });
    const batch=db.batch();
    batch.update(db.collection('contributors').doc(uid),{status:'active',vvCoreId:newCoreId,vvId,founderNum,isFounder:true,rank:'Fondator',alias,activatedAt:firebase.firestore.FieldValue.serverTimestamp(),activatedBy:'CEO'});
    batch.update(db.collection('users').doc(uid),{isFounder:true,founderNum,vvCoreId:newCoreId,vvId,rank:'Fondator',activatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    batch.set(db.collection('inbox').doc(),{to:uid,from:'CEO',alias:'VV Team',type:'circle_activated',message:'\u29C6 Identitatea ta VV\u00B7CORE a fost activat\u0103: '+newCoreId+'. E\u0219ti Fondator #'+founderNum+' din 100. Bine ai venit \u00een nucleul Universului VV.',vvCoreId:newCoreId,vvId,founderNum,read:false,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    await batch.commit();
    logVVhi('CIRCLE_DEPLOY',{uid,alias,vvCoreId:newCoreId,vvId,founderNum});
    logCEOAction('CIRCLE_DEPLOY',alias+' \u2192 '+newCoreId+' #'+founderNum);
    showNotif('\u2705 '+alias+' = Fondator #'+founderNum+' \u00B7 '+newCoreId);
  }catch(e){
    showNotif('Eroare: '+e.message,true);
    btn.textContent='\u29C6 VERIFY & DEPLOY';btn.style.opacity='1';btn.style.pointerEvents='auto';
  }
}

async function rejectCircle(uid){
  if(!confirm('Respingi această cerere? Returnează banii manual din Salt Bank.'))return;
  try{
    await db.collection('contributors').doc(uid).update({status:'rejected',rejectedAt:firebase.firestore.FieldValue.serverTimestamp()});
    await db.collection('inbox').add({to:uid,type:'circle_rejected',message:'Cererea ta pentru VV Inner Circle nu a putut fi verificată. Contactează VV Team.',read:false,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    logCEOAction('CIRCLE_REJECT',uid);
    showNotif('Cerere respinsă.');
  }catch(e){showNotif('Eroare: '+e.message,true);}
}

// ── iOS Safari fix ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',function(){
  var btn=document.querySelector('.login-btn');
  if(btn){
    btn.addEventListener('touchend',function(e){e.preventDefault();var email=document.getElementById('login-email').value;var pass=document.getElementById('login-pass').value;handleLogin(email,pass);});
    btn.addEventListener('click',function(e){var email=document.getElementById('login-email').value;var pass=document.getElementById('login-pass').value;handleLogin(email,pass);});
  }
});
