import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = new Map();

const STATS_FILE = path.join(__dirname, 'data', 'stats.json');
const DEFAULT_STATS = { totalPlayers: 0, totalRounds: 0, totalGames: 0 };

function loadStats(){
  try { return { ...DEFAULT_STATS, ...JSON.parse(fs.readFileSync(STATS_FILE,'utf8')) }; }
  catch { return { ...DEFAULT_STATS }; }
}
let siteStats = loadStats();

function saveStats(){
  try{
    fs.mkdirSync(path.dirname(STATS_FILE),{recursive:true});
    fs.writeFileSync(STATS_FILE,JSON.stringify(siteStats,null,2));
  }catch(err){ console.error('Stats save failed:',err.message); }
}
function statsPayload(){
  return {
    playersOnline: io.engine.clientsCount,
    totalPlayers: siteStats.totalPlayers,
    totalRounds: siteStats.totalRounds,
    totalGames: siteStats.totalGames
  };
}
function broadcastStats(){ io.emit('stats:update',statsPayload()); }
function bumpStat(key){
  siteStats[key]=(siteStats[key]||0)+1;
  saveStats();
  broadcastStats();
}
const CATEGORIES = [
  { key: 'tara', label: 'Țară' },
  { key: 'oras', label: 'Oraș' },
  { key: 'munte', label: 'Munte' },
  { key: 'apa', label: 'Apă' },
  { key: 'planta', label: 'Plantă' },
  { key: 'animal', label: 'Animal' },
  { key: 'nume', label: 'Nume' }
];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => !['Q','W','Y'].includes(l));
const DRAW_DURATION_MS = 1800;
const NEXT_ROUND_DELAY_MS = 15000;

const DICTIONARY_DIR = path.join(__dirname, 'data', 'dictionaries');

function normalizeAnswer(value){
  return String(value || '')
    .trim()
    .toLocaleLowerCase('ro-RO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'')
    .replace(/[’']/g,"'")
    .replace(/[‐‑–—]/g,'-')
    .replace(/\s+/g,' ');
}

function loadDictionary(key){
  try{
    const values=JSON.parse(fs.readFileSync(path.join(DICTIONARY_DIR,`${key}.json`),'utf8'));
    return new Set(values.map(normalizeAnswer).filter(Boolean));
  }catch(err){
    console.error(`Dictionary ${key} failed to load:`,err.message);
    return new Set();
  }
}

const DICTIONARIES = Object.fromEntries(CATEGORIES.map(cat=>[cat.key,loadDictionary(cat.key)]));

function firstLetterMatches(value, letter){
  const clean=normalizeAnswer(value);
  const wanted=normalizeAnswer(letter);
  return Boolean(clean) && clean[0]===wanted[0];
}

function validationStatus(categoryKey, value, letter){
  const clean=normalizeAnswer(value);
  if(!clean) return 'empty';
  if(!firstLetterMatches(value,letter)) return 'invalid';
  return DICTIONARIES[categoryKey]?.has(clean) ? 'valid' : 'unknown';
}

function voteDecision(answer){
  const votes=Object.values(answer.votes || {});
  if(!votes.length) return 'unknown';
  const yes=votes.filter(v=>v==='yes').length;
  const no=votes.filter(v=>v==='no').length;
  if(yes>no) return 'valid';
  if(no>yes) return 'invalid';
  return 'unknown';
}

function applyVotePoints(room, answer){
  if(answer.validationStatus!=='unknown') return;
  const decision=voteDecision(answer);
  const desired=decision==='invalid' ? 0 : answer.basePoints;
  const delta=desired-answer.points;
  if(!delta) return;
  answer.points=desired;
  const player=room.players.get(answer.playerId);
  if(player) player.score+=delta;
}

function shuffledLetters() {
  const pool = [...LETTERS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function drawSequence(finalLetter, count = 18) {
  const sequence = [];
  let previous = null;
  for (let i = 0; i < count - 1; i++) {
    const choices = LETTERS.filter(l => l !== previous && l !== finalLetter);
    const next = choices[crypto.randomInt(choices.length)];
    sequence.push(next);
    previous = next;
  }
  sequence.push(finalLetter);
  return sequence;
}

function code() {
  let c;
  do c = crypto.randomBytes(3).toString('hex').slice(0, 5).toUpperCase(); while (rooms.has(c));
  return c;
}

function publicRooms() {
  return [...rooms.values()]
    .filter(r => r.isPublic && r.status !== 'finished')
    .map(r => ({
      code: r.code,
      name: r.name,
      players: r.players.size,
      maxPlayers: r.maxPlayers,
      rounds: r.rounds,
      duration: r.duration,
      status: r.status,
      currentRound: r.currentRound
    }));
}

function serializeRoom(room) {
  return {
    code: room.code,
    name: room.name,
    isPublic: room.isPublic,
    maxPlayers: room.maxPlayers,
    duration: room.duration,
    rounds: room.rounds,
    currentRound: room.currentRound,
    letter: room.letter,
    status: room.status,
    hostId: room.hostId,
    categories: room.categories,
    players: [...room.players.values()].map(p => ({ id: p.id, nickname: p.nickname, score: p.score, ready: p.ready })),
    deadline: room.deadline || null,
    stoppedBy: room.stoppedBy || null,
    roundResults: room.roundResults || [],
    pendingLetter: room.pendingLetter || null,
    drawStartedAt: room.drawStartedAt || null,
    drawDuration: room.drawDuration || DRAW_DURATION_MS,
    drawSequence: room.drawSequence || [],
    intermissionDeadline: room.intermissionDeadline || null
  };
}

function broadcastRoom(room) {
  io.to(room.code).emit('room:update', serializeRoom(room));
  io.emit('rooms:public', publicRooms());
}

function removePlayerFromRoom(socket) {
  const roomCode = socket.data.roomCode;
  const room = rooms.get(roomCode);
  if (!room) {
    socket.data.roomCode = null;
    return { ok: true, removed: false };
  }

  room.players.delete(socket.id);
  socket.leave(roomCode);
  socket.data.roomCode = null;

  if (!room.players.size) {
    if (room.timer) clearTimeout(room.timer);
    if (room.drawTimer) clearTimeout(room.drawTimer);
    if (room.intermissionTimer) clearTimeout(room.intermissionTimer);
    rooms.delete(roomCode);
    io.emit('rooms:public', publicRooms());
    return { ok: true, removed: true, deleted: true };
  }

  if (room.hostId === socket.id) room.hostId = room.players.keys().next().value;
  broadcastRoom(room);
  return { ok: true, removed: true, deleted: false };
}

function advanceAfterResults(room) {
  if (room.intermissionTimer) clearTimeout(room.intermissionTimer);
  room.intermissionTimer = null;
  room.intermissionDeadline = null;

  if (room.currentRound >= room.rounds) {
    room.status = 'finished';
    broadcastRoom(room);
    return;
  }

  startRound(room);
}

function endRound(room) {
  if (room.timer) clearTimeout(room.timer);
  room.timer = null;
  if (room.status !== 'playing') return;
  room.status = 'results';

  const players = [...room.players.values()];
  const results = room.categories.map(cat => {
    const values = players.map(p => ({
      playerId:p.id,
      nickname:p.nickname,
      value:(p.answers?.[cat.key] || '').trim()
    }));
    const normalized = values.map(v => normalizeAnswer(v.value));

    const scored = values.map((v, idx) => {
      const status=validationStatus(cat.key,v.value,room.letter);
      let basePoints=0;
      if(status==='valid' || status==='unknown'){
        const duplicates=normalized.filter(x=>x && x===normalized[idx]).length;
        basePoints=duplicates>1 ? 5 : 10;
      }
      return {
        ...v,
        validationStatus:status,
        basePoints,
        points:basePoints,
        votes:{}
      };
    });

    scored.forEach(s => {
      const p = room.players.get(s.playerId);
      if (p) p.score += s.points;
    });
    return { category: cat.label, key: cat.key, answers: scored };
  });

  room.roundResults = results;
  bumpStat('totalRounds');
  room.deadline = null;
  room.intermissionDeadline = Date.now() + NEXT_ROUND_DELAY_MS;
  room.intermissionTimer = setTimeout(() => advanceAfterResults(room), NEXT_ROUND_DELAY_MS);
  broadcastRoom(room);
}

function beginPlaying(room) {
  room.drawTimer = null;
  room.letter = room.pendingLetter;
  room.pendingLetter = null;
  room.drawStartedAt = null;
  room.drawSequence = [];
  room.status = 'playing';
  room.deadline = Date.now() + room.duration * 1000;
  room.timer = setTimeout(() => endRound(room), room.duration * 1000);
  broadcastRoom(room);
}

function startRound(room) {
  room.currentRound += 1;
  if (!room.letterPool?.length) room.letterPool = shuffledLetters();

  room.pendingLetter = room.letterPool.shift();
  room.usedLetters.push(room.pendingLetter);
  room.drawSequence = drawSequence(room.pendingLetter);
  room.drawStartedAt = Date.now();
  room.drawDuration = DRAW_DURATION_MS;
  room.letter = null;
  room.status = 'drawing';
  room.stoppedBy = null;
  room.roundResults = [];
  room.deadline = null;
  for (const p of room.players.values()) p.answers = {};

  room.drawTimer = setTimeout(() => beginPlaying(room), DRAW_DURATION_MS);
  broadcastRoom(room);
}

io.on('connection', socket => {
  socket.emit('rooms:public', publicRooms());
  socket.emit('stats:update', statsPayload());
  broadcastStats();

  socket.on('rooms:list', () => socket.emit('rooms:public', publicRooms()));

  socket.on('room:create', (payload, ack = () => {}) => {
    const nickname = String(payload.nickname || '').trim().slice(0, 20);
    if (!nickname) return ack({ ok: false, error: 'Alege un nickname.' });

    const roomCode = code();
    const room = {
      code: roomCode,
      name: String(payload.name || 'Camera mea').trim().slice(0, 40) || 'Camera mea',
      isPublic: Boolean(payload.isPublic),
      maxPlayers: Math.max(2, Math.min(12, Number(payload.maxPlayers) || 8)),
      duration: Math.max(20, Math.min(180, Number(payload.duration) || 60)),
      rounds: Math.max(1, Math.min(10, Number(payload.rounds) || 5)),
      categories: CATEGORIES,
      players: new Map(),
      hostId: socket.id,
      currentRound: 0,
      status: 'lobby',
      letter: null,
      deadline: null,
      timer: null,
      roundResults: [],
      letterPool: shuffledLetters(),
      usedLetters: [],
      pendingLetter: null,
      drawSequence: [],
      drawStartedAt: null,
      drawDuration: DRAW_DURATION_MS,
      drawTimer: null,
      intermissionDeadline: null,
      intermissionTimer: null
    };
    room.players.set(socket.id, { id: socket.id, nickname, score: 0, ready: true, answers: {} });
    rooms.set(roomCode, room);
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    bumpStat('totalPlayers');
    ack({ ok: true, code: roomCode });
    broadcastRoom(room);
  });

  socket.on('room:join', (payload, ack = () => {}) => {
    const roomCode = String(payload.code || '').trim().toUpperCase();
    const nickname = String(payload.nickname || '').trim().slice(0, 20);
    const room = rooms.get(roomCode);
    if (!room) return ack({ ok: false, error: 'Camera nu există.' });
    if (room.status === 'finished') return ack({ ok: false, error: 'Jocul din această cameră s-a terminat.' });
    if (room.players.size >= room.maxPlayers) return ack({ ok: false, error: 'Camera este plină.' });
    if (!nickname) return ack({ ok: false, error: 'Alege un nickname.' });
    if ([...room.players.values()].some(p => p.nickname.toLowerCase() === nickname.toLowerCase())) return ack({ ok: false, error: 'Nickname deja folosit în cameră.' });

    room.players.set(socket.id, { id: socket.id, nickname, score: 0, ready: true, answers: {} });
    socket.join(roomCode);
    socket.data.roomCode = roomCode;
    bumpStat('totalPlayers');
    ack({ ok: true, code: roomCode });
    broadcastRoom(room);
  });

  socket.on('room:leave', (ack = () => {}) => {
    const result = removePlayerFromRoom(socket);
    ack(result);
  });

  socket.on('game:start', (ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || room.hostId !== socket.id) return ack({ ok: false, error: 'Doar host-ul poate porni jocul.' });
    if (room.players.size < 2) return ack({ ok: false, error: 'Ai nevoie de cel puțin 2 jucători.' });
    if (room.status !== 'lobby') return ack({ ok: false, error: 'Jocul este deja pornit.' });
    bumpStat('totalGames');
    startRound(room);
    ack({ ok: true });
  });

  socket.on('game:next', (ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    if (!room || !room.players.has(socket.id)) return ack({ ok: false, error: 'Nu mai ești în această cameră.' });
    if (room.status !== 'results') return ack({ ok: false, error: 'Runda următoare nu poate fi pornită acum.' });
    advanceAfterResults(room);
    ack({ ok: true });
  });

  socket.on('answer:validate', (payload, ack = () => {}) => {
    const room=rooms.get(socket.data.roomCode);
    const player=room?.players.get(socket.id);
    if(!room || !player || room.status!=='playing') return ack({ok:false,status:'empty'});
    const categoryKey=String(payload?.category || '');
    if(!room.categories.some(c=>c.key===categoryKey)) return ack({ok:false,status:'empty'});
    const value=String(payload?.value || '').slice(0,80);
    ack({ok:true,status:validationStatus(categoryKey,value,room.letter)});
  });

  socket.on('game:vote', (payload, ack = () => {}) => {
    const room=rooms.get(socket.data.roomCode);
    if(!room || !room.players.has(socket.id) || room.status!=='results') return ack({ok:false});
    const categoryKey=String(payload?.categoryKey || '');
    const playerId=String(payload?.playerId || '');
    const vote=payload?.vote==='yes' ? 'yes' : payload?.vote==='no' ? 'no' : null;
    if(!vote) return ack({ok:false});
    const category=room.roundResults.find(c=>c.key===categoryKey);
    const answer=category?.answers.find(a=>a.playerId===playerId);
    if(!answer || answer.validationStatus!=='unknown' || answer.playerId===socket.id) return ack({ok:false});
    answer.votes=answer.votes || {};
    answer.votes[socket.id]=vote;
    applyVotePoints(room,answer);
    broadcastRoom(room);
    ack({ok:true});
  });

  socket.on('game:answers', answers => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players.get(socket.id);
    if (!room || !player || room.status !== 'playing') return;
    const clean = {};
    for (const cat of room.categories) clean[cat.key] = String(answers?.[cat.key] || '').slice(0, 80);
    player.answers = clean;
  });

  socket.on('game:stop', (ack = () => {}) => {
    const room = rooms.get(socket.data.roomCode);
    const player = room?.players.get(socket.id);
    if (!room || !player || room.status !== 'playing') return ack({ ok: false });
    room.stoppedBy = player.nickname;
    endRound(room);
    ack({ ok: true });
  });

  socket.on('disconnect', () => {
    removePlayerFromRoom(socket);
    setTimeout(broadcastStats,0);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`ȚOMAPAN running on http://localhost:${PORT}`));
