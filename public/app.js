const socket = io();
let currentRoom = null;
let countdownInterval = null;
let lastAnswers = {};
let drawAnimationFrame = null;
let resultsCountdownInterval = null;

const $ = s => document.querySelector(s);
const homeView = $('#homeView');
const roomView = $('#roomView');

function showRoom(){ homeView.classList.remove('active'); roomView.classList.add('active'); document.body.classList.add('game-active'); }
function showHome(){ homeView.classList.add('active'); roomView.classList.remove('active'); document.body.classList.remove('game-active'); }
function initials(name){ return name.trim().slice(0,2).toUpperCase(); }
function esc(s=''){ return s.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }



// Background procedural retrowave: imagine SVG generată din cod, fără asset extern.
function generateRetroBackground(){
  const host = $('#retroBackground');
  if(!host) return;

  const W = 1920;
  const H = 1080;
  const horizon = 655;
  const rand = (min,max) => min + Math.random()*(max-min);
  const int = (min,max) => Math.floor(rand(min,max+1));
  const pick = arr => arr[Math.floor(Math.random()*arr.length)];

  const grid = [];
  const blocks = [];
  const windows = [];
  const details = [];
  const foreground = [];

  // Outrun grid floor
  const vanishX = W/2 + rand(-90,90);
  for(let i=0;i<=18;i++){
    const x = (W/18)*i;
    grid.push(`<line x1="${x}" y1="${H}" x2="${vanishX}" y2="${horizon}" class="bg-grid-line"/>`);
  }
  let y = horizon + 26;
  let step = 30;
  while(y < H){
    grid.push(`<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" class="bg-grid-line"/>`);
    y += step;
    step *= 1.145;
  }

  function addBlock(x, baseY, w, floors, depth=42){
    const floorH = int(28,36);
    const h = floors * floorH;
    const y = baseY - h;
    const side = Math.min(depth, w*.24);
    blocks.push(`<polygon points="${x},${y} ${x+w},${y} ${x+w+side},${y+side*.65} ${x+w+side},${baseY} ${x},${baseY}" class="bg-block"/>`);
    blocks.push(`<polygon points="${x+w},${y} ${x+w+side},${y+side*.65} ${x+w+side},${baseY} ${x+w},${baseY}" class="bg-block-side"/>`);

    // facade seams
    if(Math.random()>.25){
      const sx = x + w*pick([.28,.5,.72]);
      blocks.push(`<line x1="${sx}" y1="${y+8}" x2="${sx}" y2="${baseY}" class="bg-cold"/>`);
    }

    const cols = int(4,7);
    const cellW = w/(cols+1);
    for(let f=0; f<floors; f++){
      for(let c=1; c<=cols; c++){
        if(Math.random()<.20) continue;
        const wx = x + c*cellW - 8;
        const wy = y + 14 + f*floorH;
        const cls = Math.random()>.25 ? 'bg-window' : 'bg-window-cold';
        if(Math.random()<.22){
          windows.push(`<rect x="${wx-5}" y="${wy-2}" width="28" height="10" rx="1" class="${cls}"/>`);
          windows.push(`<line x1="${wx-7}" y1="${wy+10}" x2="${wx+26}" y2="${wy+10}" class="bg-neon"/>`);
        }else{
          windows.push(`<rect x="${wx}" y="${wy}" width="13" height="10" rx="1" class="${cls}"/>`);
        }
      }
    }

    // antennas
    if(Math.random()>.12){
      const ax = x + w*rand(.18,.82);
      const ah = int(42,95);
      details.push(`<line x1="${ax}" y1="${y}" x2="${ax}" y2="${y-ah}" class="bg-cold"/>`);
      details.push(`<line x1="${ax-28}" y1="${y-ah+24}" x2="${ax+28}" y2="${y-ah+24}" class="bg-cold"/>`);
      details.push(`<line x1="${ax-20}" y1="${y-ah+42}" x2="${ax+20}" y2="${y-ah+42}" class="bg-cold"/>`);
      details.push(`<line x1="${ax-12}" y1="${y-ah+59}" x2="${ax+12}" y2="${y-ah+59}" class="bg-cold"/>`);
    }
  }

  // Background blocks on both sides; center stays open for sunset/grid.
  addBlock(-20, horizon+20, int(320,420), int(7,10), 60);
  addBlock(int(460,560), horizon+5, int(240,340), int(5,8), 45);
  addBlock(int(1220,1320), horizon+5, int(260,360), int(5,8), 45);
  addBlock(int(1580,1680), horizon+15, int(310,420), int(6,10), 60);

  if(Math.random()>.35) addBlock(int(250,340), horizon+28, int(190,260), int(5,7), 36);
  if(Math.random()>.35) addBlock(int(1450,1530), horizon+28, int(190,270), int(5,7), 36);

  // Sun stripes
  const sun = [];
  const cx = W/2 + int(-40,40);
  const cy = 390 + int(-20,24);
  const r = 165;
  for(let i=-r; i<=r; i+=28){
    const yy = cy+i;
    const half = Math.sqrt(Math.max(0,r*r-i*i));
    const stripeH = i < -40 ? 12 : i < 60 ? 16 : 20;
    sun.push(`<rect x="${cx-half}" y="${yy}" width="${half*2}" height="${stripeH}" rx="2" fill="url(#sunGrad)" filter="url(#glowHot)"/>`);
  }

  // cables
  const cableY = int(260,360);
  details.push(`<path d="M 0 ${cableY} C 380 ${cableY+90}, 680 ${cableY+20}, 980 ${cableY+68} S 1540 ${cableY+20}, 1920 ${cableY+86}" class="bg-cold" opacity=".65"/>`);
  details.push(`<path d="M 0 ${cableY+42} C 380 ${cableY+124}, 730 ${cableY+48}, 1050 ${cableY+100} S 1550 ${cableY+60}, 1920 ${cableY+118}" class="bg-neon" opacity=".35"/>`);

  // Garages right
  const gy = horizon+54;
  let gx = 1260;
  for(let i=0;i<5;i++){
    const gw = int(95,132);
    const gh = int(58,76);
    foreground.push(`<rect x="${gx}" y="${gy}" width="${gw}" height="${gh}" rx="2" class="bg-dark-fill"/>`);
    foreground.push(`<line x1="${gx+10}" y1="${gy+18}" x2="${gx+gw-10}" y2="${gy+18}" class="bg-neon"/>`);
    foreground.push(`<line x1="${gx+10}" y1="${gy+34}" x2="${gx+gw-10}" y2="${gy+34}" class="bg-cold"/>`);
    gx += gw + 8;
  }
  foreground.push(`<text x="1550" y="${gy+48}" class="bg-label" font-size="38">GARAJE</text>`);
  foreground.push(`<path d="M 1718 ${gy+39} h78 m-25 -24 l25 24 -25 24" class="bg-neon"/>`);

  // Playground left: slide + bench
  const py = horizon+108;
  foreground.push(`<path d="M 175 ${py} h110 l-50 90 h-42 l36-66 h-54 z" class="bg-dark-fill"/>`);
  foreground.push(`<path d="M 175 ${py} h110 M 229 ${py+24} l-36 66" class="bg-neon"/>`);
  foreground.push(`<rect x="78" y="${py+72}" width="118" height="14" rx="4" class="bg-dark-fill"/>`);
  foreground.push(`<line x1="96" y1="${py+86}" x2="85" y2="${py+118}" class="bg-cold"/>`);
  foreground.push(`<line x1="170" y1="${py+86}" x2="184" y2="${py+118}" class="bg-cold"/>`);
  foreground.push(`<text x="42" y="${horizon+35}" class="bg-label" font-size="34">COPIII DE LA</text>`);
  foreground.push(`<text x="74" y="${horizon+78}" class="bg-label" font-size="42">SCARA B</text>`);

  // Simple boxy old car silhouette
  const carX = 1395, carY = horizon+173;
  foreground.push(`<path d="M ${carX} ${carY} L ${carX+44} ${carY-50} L ${carX+168} ${carY-62} L ${carX+252} ${carY-12} L ${carX+330} ${carY+6} L ${carX+315} ${carY+50} L ${carX+20} ${carY+50} Z" class="bg-dark-fill"/>`);
  foreground.push(`<path d="M ${carX+55} ${carY-43} L ${carX+150} ${carY-51} L ${carX+204} ${carY-17} L ${carX+35} ${carY-10} Z" fill="rgba(0,217,255,.10)" stroke="rgba(0,217,255,.45)"/>`);
  foreground.push(`<circle cx="${carX+82}" cy="${carY+50}" r="31" fill="#070817" stroke="rgba(255,46,166,.72)" stroke-width="3"/>`);
  foreground.push(`<circle cx="${carX+258}" cy="${carY+50}" r="31" fill="#070817" stroke="rgba(255,46,166,.72)" stroke-width="3"/>`);
  foreground.push(`<line x1="${carX+18}" y1="${carY+8}" x2="${carX+318}" y2="${carY+8}" class="bg-neon"/>`);

  host.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="presentation">
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#050718"/>
          <stop offset="42%" stop-color="#21105f"/>
          <stop offset="67%" stop-color="#a01875"/>
          <stop offset="100%" stop-color="#080817"/>
        </linearGradient>
        <linearGradient id="sunGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#ff7a45"/>
          <stop offset="55%" stop-color="#ff2ea6"/>
          <stop offset="100%" stop-color="#b529ff"/>
        </linearGradient>
        <filter id="glowHot" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="glowCold" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id="groundFade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#160a3d" stop-opacity=".72"/>
          <stop offset="100%" stop-color="#070817" stop-opacity=".94"/>
        </linearGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#skyGrad)"/>
      <g>${sun.join('')}</g>
      <rect x="0" y="${horizon}" width="${W}" height="${H-horizon}" fill="url(#groundFade)"/>
      <g opacity=".9">${grid.join('')}</g>
      <g>${blocks.join('')}</g>
      <g>${windows.join('')}</g>
      <g>${details.join('')}</g>
      <g>${foreground.join('')}</g>
      <rect width="${W}" height="${H}" fill="url(#vignette)" opacity="0"/>
    </svg>`;
}

generateRetroBackground();

function setFormFeedback(selector, message=''){
  const el=$(selector);
  if(!el) return;
  el.textContent=message;
  el.classList.toggle('d-none',!message);
}

function showSystemMessage(message, title='Atenție', icon='!'){
  $('#systemModalTitle').textContent=title;
  $('#systemModalMessage').textContent=message || 'A apărut o problemă.';
  $('#systemModalIcon').textContent=icon;
  bootstrap.Modal.getOrCreateInstance($('#systemModal')).show();
}

function resetRoomClientState(){
  clearInterval(countdownInterval);
  clearInterval(resultsCountdownInterval);
  clearTimeout(answerSendTimer);
  if(drawAnimationFrame){ cancelAnimationFrame(drawAnimationFrame); drawAnimationFrame=null; }
  currentRoom=null;
  lastAnswers={};
  const form=$('#answersForm');
  if(form){ form.innerHTML=''; delete form.dataset.round; }
  showHome();
  socket.emit('rooms:list');
}

function requestLeaveRoom(){
  if(!currentRoom){ resetRoomClientState(); return; }
  const active=['drawing','playing'].includes(currentRoom.status);
  $('#leaveConfirmTitle').textContent=active?'Părăsești jocul în desfășurare?':'Ieși din cameră?';
  $('#leaveConfirmMessage').textContent=active
    ? 'Runda va continua pentru ceilalți jucători, iar locul tău din cameră va fi eliberat.'
    : 'Vei părăsi această cameră și vei reveni pe pagina principală.';
  bootstrap.Modal.getOrCreateInstance($('#leaveConfirmModal')).show();
}

function leaveRoom(){
  const confirmModal=bootstrap.Modal.getOrCreateInstance($('#leaveConfirmModal'));
  const btn=$('#confirmLeaveRoom');
  btn.disabled=true;
  btn.textContent='Se iese…';
  socket.emit('room:leave',res=>{
    btn.disabled=false;
    btn.textContent='Da, ieși din cameră';
    confirmModal.hide();
    if(!res?.ok){ showSystemMessage(res?.error||'Nu s-a putut părăsi camera.','Eroare'); return; }
    resetRoomClientState();
  });
}


// Litera demonstrativă de pe homepage: random la fiecare refresh + extragere animată.
const HOME_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => !['Q','W','Y'].includes(l));
const homeLetterEl = $('#homeLetter');
const generateHomeLetterBtn = $('#generateHomeLetter');
let homeLetterAnimation = null;
let lastHomeLetter = null;

function pickHomeLetter(exclude = null) {
  const available = HOME_LETTERS.filter(letter => letter !== exclude);
  return available[Math.floor(Math.random() * available.length)];
}

function setRandomHomeLetter() {
  if (!homeLetterEl) return;
  lastHomeLetter = pickHomeLetter(lastHomeLetter);
  homeLetterEl.textContent = lastHomeLetter;
}

function animateHomeLetter() {
  if (!homeLetterEl || !generateHomeLetterBtn || homeLetterAnimation) return;
  generateHomeLetterBtn.disabled = true;
  generateHomeLetterBtn.innerHTML = '<i class="fa-solid fa-shuffle" aria-hidden="true"></i><span>SE EXTRAGE…</span>';

  const finalLetter = pickHomeLetter(lastHomeLetter);
  let ticks = 0;
  const totalTicks = 18;

  homeLetterAnimation = setInterval(() => {
    homeLetterEl.textContent = pickHomeLetter();
    homeLetterEl.classList.remove('letter-pop');
    void homeLetterEl.offsetWidth;
    homeLetterEl.classList.add('letter-pop');
    ticks += 1;

    if (ticks >= totalTicks) {
      clearInterval(homeLetterAnimation);
      homeLetterAnimation = null;
      lastHomeLetter = finalLetter;
      homeLetterEl.textContent = finalLetter;
      homeLetterEl.classList.remove('letter-pop');
      void homeLetterEl.offsetWidth;
      homeLetterEl.classList.add('letter-pop');
      generateHomeLetterBtn.disabled = false;
      generateHomeLetterBtn.innerHTML = '<i class="fa-solid fa-shuffle" aria-hidden="true"></i><span>GENEREAZĂ LITERĂ</span>';
    }
  }, 85);
}

setRandomHomeLetter();
generateHomeLetterBtn?.addEventListener('click', animateHomeLetter);

function publicRoomStatus(room){
  if(room.status==='lobby') return { label:'În așteptare', cls:'status-waiting' };
  return { label:`În desfășurare · Runda ${Math.max(1,room.currentRound||1)}/${room.rounds}`, cls:'status-playing' };
}

function renderPublicRooms(rooms){
  const wrap = $('#publicRooms');
  window.__publicRooms = rooms || [];

  if(!rooms.length){
    wrap.innerHTML='<div class="empty-state py-4">Nu există camere publice momentan.</div>';
    return;
  }

  wrap.innerHTML = rooms.slice(0,5).map(r=>{
    const status=publicRoomStatus(r);
    const full=r.players>=r.maxPlayers;
    return `<div class="public-room-row">
      <div class="public-room-name">${esc(r.name)}</div>
      <div class="public-room-state">${status.label}</div>
      <div class="public-room-count">${r.players}/${r.maxPlayers}</div>
      <button class="public-room-join join-public" data-code="${r.code}" ${full?'disabled':''}>${full?'PLINĂ':'INTRĂ'}</button>
    </div>`;
  }).join('');

  document.querySelectorAll('.join-public:not(:disabled)').forEach(b=>b.addEventListener('click',()=>{
    $('#joinForm [name=code]').value=b.dataset.code;
    bootstrap.Modal.getOrCreateInstance($('#joinModal')).show();
  }));
}

socket.on('rooms:public', renderPublicRooms);
$('#refreshRooms').addEventListener('click',()=>socket.emit('rooms:list'));

$('#quickPlay')?.addEventListener('click',()=>{
  const rooms=(window.__publicRooms||[]).filter(r=>r.players<r.maxPlayers);
  if(!rooms.length){
    showSystemMessage('Nu există momentan nicio cameră publică disponibilă. Poți crea una în câteva secunde.','Nicio cameră liberă','⌁');
    return;
  }
  const room=rooms[Math.floor(Math.random()*rooms.length)];
  $('#joinForm [name=code]').value=room.code;
  bootstrap.Modal.getOrCreateInstance($('#joinModal')).show();
});

$('#showAllRooms')?.addEventListener('click',()=>{
  const rooms=window.__publicRooms||[];
  const wrap=$('#publicRooms');
  if(!rooms.length) return;
  wrap.innerHTML=rooms.map(r=>{
    const status=publicRoomStatus(r);
    const full=r.players>=r.maxPlayers;
    return `<div class="public-room-row">
      <div class="public-room-name">${esc(r.name)}</div>
      <div class="public-room-state">${status.label}</div>
      <div class="public-room-count">${r.players}/${r.maxPlayers}</div>
      <button class="public-room-join join-public" data-code="${r.code}" ${full?'disabled':''}>${full?'PLINĂ':'INTRĂ'}</button>
    </div>`;
  }).join('');
  document.querySelectorAll('.join-public:not(:disabled)').forEach(b=>b.addEventListener('click',()=>{
    $('#joinForm [name=code]').value=b.dataset.code;
    bootstrap.Modal.getOrCreateInstance($('#joinModal')).show();
  }));
  $('#showAllRooms').classList.add('d-none');
});


// Generator nostalgic pentru numele camerelor: combină independent "cine" + "de unde".
const ROOM_NAME_WHO = [
  'Copiii', 'Gașca', 'Puștii', 'Vecinii', 'Echipa', 'Băieții', 'Fetele',
  'Copiii de afară', 'Gașca de la bloc', 'Prietenii', 'Ăștia mici'
];

const ROOM_NAME_WHERE = [
  'de la Scara A', 'de la Scara B', 'de la Scara C',
  'din V41', 'din M12', 'din B7', 'din D3',
  'de la Blocul 7', 'de la Blocul 10', 'de la Blocul 23',
  'din fața blocului', 'din spatele blocului', 'de la garaje',
  'din spatele școlii', 'de pe alee', 'de la teren',
  'din cartier', 'de lângă parc', 'de la ultima scară'
];

let lastGeneratedRoomName = '';

function generateRoomName(){
  let name = '';
  let tries = 0;
  do {
    const who = ROOM_NAME_WHO[Math.floor(Math.random() * ROOM_NAME_WHO.length)];
    const where = ROOM_NAME_WHERE[Math.floor(Math.random() * ROOM_NAME_WHERE.length)];
    name = `${who} ${where}`;
    tries += 1;
  } while(name === lastGeneratedRoomName && tries < 10);
  lastGeneratedRoomName = name;
  return name;
}

function randomizeRoomName(){
  const input = $('#roomNameInput');
  if(!input) return;
  input.value = generateRoomName();
  input.classList.remove('room-name-pop');
  void input.offsetWidth;
  input.classList.add('room-name-pop');
}

randomizeRoomName();
$('#randomizeRoomName')?.addEventListener('click', randomizeRoomName);
$('#createModal')?.addEventListener('show.bs.modal', randomizeRoomName);

$('#createForm').addEventListener('submit',e=>{
  e.preventDefault(); setFormFeedback('#createError');
  if(!e.currentTarget.checkValidity()){ setFormFeedback('#createError','Completează câmpurile obligatorii înainte să continui.'); return; }
  const fd=new FormData(e.currentTarget);
  socket.emit('room:create',{nickname:fd.get('nickname'),name:fd.get('name'),rounds:fd.get('rounds'),duration:fd.get('duration'),maxPlayers:fd.get('maxPlayers'),isPublic:fd.get('isPublic')==='on'},res=>{
    if(!res.ok){ setFormFeedback('#createError',res.error); return; }
    bootstrap.Modal.getOrCreateInstance($('#createModal')).hide(); showRoom();
  });
});

$('#joinForm').addEventListener('submit',e=>{
  e.preventDefault(); setFormFeedback('#joinError');
  if(!e.currentTarget.checkValidity()){ setFormFeedback('#joinError','Completează nickname-ul și codul invitației.'); return; }
  const fd=new FormData(e.currentTarget);
  socket.emit('room:join',{nickname:fd.get('nickname'),code:fd.get('code')},res=>{
    if(!res.ok){ setFormFeedback('#joinError',res.error); return; }
    bootstrap.Modal.getOrCreateInstance($('#joinModal')).hide(); showRoom();
  });
});

socket.on('room:update', room=>{ currentRoom=room; showRoom(); renderRoom(room); });

function renderRoom(room){
  $('#roomName').textContent=room.name; $('#roomCode').textContent=room.code;
  $('#playerCount').textContent=`${room.players.length}/${room.maxPlayers}`;
  $('#playersList').innerHTML=room.players.map(p=>`<div class="player-card"><div class="avatar">${esc(initials(p.nickname))}</div><div class="min-w-0"><div class="fw-semibold text-truncate">${esc(p.nickname)} ${p.id===room.hostId?'<span class="badge text-bg-secondary">host</span>':''}</div><div class="small text-secondary">${p.score} puncte</div></div></div>`).join('');
  $('#roomSettings').innerHTML=`<div><span class="text-secondary">Runde</span><strong>${room.rounds}</strong></div><div><span class="text-secondary">Durată</span><strong>${room.duration}s</strong></div><div><span class="text-secondary">Tip cameră</span><strong>${room.isPublic?'Publică':'Privată'}</strong></div><div><span class="text-secondary">Categorii</span><strong>${room.categories.length}</strong></div>`;
  const amHost = socket.id===room.hostId;
  $('#startGame').classList.toggle('d-none',!amHost);
  $('#waitingHost').classList.toggle('d-none',amHost);

  $('#lobbyPanel').classList.toggle('d-none',room.status!=='lobby');
  $('#drawingPanel').classList.toggle('d-none',room.status!=='drawing');
  $('#gamePanel').classList.toggle('d-none',room.status!=='playing');
  $('#resultsPanel').classList.toggle('d-none',room.status!=='results');
  $('#finishedPanel').classList.toggle('d-none',room.status!=='finished');

  if(room.status==='drawing') renderDrawing(room);
  if(room.status==='playing') renderGame(room);
  if(room.status==='results') renderResults(room,amHost);
  if(room.status==='finished') renderFinished(room);
}

$('#startGame').addEventListener('click',()=>socket.emit('game:start',res=>{ if(!res?.ok) showSystemMessage(res.error||'Nu s-a putut porni jocul.','Jocul nu poate porni'); }));
function renderDrawing(room){
  clearInterval(countdownInterval);
  if(drawAnimationFrame) cancelAnimationFrame(drawAnimationFrame);
  $('#drawRoundNo').textContent=`${room.currentRound}/${room.rounds}`;

  const sequence=room.drawSequence?.length?room.drawSequence:[room.pendingLetter || '?'];
  const started=Number(room.drawStartedAt)||Date.now();
  const duration=Math.max(300,Number(room.drawDuration)||1800);
  const slot=duration/sequence.length;
  const el=$('#drawLetter');
  let previousIndex=-1;

  const animate=()=>{
    const elapsed=Math.max(0,Date.now()-started);
    const index=Math.min(sequence.length-1,Math.floor(elapsed/slot));
    if(index!==previousIndex){
      el.textContent=sequence[index] || room.pendingLetter || '?';
      el.classList.remove('draw-pop');
      void el.offsetWidth;
      el.classList.add('draw-pop');
      previousIndex=index;
    }
    if(elapsed<duration && currentRoom?.status==='drawing') drawAnimationFrame=requestAnimationFrame(animate);
    else {
      el.textContent=room.pendingLetter || sequence[sequence.length-1] || '?';
      drawAnimationFrame=null;
    }
  };
  animate();
}


function renderGame(room){
  if(drawAnimationFrame){ cancelAnimationFrame(drawAnimationFrame); drawAnimationFrame=null; }
  $('#roundNo').textContent=`${room.currentRound}/${room.rounds}`; $('#gameLetter').textContent=room.letter;
  $('#stopInfo').textContent=room.stoppedBy?`STOP apăsat de ${room.stoppedBy}`:'Completează cât mai repede.';
  const form=$('#answersForm');
  if(form.dataset.round!=String(room.currentRound)){
    form.dataset.round=room.currentRound;
    lastAnswers={};
    form.innerHTML=room.categories.map(c=>`<div class="col-md-6 col-lg-4"><div class="answer-card"><label class="form-label">${esc(c.label)}</label><input class="form-control answer-input" data-key="${c.key}" autocomplete="off" placeholder="${room.letter}..."></div></div>`).join('');
    document.querySelectorAll('.answer-input').forEach(inp=>inp.addEventListener('input',sendAnswers));
    document.querySelector('.answer-input')?.focus();
  }
  startCountdown(room.deadline);
}

let answerSendTimer;
function sendAnswers(){
  clearTimeout(answerSendTimer);
  answerSendTimer=setTimeout(()=>{
    document.querySelectorAll('.answer-input').forEach(i=>lastAnswers[i.dataset.key]=i.value);
    socket.emit('game:answers',lastAnswers);
  },100);
}

$('#stopButton').addEventListener('click',()=>{ sendAnswers(); setTimeout(()=>socket.emit('game:stop'),130); });

function startCountdown(deadline){
  clearInterval(countdownInterval);
  const tick=()=>{
    const ms=Math.max(0,deadline-Date.now()); const total=Math.ceil(ms/1000); const m=Math.floor(total/60); const s=total%60;
    $('#timer').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    if(ms<=0) clearInterval(countdownInterval);
  }; tick(); countdownInterval=setInterval(tick,250);
}

function renderResults(room){
  if(drawAnimationFrame){ cancelAnimationFrame(drawAnimationFrame); drawAnimationFrame=null; }
  clearInterval(countdownInterval);
  clearInterval(resultsCountdownInterval);
  $('#resultsRound').textContent=room.currentRound;
  $('#roundResults').innerHTML=room.roundResults.map(cat=>`<div class="result-category"><div class="fw-bold">${esc(cat.category)}</div><div class="result-grid">${cat.answers.map(a=>`<div class="result-answer"><div class="small text-secondary">${esc(a.nickname)}</div><div class="d-flex justify-content-between gap-2"><span class="text-truncate">${esc(a.value||'—')}</span><span class="points">+${a.points}</span></div></div>`).join('')}</div></div>`).join('');
  renderScoreboard($('#scoreboard'),room.players);

  const btn=$('#nextRound');
  btn.disabled=false;
  btn.textContent=room.currentRound>=room.rounds?'Vezi clasamentul final':'Următoarea rundă';

  const timerEl=$('#nextRoundTimer');
  const deadline=Number(room.intermissionDeadline)||Date.now();
  const tick=()=>{
    const seconds=Math.max(0,Math.ceil((deadline-Date.now())/1000));
    timerEl.textContent=String(seconds);
    if(seconds<=0) clearInterval(resultsCountdownInterval);
  };
  tick();
  resultsCountdownInterval=setInterval(tick,250);
}

$('#nextRound').addEventListener('click',()=>{
  const btn=$('#nextRound');
  btn.disabled=true;
  socket.emit('game:next',res=>{
    if(!res?.ok){ btn.disabled=false; showSystemMessage(res.error||'Nu s-a putut continua jocul.','Nu se poate continua'); }
  });
});
function renderScoreboard(el,players){
  const sorted=[...players].sort((a,b)=>b.score-a.score);
  el.innerHTML=sorted.map((p,i)=>`<div class="score-row"><div class="d-flex align-items-center gap-2"><span class="rank">#${i+1}</span><strong>${esc(p.nickname)}</strong></div><span>${p.score} pct</span></div>`).join('');
}
function renderFinished(room){ clearInterval(countdownInterval); clearInterval(resultsCountdownInterval); renderScoreboard($('#finalScoreboard'),room.players); }

$('#leaveRoom')?.addEventListener('click',requestLeaveRoom);
$('#leaveRoomFinished')?.addEventListener('click',requestLeaveRoom);
$('#confirmLeaveRoom')?.addEventListener('click',leaveRoom);
