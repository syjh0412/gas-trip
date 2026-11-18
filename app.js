(function () {
  'use strict';
  var T = window.TRIP, CFG = window.TRIP_CONFIG || {};
  var KEY = 'gastrip.v1';
  var app = document.getElementById('app');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var DEST = {}; T.dests.forEach(function (d) { DEST[d.id] = d; });

  /* ---------- 상태 ---------- */
  var S = { profile: null, miles: 0, mi: {}, combo: 0, flags: {}, wear: {}, look: {}, badges: {}, pos: {}, seen: {}, done: {}, stamps: {}, ans: {}, data: {}, lines: {}, lab: {}, chain: {}, booths: [], exam: null, gen: {}, deb: {}, refl: {}, bigtxt: '' };
  try { var raw = localStorage.getItem(KEY); if (raw) { var o = JSON.parse(raw); for (var k in o) S[k] = o[k]; } } catch (e) { }
  var stTimer = null;
  function save() {
    if (isG()) return;
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { }
    if (CFG.API_URL && S.profile && !isT()) { clearTimeout(stTimer); stTimer = setTimeout(function () { post({ key: 'state', val: S }); }, 5000); }
  }
  function post(o) {
    o.cls = S.profile.cls; o.num = S.profile.num; o.name = S.profile.name;
    return fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(o) }).then(function (r) { return r.json(); });
  }

  /* ---------- 서버 연동 (선택) ---------- */
  var timers = {};
  function sync(key, val) {
    if (!CFG.API_URL || !S.profile || isT()) return;
    clearTimeout(timers[key]);
    timers[key] = setTimeout(function () {
      var body = JSON.stringify({ cls: S.profile.cls, num: S.profile.num, name: S.profile.name, key: key, val: val });
      fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body }).catch(function () { });
    }, 800);
  }
  function apiGet(params) {
    var qs = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    return fetch(CFG.API_URL + '?' + qs).then(function (r) { return r.json(); });
  }
  function syncProgress() { sync('progress', { stamps: S.stamps, done: S.done, booths: S.booths, exam: S.exam, miles: S.miles, rank: rank().name, badges: Object.keys(S.badges).length }); }

  /* ---------- 도장 ---------- */
  function stampCount() { var n = 0; for (var s in S.stamps) for (var k in S.stamps[s]) n++; return n; }
  function isG() { return !!sessionStorage.getItem('gastrip.guest'); }
  function isT() { return !!sessionStorage.getItem('gastrip.tpin') || isG(); }
  function rankIdx() { var n = stampCount(), ix = 0; for (var j = 1; j < T.ranks.length; j++) { if (S.miles >= T.ranks[j].min && n >= (T.ranks[j].st || 0)) ix = j; else break; } return ix; }
  function rank() { return T.ranks[rankIdx()]; }
  /* ---------- 마일 · 배지 ---------- */
  function mile(key, n) {
    if (isT() || !n) return; var had = S.mi[key] || 0; if (n <= had) return;
    var before = rankIdx(); S.mi[key] = n; S.miles += n - had; save(); chip('+' + (n - had) + ' 마일');
    var after = rankIdx(); if (after > before) setTimeout(function () { celebrate(before, after); }, celDelay);
    badges(); var m = $('#mcount'); if (m) m.textContent = S.miles;
  }
  var celDelay = 700;
  function celebrate(before, after) {
    var old = $('.celeb'); if (old) { before = Math.min(before, +old.dataset.from); old.remove(); }
    var r = T.ranks[after], next = T.ranks[after + 1], it = T.items.filter(function (x) { return x.at > before && x.at <= after; }), cols = ['#FFD43B', '#FF7A59', '#4CC777', '#2F9BFF', '#B46BFF', '#fff'], conf = '';
    for (var j = 0; j < 36; j++) conf += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;background:' + cols[j % 6] + ';animation-delay:' + (Math.random() * 1.6).toFixed(2) + 's;animation-duration:' + (2.4 + Math.random() * 2).toFixed(2) + 's"></i>';
    var save0 = S.wear; S.wear = {}; it.forEach(function (x) { S.wear[x.id] = true; }); var face = mascot(150); S.wear = save0;
    var el = document.createElement('div'); el.className = 'celeb'; el.dataset.from = before; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', '승급 축하');
    el.innerHTML = '<div class="conf" aria-hidden="true">' + conf + '</div><div class="celbox"><p class="lvup">LEVEL UP!</p><div class="celface">' + face + '</div><p class="celfrom">Lv.' + (before + 1) + ' ' + T.ranks[before].name + ' →</p><h2>Lv.' + (after + 1) + ' ' + r.name + '</h2><p class="celmsg">축하해요, <b>' + esc(S.profile.name) + '</b> 가이드님! ' + S.miles + ' 마일을 모아 승급했어요.</p>' +
      (it.length ? '<div class="celnew"><b>🎁 새로 열린 꾸미기</b>' + it.map(function (x) { return '<span>' + x.name + '</span>'; }).join('') + '</div>' : '') + (after === 7 && CFG.COUPONS !== false ? '<div class="celnew"><b>🎟️ 수석 가이드 쿠폰</b><span>선생님께 보여 주세요</span></div>' : '') +
      '<p class="celnext">' + (next ? '다음 목표: <b>Lv.' + (after + 2) + ' ' + next.name + '</b> (' + next.min + ' 마일' + (next.st ? ', 도장 ' + next.st + '개' : '') + ')' : '가장 높은 등급에 올랐어요!') + '</p><div class="btns ctr"><button class="btn yel big" data-act="celebok">계속 여행하기</button><a class="btn" href="#home/rank" data-act="celebok">등급 안내 보기</a></div></div>';
    document.body.appendChild(el); var ok = el.querySelector('button'); if (ok) ok.focus();
  }
  function chip(txt) { var c = document.createElement('div'); c.className = 'chip'; c.textContent = txt; document.body.appendChild(c); setTimeout(function () { c.remove(); }, 1500); }
  function predictHits() { var n = 0; T.dests.forEach(function (d) { d.steps.forEach(function (st, si) { if (st.type === 'predict') st.items.forEach(function (it, j) { var a = S.ans[d.id + '.' + si + '.' + j]; if (a && a.first === it.a) n++; }); }); }); return n; }
  function kindCount(k) { var n = 0; for (var s in S.stamps) if (S.stamps[s][k]) n++; return n; }
  var BADGES = [
    { id: 'start', ic: '👣', n: '첫 발자국', d: '첫 마일을 모았어요', t: function () { return S.miles > 0; } },
    { id: 'pred', ic: '🔮', n: '예측왕', d: '예측을 5번 맞혔어요', t: function () { return predictHits() >= 5; } },
    { id: 'c3', ic: '🔥', n: '3연속 정답', d: '문제를 3번 연속 한 번에 맞혔어요', t: function () { return S.flags.c3; } },
    { id: 'c5', ic: '⚡', n: '5연속 정답', d: '문제를 5번 연속 한 번에 맞혔어요', t: function () { return S.flags.c5; } },
    { id: 'blank', ic: '🗝️', n: '빈칸 탐험가', d: '안내 카드 12장의 빈칸을 모두 열었어요', t: function () { return Object.keys(S.seen).length >= 12; } },
    { id: 'sharp', ic: '🎯', n: '한 번에 콕', d: '내 측정값으로 그래프의 점을 한 번도 틀리지 않고 찍었어요', t: function () { return S.flags.sharp; } },
    { id: 'see', ic: '👀', n: '눈썰미', d: '‘본 것’ 도장 3개', t: function () { return kindCount('see') >= 3; } },
    { id: 'meas', ic: '📏', n: '측정 장인', d: '‘잰 것’ 도장 3개', t: function () { return kindCount('meas') >= 3; } },
    { id: 'part', ic: '⚛️', n: '입자 박사', d: '‘입자’ 도장 3개', t: function () { return kindCount('part') >= 3; } },
    { id: 'line', ic: '🗣️', n: '친절한 안내', d: '여행 안내 한 줄을 5번 썼어요', t: function () { return Object.keys(S.lines).filter(function (k) { return S.lines[k].length >= 15; }).length >= 5; } },
    { id: 'booth', ic: '🎪', n: '부스 마니아', d: '부스 6곳을 체험했어요', t: function () { return S.booths.length >= 6; } },
    { id: 'pass', ic: '🎓', n: '자격 취득', d: '자격시험 14문항 이상', t: function () { return S.exam && S.exam.best >= 14; } },
    { id: 'retry', ic: '💪', n: '다시 도전', d: '틀린 문제를 다시 풀었어요', t: function () { return S.flags.retry; } },
    { id: 'full', ic: '💯', n: '만점 가이드', d: '자격시험 만점', t: function () { return S.exam && S.exam.best >= S.exam.total; } }
  ].concat(T.dests.map(function (d) { return { id: 'd' + d.id, ic: d.icon, n: d.place, d: d.place + ' 여행을 마쳤어요', t: function () { return destProgress(d) >= d.steps.length; }, trip: 1 }; }));
  function badges() {
    if (isT()) return;
    BADGES.forEach(function (b) { if (!S.badges[b.id] && b.t()) { S.badges[b.id] = Date.now(); save(); setTimeout(function () { toast('<div class="rkup">' + b.ic + '</div><p><b>' + (b.trip ? '여행 스티커' : '배지') + ' 획득!</b> ' + b.n + '</p>'); }, b.trip ? 2200 : 1700); } });
  }
  function couponOK(id) { if (id === 'c1') return ['01', '02', '03'].some(function (s) { return S.stamps[s] && Object.keys(S.stamps[s]).length >= 3; }); if (id === 'c2') return !!(S.exam && S.exam.best >= 14); return rankIdx() >= 7; }
  function award(std, kind) {
    S.stamps[std] = S.stamps[std] || {};
    if (S.stamps[std][kind]) return;
    var b0 = rankIdx();
    S.stamps[std][kind] = Date.now(); save(); celDelay = 3300; mile('st.' + std + kind, 10); celDelay = 700;
    if (!isT() && rankIdx() > b0) setTimeout(function () { if (!$('.celeb')) celebrate(b0, rankIdx()); }, 3350);
    var k = T.kinds[kind];
    toast('<div class="stamp big" style="--c:' + k.color + '"><b>' + k.name + '</b><small>' + T.stds[std].short + '</small></div><p>여권에 <b>‘' + k.name + '’ 도장</b>이 찍혔어요!</p>');
  }
  function toast(html) {
    document.querySelectorAll('.toast').forEach(function (x) { x.remove(); });
    var t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.innerHTML = html;
    document.body.appendChild(t); setTimeout(function () { t.classList.add('out'); }, 2600); setTimeout(function () { t.remove(); }, 3200);
  }
  function stampHTML(std, kind, small) {
    var k = T.kinds[kind], got = S.stamps[std] && S.stamps[std][kind];
    return '<div class="stamp' + (got ? '' : ' empty') + (small ? ' sm' : '') + '" style="--c:' + k.color + '"><b>' + k.name + '</b>' + (small ? '' : '<small>' + (got ? '확인' : k.desc) + '</small>') + '</div>';
  }

  /* ---------- 객관식 ---------- */
  var MCQ = {};
  function mcq(key, item, mode, no) {
    MCQ[key] = { item: item, mode: mode, no: no };
    var st = S.ans[key], lock = st && (mode !== 'retry' || st.c === item.a);
    var h = '<div class="mcq" id="q-' + key + '"><p class="q">' + (no ? '<span class="qn">' + no + '</span>' : '') + esc(item.q).replace(/\n/g, '<br>') + '</p><div class="opts' + (item.opts[0].fig ? ' figs' : '') + '">';
    item.opts.forEach(function (o, i) {
      var cls = 'opt';
      if (st && st.c === i) cls += i === item.a ? ' ok' : ' no';
      if (lock && i === item.a && mode !== 'retry') cls += ' ok';
      h += '<button class="' + cls + '" data-act="mcq" data-key="' + key + '" data-i="' + i + '"' + (lock ? ' disabled' : '') + '>' + (o.fig ? figSVG(o.fig, item.fx, item.fy) : '<span class="on">' + '①②③④⑤'[i] + '</span>' + esc(o)) + '</button>';
    });
    h += '</div>';
    if (st) {
      if (mode === 'retry' && st.c !== item.a) h += '<p class="fb no">다시 생각해 보세요. 무엇이 같고 무엇이 달랐는지 떠올려요.</p>';
      else h += '<p class="fb ' + (st.c === item.a ? 'ok' : 'no') + '"><b>' + (mode === 'free' ? (st.c === item.a ? '예측이 맞았어요. ' : '예측과 달랐네요. ') : (st.c === item.a ? '맞았어요. ' : '아쉬워요. ')) + '</b>' + esc(item.ex) + '</p>';
    }
    return h + '</div>';
  }
  function figSVG(kind, fx, fy) {
    var p = { inv: 'M22 12 C26 52 46 70 104 76', up: 'M20 80 L104 14', upi: 'M20 58 L104 14', flat: 'M20 44 L104 44', down: 'M20 14 L104 76' }[kind];
    return '<svg viewBox="0 0 120 104" class="fig" role="img" aria-label="그래프 보기"><path d="M18 6V82H112" fill="none" stroke="#1B1F3B" stroke-width="2.5"/><path d="' + p + '" fill="none" stroke="#2F4BD8" stroke-width="4" stroke-linecap="round"/><text x="65" y="99" text-anchor="middle" font-size="11">' + esc(fx) + '</text><text x="9" y="46" text-anchor="middle" font-size="11" transform="rotate(-90 9 46)">' + esc(fy) + '</text><text x="12" y="92" font-size="10">0</text></svg>';
  }
  function allRight(prefix, items) { return items.every(function (it, i) { var a = S.ans[prefix + i]; return a && a.c === it.a; }); }
  function allAnswered(prefix, items) { return items.every(function (it, i) { return S.ans[prefix + i]; }); }

  /* ---------- 라우팅 ---------- */
  var cur = { dest: null, step: 0 }, sim = null;
  function route() {
    if (sim) { sim.stop(); sim = null; }
    if (SENS.dev && !/^#d\/T3\//.test(location.hash)) sDisconnect();
    MCQ = {};
    var h = location.hash.replace(/^#/, '').split('/');
    if (!S.profile && isT()) { S.profile = { cls: '0', num: '0', name: isG() ? '참관 선생님' : '선생님' }; save(); }
    if ((!S.profile || !sessionStorage.getItem('gastrip.in')) && !isT() && h[0] !== 'teacher') return viewRegister(S.profile);
    if (h[0] === 'd' && DEST[h[1]]) return viewDest(DEST[h[1]], h[2] == null ? -1 : Math.max(0, parseInt(h[2], 10) || 0));
    cur = { dest: null };
    if (h[0] === 'teacher') return viewTeacher();
    viewHome(h[1]);
  }
  window.addEventListener('hashchange', function () { route(); window.scrollTo(0, 0); });

  /* ---------- 등록 ---------- */
  var SCENE = '<svg class="skyscene" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' +
    '<circle cx="1040" cy="130" r="74" fill="#FFD43B"/><circle cx="1040" cy="130" r="104" fill="#FFD43B" opacity=".25"/>' +
    '<g fill="#fff"><g class="cl1"><ellipse cx="190" cy="150" rx="90" ry="34"/><ellipse cx="250" cy="126" rx="58" ry="36"/><ellipse cx="140" cy="132" rx="46" ry="28"/></g><g class="cl2"><ellipse cx="860" cy="300" rx="80" ry="28"/><ellipse cx="910" cy="280" rx="50" ry="30"/></g><g class="cl1"><ellipse cx="480" cy="90" rx="60" ry="22"/><ellipse cx="520" cy="76" rx="38" ry="22"/></g></g>' +
    '<path d="M-20 430 Q 300 250 620 330 T 1230 210" fill="none" stroke="#fff" stroke-width="5" stroke-dasharray="4 18" stroke-linecap="round"/>' +
    '<g class="plane" transform="translate(905 262) rotate(-17)"><path d="M0 0l64-10 26-34h14l-10 34 34-4q14 4 0 12l-34 0 12 34h-14l-28-30-62-2z" fill="#fff" stroke="#1B1F3B" stroke-width="5" stroke-linejoin="round"/></g>' +
    '<g class="balloon" transform="translate(150 380)"><path d="M0-90c50 0 78 36 78 74 0 40-40 70-60 96h-36c-20-26-60-56-60-96 0-38 28-74 78-74z" fill="#FF7A59" stroke="#1B1F3B" stroke-width="5"/><path d="M0-90c-20 30-20 130-10 170M0-90c20 30 20 130 10 170" fill="none" stroke="#1B1F3B" stroke-width="4"/><path d="M-18 80v22M18 80v22" stroke="#1B1F3B" stroke-width="4"/><rect x="-22" y="100" width="44" height="30" rx="6" fill="#C98A3C" stroke="#1B1F3B" stroke-width="5"/></g>' +
    '<path d="M0 800V650q200-110 420-30t420-40 360 20v200z" fill="#7BD88F"/><path d="M0 800V710q260-90 560-20t640-50v160z" fill="#4CC777"/>' +
    '<g transform="translate(980 640)"><rect x="-6" y="-70" width="12" height="80" fill="#1B1F3B"/><path d="M6-70h70l-16 16 16 16H6z" fill="#FFD43B" stroke="#1B1F3B" stroke-width="5" stroke-linejoin="round"/></g></svg>';
  var ROSTER = null, ROSTER_TRIED = false;
  function maskName(n) { n = String(n || ''); return n.length <= 1 ? n : n.length === 2 ? n[0] + '*' : n[0] + new Array(n.length - 1).join('*') + n[n.length - 1]; }
  function viewRegister(old) {
    var api = !!CFG.API_URL; cur = { dest: null };
    if (api && !ROSTER_TRIED) { ROSTER_TRIED = true; apiGet({ roster: 1 }).then(function (r) { if (r && r.roster && Object.keys(r.roster).length) { ROSTER = r.roster; if ($('#regform')) viewRegister(old); } }).catch(function () { }); }
    var hasR = !!ROSTER, classes = hasR ? Object.keys(ROSTER).sort(function (x, y) { return x - y; }) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    app.innerHTML = '<main class="gate">' + SCENE + '<div class="gatebox"><div class="passtop"><span class="comms">' + esc(CFG.SCHOOL_EN || 'GAS SAFE TRAVEL') + ' · BOARDING PASS</span><span class="ptplane" aria-hidden="true">✈</span></div><div class="passbody"><div class="ghead">' + mascot(74, 1) + '<div><h1>통통 입자 여행</h1><span class="season">기체의 성질 · 기체 안전 여행사</span></div></div><p class="sub">가이드 신분을 확인합니다.' + (api ? ' 처음이면 여권 암호를 정하고, 다음부터는 같은 암호로 들어오세요.' : '') + '</p>' +
      '<form id="regform"><div class="row2"><label>반<select name="cls"><option value="">선택</option>' + classes.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></label><label>번호<select name="num" disabled><option value="">반 먼저</option></select></label></div>' +
      '<div class="idcard" id="idcard" aria-live="polite"><div class="av">' + mascot(44, 1) + '</div><div class="small">반과 번호를 고르면 ' + (hasR ? '이름이 나와요' : '여권이 만들어져요') + '</div></div>' +
      '<label id="nmrow"' + (hasR ? ' hidden' : '') + '>이름<input name="gname" maxlength="10" autocomplete="off" data-lpignore="true" data-1p-ignore placeholder="이름"></label>' +
      (api ? '<label>여권 암호 <span class="small">— 나만의 비밀번호. 처음이면 지금 정하세요 (2~8자)</span><span class="pw"><input name="gcode" type="text" class="secret" maxlength="8" autocomplete="off" autocapitalize="off" spellcheck="false" lang="ko" data-lpignore="true" data-1p-ignore placeholder="예) 풍선, 블루문"><button type="button" class="eye" data-act="eye">보기</button></span></label>' : '') +
      '<button class="go" type="submit">여행사 입장</button></form>' +
      '<p class="small" id="gmsg2" role="status">' + (api ? '기록은 선생님의 구글 시트에 자동 저장됩니다.' : '⚠ 서버가 연결되지 않아 기록이 이 기기에만 저장됩니다.') + '</p>' +
      '<button class="ghost" data-act="gteach">선생님으로 입장</button><div id="gtbox" hidden class="gtbox"><label>교사 비밀번호<input id="gpin" type="text" class="secret" inputmode="numeric" autocomplete="off" data-lpignore="true" data-1p-ignore></label><button class="ghost in" data-act="gtgo">들어가기</button></div>' +
      '<button class="tlinkb" data-act="gguest">🎩 참관 오셨나요? 둘러보기</button>' +
      '<div id="ggbox" hidden class="gtbox col"><p class="small"><b>둘러보기 전용</b> 입장입니다. 모든 여행지의 화면을 잠금 없이 넘겨 보실 수 있고, 해 보신 활동은 저장되지 않습니다.</p><button class="ghost in" data-act="ggo">둘러보기 시작</button></div></div></div></main>';
    var f = $('#regform'), card = $('#idcard'), av = '<div class="av">' + mascot(44, 1) + '</div>';
    function entry() { return hasR ? (ROSTER[f.cls.value] || []).filter(function (x) { return String(x.num) === f.num.value; })[0] : null; }
    function nums() {
      var list = hasR ? (ROSTER[f.cls.value] || []).map(function (x) { return x.num; }).sort(function (x, y) { return x - y; }) : (f.cls.value ? Array.apply(null, Array(40)).map(function (_, i) { return i + 1; }) : []);
      f.num.disabled = !list.length; f.num.innerHTML = '<option value="">' + (list.length ? '선택' : '반 먼저') + '</option>' + list.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '번</option>'; }).join('');
      $('#nmrow').hidden = hasR && !!list.length;
    }
    function draw() {
      var c = f.cls.value, n = f.num.value, e = entry(), nm = e ? maskName(e.name) : f.gname.value.trim();
      if (!c || !n) card.innerHTML = av + '<div class="small">' + (c ? '번호를 고르세요' : '반과 번호를 고르면 ' + (hasR ? '이름이 나와요' : '여권이 만들어져요')) + '</div>';
      else if (!nm) card.innerHTML = av + '<div class="small">' + esc(c) + '반 ' + esc(n) + '번 · 이름을 쓰세요</div>';
      else card.innerHTML = av + '<div><div class="nm">' + esc(nm) + (e ? ' <span class="small">— 내 이름 맞나요?</span>' : '') + '</div><div class="small">' + esc(c) + '반 ' + esc(n) + '번 · ' + (e ? (e.set ? '여권 암호를 입력하세요' : '<b class="first">첫 입장!</b> 여권 암호를 새로 정하세요') : T.ranks[0].name) + '</div></div>';
    }
    f.cls.addEventListener('change', function () { nums(); draw(); }); f.num.addEventListener('change', draw); f.gname.addEventListener('input', draw);
    if (old && old.cls !== '0') { f.cls.value = old.cls; nums(); f.num.value = old.num; f.gname.value = old.name; draw(); }
    f.addEventListener('submit', function (ev) {
      ev.preventDefault(); var m = $('#gmsg2'), btn = f.querySelector('.go'), e = entry();
      var c = f.cls.value, n = f.num.value, nm = e ? e.name : f.gname.value.trim(), code = api ? f.gcode.value.trim() : '';
      if (!c || !n) { m.innerHTML = '<b class="warn">반과 번호를 고르세요.</b>'; return; }
      if (!nm) { m.innerHTML = '<b class="warn">이름을 쓰세요.</b>'; return; }
      if (api && (code.length < 2 || code.length > 8)) { m.innerHTML = '<b class="warn">여권 암호는 2~8자로 정하세요.</b>'; return; }
      function enter(res) {
        var same = S.profile && S.profile.cls === c && S.profile.num === n, state = res && res.state;
        if (!same) { var keep = { profile: null, miles: 0, mi: {}, combo: 0, flags: {}, wear: {}, look: {}, badges: {}, pos: {}, seen: {}, done: {}, stamps: {}, ans: {}, data: {}, lines: {}, lab: {}, chain: {}, booths: [], exam: null, gen: {}, deb: {}, refl: {}, bigtxt: '' }; for (var k0 in keep) S[k0] = keep[k0]; }
        if (state && (state.miles || 0) >= (S.miles || 0)) { for (var k in state) S[k] = state[k]; }
        S.profile = { cls: c, num: n, name: (res && res.name) || nm, v: 2 }; sessionStorage.setItem('gastrip.in', '1'); save(); syncProgress(); route(); toast('<div class="rkup">🧳</div><p>환영합니다, <b>' + esc(S.profile.name) + '</b> ' + rank().name + '님!</p>');
      }
      if (!api) return enter(null);
      btn.disabled = true; btn.textContent = '확인 중…';
      tpost({ action: 'login', cls: c, num: n, name: nm, code: code }).then(function (r) {
        if (r.error) { btn.disabled = false; btn.textContent = '여행사 입장'; m.innerHTML = '<b class="warn">' + esc(r.error) + '</b>'; return; }
        enter(r);
      }).catch(function () { m.innerHTML = '<b class="warn">서버에 연결하지 못해 이 기기에만 저장해요.</b>'; enter(null); });
    });
  }
  var INK = '#1B1F3B';
  var WEAR = {
    scarf: '<path d="M22 74q28 14 56 0l-2 9q-26 12-52 0z" fill="#E8590C" stroke="#1B1F3B" stroke-width="3"/><path d="M62 83l4 13 8-3-3-12z" fill="#E8590C" stroke="#1B1F3B" stroke-width="3"/><path d="M30 80l2-4M40 83l2-4M50 84l2-4M60 83l2-4" stroke="#FFD8A8" stroke-width="2" stroke-linecap="round"/>',
    headset: '<path d="M17 52a33 33 0 0 1 66 0" fill="none" stroke="#1B1F3B" stroke-width="5"/><rect x="10" y="48" width="11" height="18" rx="4" fill="#A61E6E" stroke="#1B1F3B" stroke-width="3"/><rect x="79" y="48" width="11" height="18" rx="4" fill="#A61E6E" stroke="#1B1F3B" stroke-width="3"/><path d="M16 64q4 12 18 12" fill="none" stroke="#1B1F3B" stroke-width="3"/><circle cx="35" cy="76" r="3" fill="#1B1F3B"/>',
    glasses: '<rect x="27" y="39" width="21" height="15" rx="5" fill="#1B1F3B"/><rect x="52" y="39" width="21" height="15" rx="5" fill="#1B1F3B"/><path d="M47 45h6" stroke="#1B1F3B" stroke-width="4"/><path d="M31 43l5-2M56 43l5-2" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>',
    hat: '<path d="M24 30q26-26 52 0z" fill="#2F4BD8" stroke="#1B1F3B" stroke-width="4" stroke-linejoin="round"/><path d="M27 25q23-6 46 0" stroke="#FFD43B" stroke-width="4" fill="none"/><path d="M16 31h62" stroke="#1B1F3B" stroke-width="6" stroke-linecap="round"/>',
    crown: '<path d="M30 25l5-17 15 12 15-12 5 17z" fill="#FFD43B" stroke="#1B1F3B" stroke-width="4" stroke-linejoin="round"/><circle cx="50" cy="20" r="3" fill="#F03E3E"/><circle cx="37" cy="21" r="2" fill="#4DABF7"/><circle cx="63" cy="21" r="2" fill="#4DABF7"/>',
    flag: '<path d="M8 70V26" stroke="#1B1F3B" stroke-width="4" stroke-linecap="round"/><path d="M8 26l20 7-20 7z" fill="#0B7A4B" stroke="#1B1F3B" stroke-width="3" stroke-linejoin="round"/>',
    ribbon: '<path d="M62 22l-12 8 3-14zM62 22l14-4-3 13z" fill="#FF6B9E" stroke="#1B1F3B" stroke-width="3" stroke-linejoin="round"/><circle cx="62" cy="22" r="4" fill="#FF8FB8" stroke="#1B1F3B" stroke-width="3"/>',
    bowtie: '<path d="M50 84l-11-6v12zM50 84l11-6v12z" fill="#F03E3E" stroke="#1B1F3B" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="84" r="3.5" fill="#C92A2A" stroke="#1B1F3B" stroke-width="2.5"/>',
    flower: '<g transform="translate(30 24)"><circle cx="0" cy="-6" r="5" fill="#FFF3BF" stroke="#1B1F3B" stroke-width="2"/><circle cx="6" cy="-1" r="5" fill="#FFF3BF" stroke="#1B1F3B" stroke-width="2"/><circle cx="3" cy="6" r="5" fill="#FFF3BF" stroke="#1B1F3B" stroke-width="2"/><circle cx="-4" cy="5" r="5" fill="#FFF3BF" stroke="#1B1F3B" stroke-width="2"/><circle cx="-6" cy="-2" r="5" fill="#FFF3BF" stroke="#1B1F3B" stroke-width="2"/><circle r="4" fill="#FCC419" stroke="#1B1F3B" stroke-width="2"/></g>',
    sprout: '<path d="M50 18v-10" stroke="#2B8A3E" stroke-width="3.5" stroke-linecap="round"/><path d="M50 10q-12-8-16 2q10 4 16-2zM50 8q10-10 16-2q-8 6-16 2z" fill="#69DB7C" stroke="#1B1F3B" stroke-width="2.5" stroke-linejoin="round"/>',
    halo: '<ellipse cx="50" cy="12" rx="18" ry="5" fill="none" stroke="#FFD43B" stroke-width="5"/><ellipse cx="50" cy="12" rx="18" ry="5" fill="none" stroke="#1B1F3B" stroke-width="1.5" opacity=".5"/>'
  };
  var WEAR_BACK = {
    wings: '<path d="M20 50q-20-22-16 6q-8 10 14 10z" fill="#E7F5FF" stroke="#1B1F3B" stroke-width="3" stroke-linejoin="round"/><path d="M80 50q20-22 16 6q8 10-14 10z" fill="#E7F5FF" stroke="#1B1F3B" stroke-width="3" stroke-linejoin="round"/><path d="M10 52q4 4 10 4M90 52q-4 4-10 4" stroke="#A5D8FF" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
  };
  var WEAR_ORDER = ['scarf', 'bowtie', 'headset', 'glasses', 'hat', 'ribbon', 'flower', 'sprout', 'crown', 'halo', 'flag'];
  var LOOK = {
    body: [['yellow', '노랑', '#FFE57A', '#FFB300'], ['peach', '복숭아', '#FFD3B8', '#FF8A5B'], ['pink', '분홍', '#FFC2DA', '#F0508A'], ['berry', '딸기', '#FF9AA6', '#E03150'], ['lilac', '라벤더', '#E0CCFF', '#9663F0'], ['sky', '하늘', '#B8E2FF', '#3B8BEB'], ['mint', '민트', '#B6F5D8', '#20B07A'], ['lime', '연두', '#DDF59A', '#69B82A'], ['cloud', '구름', '#FFFFFF', '#B9C2E0'], ['night', '밤하늘', '#7C8BEA', '#2B2F7B'], ['choco', '초코', '#D9A77F', '#8A5530'], ['rainbow', '무지개', '', '']],
    eyes: [['dot', '동글'], ['shine', '반짝'], ['happy', '웃는'], ['wink', '윙크'], ['sleepy', '졸린'], ['star', '별'], ['heart', '하트'], ['cool', '새침']],
    mouth: [['smile', '방긋'], ['grin', '활짝'], ['tongue', '메롱'], ['cat', '고양이'], ['o', '오!'], ['tiny', '쪼끔'], ['teeth', '이빨']],
    cheek: [['pink', '분홍 볼'], ['coral', '주황 볼'], ['shy', '부끄 볼'], ['none', '볼 없음']],
    pattern: [['none', '없음'], ['dots', '물방울'], ['spark', '반짝이'], ['freckle', '주근깨'], ['stripe', '줄무늬'], ['heart', '하트']],
    move: [['right', '오른쪽'], ['left', '왼쪽'], ['both', '양쪽'], ['off', '끄기']]
  };
  var PREV = null;
  var LOOK0 = { body: 'yellow', eyes: 'shine', mouth: 'smile', cheek: 'pink', pattern: 'none', move: 'right' };
  function lookOf() { var L = {}, s = (S && S.look) || {}; for (var k in LOOK0) L[k] = s[k] || LOOK0[k]; return L; }
  var MID = 0, MSEED = Math.random().toString(36).slice(2, 6);
  function eyesSVG(e, dark) {
    var c = dark ? '#fff' : INK, hl = dark ? INK : '#fff';
    if (e === 'dot') return '<circle cx="39" cy="47" r="5" fill="' + c + '"/><circle cx="61" cy="47" r="5" fill="' + c + '"/>';
    if (e === 'shine') return '<ellipse cx="39" cy="47" rx="6" ry="7.5" fill="' + c + '"/><ellipse cx="61" cy="47" rx="6" ry="7.5" fill="' + c + '"/><circle cx="41" cy="44" r="2.6" fill="' + hl + '"/><circle cx="63" cy="44" r="2.6" fill="' + hl + '"/><circle cx="37.5" cy="50" r="1.2" fill="' + hl + '"/><circle cx="59.5" cy="50" r="1.2" fill="' + hl + '"/>';
    if (e === 'happy') return '<path d="M32 49q7-9 14 0M54 49q7-9 14 0" fill="none" stroke="' + c + '" stroke-width="4.5" stroke-linecap="round"/>';
    if (e === 'wink') return '<ellipse cx="39" cy="47" rx="6" ry="7.5" fill="' + c + '"/><circle cx="41" cy="44" r="2.6" fill="' + hl + '"/><path d="M54 48q7-6 14 0" fill="none" stroke="' + c + '" stroke-width="4.5" stroke-linecap="round"/>';
    if (e === 'sleepy') return '<path d="M32 47q7 6 14 0M54 47q7 6 14 0" fill="none" stroke="' + c + '" stroke-width="4" stroke-linecap="round"/>';
    if (e === 'star') return [39, 61].map(function (x) { return '<path transform="translate(' + x + ' 47)" d="M0-8l2.4 5 5.6.6-4.2 3.8 1.2 5.6L0 4.2-5 7l1.2-5.6L-8-2.4l5.6-.6z" fill="' + (dark ? '#FFE066' : '#FAB005') + '" stroke="' + INK + '" stroke-width="1.8" stroke-linejoin="round"/>'; }).join('');
    if (e === 'heart') return [39, 61].map(function (x) { return '<path transform="translate(' + x + ' 47)" d="M0 6C-9 0-8-7-4-7c2 0 3 1 4 3c1-2 2-3 4-3c4 0 5 7-4 13z" fill="#F03E6E" stroke="' + INK + '" stroke-width="1.8" stroke-linejoin="round"/>'; }).join('');
    if (e === 'cool') return '<path d="M32 45h14M54 45h14" stroke="' + c + '" stroke-width="3" stroke-linecap="round"/><path d="M33 47q6 6 12 0M55 47q6 6 12 0" fill="' + c + '"/>';
    return '';
  }
  function mouthSVG(m, dark) {
    var c = dark ? '#fff' : INK;
    if (m === 'smile') return '<path d="M40 61q10 9 20 0" fill="none" stroke="' + c + '" stroke-width="4.5" stroke-linecap="round"/>';
    if (m === 'grin') return '<path d="M38 59h24q-1 14-12 14t-12-14z" fill="#7A1F2B" stroke="' + c + '" stroke-width="3.5" stroke-linejoin="round"/><path d="M43 69q7-5 14 0q-3 4-7 4t-7-4z" fill="#FF8787"/>';
    if (m === 'tongue') return '<path d="M40 61q10 9 20 0" fill="none" stroke="' + c + '" stroke-width="4.5" stroke-linecap="round"/><path d="M47 66v4q3 5 6 0v-4" fill="#FF6B81" stroke="' + INK + '" stroke-width="2.5" stroke-linejoin="round"/>';
    if (m === 'cat') return '<path d="M40 61q5 6 10 0q5 6 10 0" fill="none" stroke="' + c + '" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>';
    if (m === 'o') return '<ellipse cx="50" cy="64" rx="5" ry="6" fill="#7A1F2B" stroke="' + c + '" stroke-width="3.5"/>';
    if (m === 'tiny') return '<path d="M46 63q4 3 8 0" fill="none" stroke="' + c + '" stroke-width="3.5" stroke-linecap="round"/>';
    if (m === 'teeth') return '<path d="M40 60q10 10 20 0z" fill="#7A1F2B" stroke="' + c + '" stroke-width="3.5" stroke-linejoin="round"/><path d="M44 61h12v3h-12z" fill="#fff"/>';
    return '';
  }
  function cheekSVG(c) {
    if (c === 'none') return '';
    if (c === 'shy') return '<g stroke="#F06595" stroke-width="2" stroke-linecap="round"><path d="M24 59l3-4M28 60l3-4M32 61l3-4M65 61l3-4M69 60l3-4M73 59l3-4"/></g>';
    var col = c === 'coral' ? '#FF922B' : '#FF6B9E';
    return '<ellipse cx="29" cy="59" rx="7" ry="4.2" fill="' + col + '" opacity=".55"/><ellipse cx="71" cy="59" rx="7" ry="4.2" fill="' + col + '" opacity=".55"/>';
  }
  function patSVG(p, dark) {
    var w = dark ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.6)';
    if (p === 'dots') return '<circle cx="28" cy="36" r="4" fill="' + w + '"/><circle cx="74" cy="34" r="3" fill="' + w + '"/><circle cx="22" cy="66" r="3.5" fill="' + w + '"/><circle cx="78" cy="68" r="4.5" fill="' + w + '"/><circle cx="50" cy="80" r="3" fill="' + w + '"/><circle cx="64" cy="26" r="2.5" fill="' + w + '"/>';
    if (p === 'spark') return [[26, 34, 5], [76, 66, 6], [70, 30, 3.5], [30, 74, 3.5]].map(function (a) { return '<path transform="translate(' + a[0] + ' ' + a[1] + ') scale(' + (a[2] / 6) + ')" d="M0-6Q1-1 6 0Q1 1 0 6Q-1 1-6 0Q-1-1 0-6z" fill="#fff" opacity=".9"/>'; }).join('');
    if (p === 'freckle') return '<g fill="#B5651D" opacity=".55"><circle cx="25" cy="54" r="1.4"/><circle cx="29" cy="52" r="1.4"/><circle cx="27" cy="57" r="1.4"/><circle cx="75" cy="54" r="1.4"/><circle cx="71" cy="52" r="1.4"/><circle cx="73" cy="57" r="1.4"/></g>';
    if (p === 'stripe') return '<g stroke="' + w + '" stroke-width="5" stroke-linecap="round"><path d="M10 30h80M8 74h84"/></g>';
    if (p === 'heart') return [[26, 34], [76, 70], [72, 30]].map(function (a) { return '<path transform="translate(' + a[0] + ' ' + a[1] + ') scale(.6)" d="M0 6C-9 0-8-7-4-7c2 0 3 1 4 3c1-2 2-3 4-3c4 0 5 7-4 13z" fill="#fff" opacity=".75"/>'; }).join('');
    return '';
  }
  function moveSVG(m) {
    var r = '<path d="M89 44l9-2M87 32l7-6M89 56l8 3" stroke="' + INK + '" stroke-width="4" stroke-linecap="round" opacity=".75"/>', l = '<path d="M11 44l-9-2M13 32l-7-6M11 56l-8 3" stroke="' + INK + '" stroke-width="4" stroke-linecap="round" opacity=".75"/>';
    return m === 'right' ? r : m === 'left' ? l : m === 'both' ? r + l : '';
  }
  function mascot(sz, plain, lookOver) {
    var w = plain === 1 || plain === 3 ? {} : JSON.parse(JSON.stringify(S.wear || {})), ex = '', back = '';
    if (plain === 2 && PREV) w[PREV] = true;
    var L = plain === 1 ? JSON.parse(JSON.stringify(LOOK0)) : lookOf(); if (lookOver) for (var k in lookOver) L[k] = lookOver[k];
    WEAR_ORDER.forEach(function (k) { if (w[k]) ex += WEAR[k]; }); if (w.wings) back = WEAR_BACK.wings;
    var id = 'm' + MSEED + (++MID), b = LOOK.body.filter(function (x) { return x[0] === L.body; })[0] || LOOK.body[0], dark = L.body === 'night' || L.body === 'choco';
    var grad = L.body === 'rainbow' ? '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8787"/><stop offset=".25" stop-color="#FFD43B"/><stop offset=".5" stop-color="#8CE99A"/><stop offset=".75" stop-color="#74C0FC"/><stop offset="1" stop-color="#B197FC"/></linearGradient>'
      : '<radialGradient id="' + id + 'g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="' + b[2] + '"/><stop offset="1" stop-color="' + b[3] + '"/></radialGradient>';
    var moving = !(w.headset) && L.move;
    return '<svg class="pmascot" width="' + sz + '" height="' + sz + '" viewBox="0 0 100 100" aria-hidden="true"><defs>' + grad + '<clipPath id="' + id + 'c"><circle cx="50" cy="52" r="32"/></clipPath></defs>' +
      '<ellipse cx="50" cy="92" rx="26" ry="4" fill="#1B1F3B" opacity=".12"/>' + back +
      '<circle cx="50" cy="52" r="34" fill="url(#' + id + 'g)" stroke="' + INK + '" stroke-width="4.5"/>' +
      '<g clip-path="url(#' + id + 'c)">' + patSVG(L.pattern, dark) + '</g>' +
      '<ellipse cx="36" cy="32" rx="10" ry="6" fill="#fff" opacity=".55" transform="rotate(-30 36 32)"/><circle cx="26" cy="42" r="2.5" fill="#fff" opacity=".6"/>' +
      cheekSVG(L.cheek) + eyesSVG(L.eyes, dark) + mouthSVG(L.mouth, dark) + (moving ? moveSVG(L.move) : '') + ex + '</svg>';
  }
  function lookPicker() {
    var L = lookOf(), h = '';
    var grp = function (k, label, fn) { return '<div class="lkgrp"><p class="lkh">' + label + '</p><div class="lkrow">' + LOOK[k].map(function (o) { var on = L[k] === o[0]; return '<button class="lk' + (on ? ' on' : '') + '" data-act="look" data-k="' + k + '" data-v="' + o[0] + '" aria-pressed="' + on + '" title="' + o[1] + '">' + fn(o) + '<small>' + o[1] + '</small></button>'; }).join('') + '</div></div>'; };
    var mini = function (over) { return mascot(46, 3, over); };
    h += grp('body', '🎨 몸 색깔', function (o) { return mini({ body: o[0] }); });
    h += grp('eyes', '👀 눈', function (o) { return mini({ eyes: o[0] }); });
    h += grp('mouth', '👄 입', function (o) { return mini({ mouth: o[0] }); });
    h += grp('cheek', '🌸 볼', function (o) { return mini({ cheek: o[0] }); });
    h += grp('pattern', '✨ 무늬', function (o) { return mini({ pattern: o[0] }); });
    h += grp('move', '💨 움직임 표시', function (o) { return mini({ move: o[0] }); });
    return h;
  }

  /* ---------- 홈 ---------- */
  function destProgress(d) { var n = 0; d.steps.forEach(function (s, i) { if (S.done[d.id] && S.done[d.id][i]) n++; }); return n; }
  var HTAB = 'trip';
  function viewHome(tab) {
    if (tab && ['trip', 'pass', 'bag', 'me', 'rank'].indexOf(tab) >= 0) HTAB = tab;
    var P = { trip: '', pass: '', bag: '', me: '', rank: '' };
    badges();
    var ri = rankIdx(), r = T.ranks[ri], n = stampCount(), next = T.ranks[ri + 1], nx = '';
    if (next) { var needM = Math.max(0, next.min - S.miles), needS = Math.max(0, (next.st || 0) - n); nx = '<b>' + next.name + '</b>까지 ' + [needM ? needM + ' 마일' : '', needS ? '도장 ' + needS + '개' : ''].filter(Boolean).join(', ') + ' 남았어요'; } else nx = '가장 높은 등급이에요!';
    var lo = r.min, hi = next ? next.min : r.min + 1, pc = next ? Math.min(100, (S.miles - lo) / (hi - lo) * 100) : 100;
    var h = '<header class="top"><div class="who">' + mascot(72) + '<div><a class="rk" href="#home/rank">Lv.' + (ri + 1) + ' ' + r.name + ' ›</a><h1>' + esc(S.profile.name) + ' <small>' + esc(S.profile.cls) + '반 ' + esc(S.profile.num) + '번</small></h1></div><div class="mbox"><b>' + S.miles + '</b><span>마일</span></div><button class="btn sm outbtn" data-act="reset">나가기</button></div>' +
      '<div class="mbar" role="img" aria-label="다음 등급까지 진행"><i style="width:' + pc.toFixed(0) + '%"></i></div><p class="nx">' + nx + '</p></header><main class="home">' + (isG() ? '<p class="tbar"><b>🎩 참관 모드</b> 모든 장을 잠금 없이 둘러보실 수 있고, 해 보신 활동은 저장되지 않습니다. <button class="linkbtn" data-act="tlogout">참관 끝내기</button></p>' : isT() ? '<p class="tbar"><b>교사 모드</b> 모든 장을 잠금 없이 넘길 수 있고, 마일과 기록은 쌓이지 않아요. <a href="#teacher">선생님 화면</a> <button class="linkbtn" data-act="tlogout">교사 모드 끄기</button></p>' : '');
    P.pass += '<section class="card passport"><h2>내 입자 여권 <span class="cnt">도장 ' + n + ' / 9</span></h2><div class="pgrid">';
    ['01', '02', '03'].forEach(function (s) {
      P.pass += '<div class="prow"><div class="pstd"><b>' + T.stds[s].short + '</b><span>' + T.stds[s].code + '</span></div>' + stampHTML(s, 'see') + stampHTML(s, 'meas') + stampHTML(s, 'part') + '</div>';
    });
    P.pass += '</div><p class="tiny">본 것 → 잰 것 → 입자 순서로, 눈에 보이는 현상에서 보이지 않는 입자까지 설명하면 여권이 완성돼요.</p></section>';
    P.pass += '<section class="card"><h2>📒 내 일반화 노트</h2><p class="tiny" style="margin:0 0 8px">앞 차시에서 찾은 규칙을 뒤 차시에서 입자로 다듬어요.</p><ol class="gnote">' + T.dests.filter(function (x) { return x.steps.some(function (y) { return y.type === 'gen'; }); }).map(function (x) { var gs = x.steps.filter(function (y) { return y.type === 'gen'; })[0], t = genText(S.gen[x.id]); return '<li><small>' + x.period + ' · ' + (gs.mode === 'tmp' ? '규칙 찾기' : '일반화') + '</small>' + (t ? esc(t) : '<em>아직 쓰지 않았어요</em>') + '</li>'; }).join('') + (S.bigtxt ? '<li class="big"><small>9차시 · 큰 질문에 답하기</small>' + esc(S.bigtxt) + '</li>' : '') + '</ol></section>';
    P.trip += '<section class="card bigq"><p class="cqlab">🧭 이번 여행의 큰 질문</p><p class="cqtx">' + T.big.q + '</p><p class="tiny">여행지마다 작은 탐구 질문에 답하며 문장을 다듬고, 마지막 자격시험 날 이 큰 질문에 내 말로 답해요. 내 문장은 ‘내 여권’에 모여요.</p></section>';
    P.trip += '<ol class="route">';
    T.dests.forEach(function (d) {
      var p = destProgress(d), tot = d.steps.length, fin = p >= tot;
      P.trip += '<li><a class="dcard' + (fin ? ' fin' : '') + '" href="#d/' + d.id + '" style="--c:' + d.color + '"><span class="dic">' + d.icon + '</span><span class="dtx"><small>' + d.period + ' · ' + d.page + '</small><b>' + d.place + '</b><em' + (d.cq ? ' class="dcq" title="' + esc(d.title) + '">🧭 ' + d.cq : '>' + d.title) + '</em></span><span class="dpg">' + (fin ? '완료' : p + '/' + tot) + '</span></a></li>';
    });
    P.trip += '</ol>';
    var got = BADGES.filter(function (b) { return S.badges[b.id]; }).length;
    P.bag += '<section class="card"><h2>여행 가방 <span class="cnt">' + got + ' / ' + BADGES.length + '</span></h2><p class="tiny" style="margin:0 0 10px">여행지를 마치면 스티커를, 특별한 일을 해내면 배지를 얻어요. 눌러서 조건을 볼 수 있어요.</p><div class="bgrid">' +
      BADGES.map(function (b) { var on = S.badges[b.id]; return '<button class="bdg' + (on ? ' on' : '') + '" data-act="bdg" data-n="' + esc(b.n) + '" data-d="' + esc(b.d) + '" aria-label="' + esc(b.n) + (on ? ' 획득' : ' 아직') + '"><span>' + (on ? b.ic : '❔') + '</span><small>' + b.n + '</small></button>'; }).join('') + '</div><p class="tiny" id="bdgmsg" aria-live="polite"></p></section>';
    P.me += '<section class="card"><h2>내 입자 꾸미기</h2><div class="wearbox"><div class="wearme">' + mascot(140, 2) + (PREV ? '<small>미리 보기</small>' : '') + '<div class="lkbtns"><button class="btn sm" data-act="lookrand">🎲 아무거나</button><button class="btn sm ghost" data-act="lookreset">↺ 처음 모습</button></div></div><div class="lkall">' + lookPicker() + '</div></div>' +
      '<p class="tiny">기체 입자는 쉬지 않고 움직여요. 💨 움직임 표시는 그 움직임을 나타내는 선이에요. 모양과 색은 꾸미기일 뿐, 진짜 입자는 아주 작아서 색도 얼굴도 없어요.</p></section>' +
      '<section class="card"><h2>여행 아이템 <span class="cnt">등급이 오르면 열려요</span></h2><div class="wearlist">' +
      T.items.map(function (it) { var open = ri >= it.at || isT(); return '<button class="wr' + (S.wear[it.id] ? ' on' : '') + '" data-act="wear" data-id="' + it.id + '" data-lock="' + (open ? '' : '1') + '" aria-pressed="' + !!S.wear[it.id] + '">' + (open ? '' : '🔒 ') + it.name + (open ? '' : '<small>Lv.' + (it.at + 1) + '</small>') + '</button>'; }).join('') + '</div><p class="tiny">' + (PREV ? '잠긴 아이템을 미리 보고 있어요. 등급이 오르면 쓸 수 있어요.' : '🔒 잠긴 아이템도 누르면 어떤 모습인지 미리 볼 수 있어요.') + '</p></section>';
    P.rank += '<section class="card lvnow"><div class="lvface">' + mascot(96) + '</div><div><p class="rk">지금 내 등급</p><h2>Lv.' + (ri + 1) + ' ' + r.name + '</h2><p>' + nx + '</p><div class="mbar dark"><i style="width:' + pc.toFixed(0) + '%"></i></div><p class="tiny">' + S.miles + ' 마일 · 도장 ' + n + '개</p></div></section>';
    P.rank += '<section class="card"><h2>마일은 이렇게 모아요</h2><ul class="earn">' + [['🗝️', '안내 카드의 빈칸을 모두 열기', '+2'], ['🔮', '출발 질문에 예측하기', '+2 (맞으면 +3)'], ['📝', '문제를 한 번에 맞히기', '+3 (틀리면 +1)'], ['🔥', '3번, 5번 연속으로 맞히기', '+3, +5'], ['🔬', '실험 활동 마치기 (점토, 입자 모형, 그래프, 입자로 설명하기)', '+6 ~ +10'], ['🗣️', '여행 안내 한 줄 쓰기', '+6'], ['📘', '도장 받기', '+10'], ['🎓', '자격시험', '맞힌 문항 × 2']].map(function (x) { return '<li><span>' + x[0] + '</span><div>' + x[1] + '</div><b>' + x[2] + '</b></li>'; }).join('') + '</ul></section>';
    P.rank += '<section class="card"><h2>등급과 선물</h2><ol class="rklist">' + T.ranks.map(function (x, j) { var gift = T.items.filter(function (it) { return it.at === j; }).map(function (it) { return '🎁 ' + it.name; }); if (j === 7 && CFG.COUPONS !== false) gift.push('🎟️ 쿠폰'); return '<li class="' + (j === ri ? 'cur' : j < ri ? 'past' : '') + '"><span class="lv">' + (j < ri ? '✓ ' : '') + 'Lv.' + (j + 1) + '</span><b>' + x.name + (gift.length ? '<em>' + gift.join(' · ') + '</em>' : '') + '</b><span class="rq">' + x.min + ' 마일' + (x.st ? ' · 도장 ' + x.st + '개' : '') + '</span></li>'; }).join('') + '</ol><p class="tiny">Lv.6부터는 마일만으로는 오를 수 없어요. 입자로 설명해서 도장을 모아야 해요.</p></section>';
    if (CFG.COUPONS !== false) P.me += '<section class="card"><h2>선생님 쿠폰</h2><ul class="cpn">' + T.coupons.map(function (c) { var ok = couponOK(c.id); return '<li class="' + (ok ? 'on' : '') + '"><span>' + (ok ? '🎟️' : '🔒') + '</span><div><b>' + c.name + '</b><small>' + c.cond + '</small></div><em>' + (ok ? '선생님께 보여 주세요' : '아직') + '</em></li>'; }).join('') + '</ul></section>';
    if (S.exam) P.pass += '<section class="card"><h2>자격시험 기록</h2><p>최고 점수 <b>' + S.exam.best + ' / ' + S.exam.total + '</b>' + (S.exam.best >= 14 ? ' · 입자 가이드 자격 취득' : '') + '</p></section>';
    var tabs = [['trip', '🗺️ 여행 일정'], ['pass', '📘 내 여권 ' + n + '/9'], ['bag', '🧳 여행 가방 ' + got + '/' + BADGES.length], ['me', '😀 내 입자'], ['rank', '🎖️ 등급 안내']];
    h += '<nav class="htabs" aria-label="메뉴">' + tabs.map(function (t) { return '<a href="#home/' + t[0] + '" class="' + (HTAB === t[0] ? 'on' : '') + '"' + (HTAB === t[0] ? ' aria-current="page"' : '') + '>' + t[1] + '</a>'; }).join('') + '</nav>' + P[HTAB];
    h += '<p class="tlink">' + (isG() ? '' : '<a href="#teacher">선생님 화면</a> · ') + '<button class="linkbtn" data-act="reset"' + (CFG.API_URL ? '' : ' data-wipe="1"') + '>' + (CFG.API_URL ? '나가기 (다른 사람이 쓰기)' : '기록 지우고 새로 시작') + '</button></p></main>';
    app.innerHTML = h;
  }

  /* ---------- 여행지 ---------- */
  function markDone(d, i) {
    S.done[d.id] = S.done[d.id] || {};
    if (S.done[d.id][i]) return;
    S.done[d.id][i] = Date.now(); save();
    var st = d.steps[i]; mile('s.' + d.id + '.' + i, { exp: 4, presslab: 6, sim: 6, data: 10, vac: 10, pumpsim: 6, chain: 8, line: 6, booth: 6, gen: 8, debate: 4, reflect: 3, bigidea: 8 }[st.type] || 0);
    if (st.stamp && d.std) award(d.std, st.stamp);
    syncProgress();
  }
  var ROAD = ['예상', '탐구', '입자', '설명', '문제', '돌아보기'];
  function roadIdx(sl, st) {
    if (sl.k === 'q') return 0; if (sl.k === 'pq') return 4;
    if (sl.k === 'card' || sl.k === 'ex' || sl.k === 'labs' || sl.k === 'expa' || sl.k === 'expb') return 1;
    if (!st) return -1; var t = st.type;
    if (t === 'presslab' || t === 'data' || t === 'vac') return 1; if (t === 'sim' || t === 'pumpsim' || t === 'chain') return 2; if (t === 'line' || t === 'gen' || t === 'debate' || t === 'bigidea') return 3; if (t === 'reflect') return 5; if (t === 'booth') return 1; if (t === 'quiz' || t === 'exam') return 4; return -1;
  }
  function slStage(d, s) { return roadIdx(s, s.si != null ? d.steps[s.si] : null); }
  function grpName(d, s) { var st = s.si != null ? d.steps[s.si] : null; if (s.k === 'ex') return '생활 속 예'; if (s.k === 'labs') return '실험 목록'; if (st && st.grp) return st.grp; if (st && st.type === 'exp' && T.exps[st.code]) return T.exps[st.code].title; return st ? st.title : ''; }
  function grpKey(s) { var st = s.si != null && cur.dest ? cur.dest.steps[s.si] : null; if (st && st.grp) return 'g:' + st.grp; return s.si + (s.k === 'ex' ? 'x' : s.k === 'labs' ? 'l' : ''); }
  function roadHTML(sl, st) {
    var r = roadIdx(sl, st); if (r < 0) return '';
    var d = cur.dest, all = cur.slides || [], cnt = ROAD.map(function () { return 0; });
    all.forEach(function (s) { var x = slStage(d, s); if (x >= 0) cnt[x]++; });
    var h = '<ol class="road" aria-label="오늘의 길">' + ROAD.map(function (n, j) { return '<li class="' + (j < r ? 'past' : j === r ? 'now' : '') + (cnt[j] ? '' : ' none') + '"' + (j === r ? ' aria-current="step"' : '') + '><button data-act="road" data-r="' + j + '">' + n + (cnt[j] ? ' <small>' + cnt[j] + '장</small>' : '') + '</button></li>'; }).join('') + '</ol>';
    var gs = [], gm = {};
    all.forEach(function (s, x) { if (slStage(d, s) !== r) return; var key = grpKey(s); if (!gm[key]) { gm[key] = { name: grpName(d, s), first: x, idx: [] }; gs.push(gm[key]); } gm[key].idx.push(x); });
    if (gs.length > 1 || (gs[0] && gs[0].idx.length > 1)) {
      h += '<div class="subroad" aria-label="' + ROAD[r] + ' 구성">' + gs.map(function (g, gi) {
        var here = g.idx.indexOf(cur.slide), done = g.idx.every(function (x) { return slideDone(d, all[x]); });
        var num = r === 1 && gs.length > 1 ? ROAD[r] + (gi + 1) + ' · ' : '';
        return '<button class="' + (here >= 0 ? 'on' : '') + (done ? ' ok' : '') + '" data-act="roadg" data-t="' + g.first + '">' + (done ? '✓ ' : '') + num + esc(g.name) + ' <small>' + (here >= 0 ? (here + 1) + '/' : '') + g.idx.length + '장</small></button>';
      }).join('') + '</div>';
    }
    return h;
  }
  function slideGo(t) {
    var d = cur.dest, sl = cur.slides; if (!d || !sl || t === cur.slide) return;
    if (!isT()) for (var y = 0; y < t; y++) if (!slideDone(d, sl[y])) { chip('앞 단계를 먼저 마쳐야 갈 수 있어요'); if (y < cur.slide) location.hash = '#d/' + d.id + '/' + y; return; }
    location.hash = '#d/' + d.id + '/' + t;
  }
  function roadGo(j) {
    var d = cur.dest, sl = cur.slides; if (!d || !sl) return;
    var t = -1; for (var x = 0; x < sl.length; x++) if (roadIdx(sl[x], sl[x].si != null ? d.steps[sl[x].si] : null) === j) { t = x; break; }
    if (t < 0) { chip('이번 차시에는 ‘' + ROAD[j] + '’ 단계가 없어요'); return; }
    if (t === cur.slide) return;
    if (!isT()) for (var y = 0; y < t; y++) if (!slideDone(d, sl[y])) { chip('앞 단계를 먼저 마쳐야 갈 수 있어요'); if (y < cur.slide) location.hash = '#d/' + d.id + '/' + y; return; }
    location.hash = '#d/' + d.id + '/' + t;
  }
  function sumHTML(d) {
    var gs = d.steps.filter(function (x) { return x.type === 'gen'; })[0], my = gs && genText(S.gen[d.id]), full = gs && gs.mode !== 'tmp';
    var mine = my ? '<article class="bigcard mygen"><h3>📒 ' + (full ? '내가 만든 일반화' : '내가 찾은 규칙') + '</h3><p>“' + esc(my) + '”</p></article>' : '';
    if (!d.sum) return mine;
    if (full) return mine + '<article class="bigcard sumcard"><h3>📘 가이드 노트 · 오늘 배운 것</h3>' + (mine ? '<p class="tiny">이 세 줄이 선배 가이드가 정리한 노트예요. 위의 내 문장과 비교해서 빠진 것이 있는지 찾아봐요.</p>' : '<p class="tiny">이 세 줄이 선배 가이드가 정리한 노트예요. ‘일반화하기’에서 내 문장을 쓰면 위에 함께 보여요.</p>') + '<ol>' + d.sum.map(function (l) { return '<li>' + esc(l).replace(/\[([^\]]+)\]/g, '<b>$1</b>') + '</li>'; }).join('') + '</ol></article>';
    var k = 'sum.' + d.id, done = S.seen[k];
    return mine + '<article class="bigcard sumcard"><h3>오늘 배운 것</h3><ol>' + d.sum.map(function (l) { return '<li>' + esc(l).replace(/\[([^\]]+)\]/g, function (m, w) { return done ? '<b class="blank on">' + w + '</b>' : '<b class="blank" data-act="sblank" role="button" tabindex="0">' + w + '</b>'; }) + '</li>'; }).join('') + '</ol>' + (done ? '' : '<p class="tiny">노란 칸을 눌러 확인해요.</p>') + '</article>';
  }
  function isDone(d, i) { return !!(S.done[d.id] && S.done[d.id][i]); }
  function buildSlides(d) {
    var a = [{ k: 'hero' }];
    d.steps.forEach(function (st, si) {
      if (st.type === 'predict') st.items.forEach(function (it, j) { a.push({ k: 'q', si: si, j: j, n: st.items.length }); });
      else if (st.type === 'cards') { st.cards.forEach(function (c, j) { a.push({ k: 'card', si: si, j: j, n: st.cards.length }); }); if (st.examples) a.push({ k: 'ex', si: si }); if (st.labs) a.push({ k: 'labs', si: si }); }
      else if (st.type === 'quiz') st.ids.forEach(function (id, j) { a.push({ k: 'pq', si: si, j: j, id: id, n: st.ids.length }); });
      else if (st.type === 'exp') { a.push({ k: 'expa', si: si }); a.push({ k: 'expb', si: si }); }
      else a.push({ k: 'whole', si: si });
    });
    a.push({ k: 'clear' }); return a;
  }
  function slideDone(d, sl) {
    var st = sl.si != null ? d.steps[sl.si] : null;
    if (sl.k === 'q') return !!S.ans[pfx(d, sl.si) + sl.j];
    if (sl.k === 'pq') return !!S.ans['p.' + sl.id];
    if (sl.k === 'card') return !!S.seen[pfx(d, sl.si) + sl.j];
    if (sl.k === 'whole') return DONE[st.type](d, st, sl.si);
    if (sl.k === 'expa') return !!S.seen[pfx(d, sl.si) + 'ea'];
    if (sl.k === 'expb') return expbDone(d, st, sl.si);
    return true;
  }
  function viewDest(d, k) {
    S.pos = S.pos || {}; S.seen = S.seen || {};
    var slides = buildSlides(d);
    if (k < 0) k = isT() ? 0 : (S.pos[d.id] || 0);
    if (k >= slides.length) k = slides.length - 1;
    S.pos[d.id] = k; save();
    var sl = slides[k], st = sl.si != null ? d.steps[sl.si] : null, body = '', kick = st ? st.title + (sl.n > 1 ? ' ' + (sl.j + 1) + ' / ' + sl.n : '') : '';
    cur = { dest: d, step: sl.si, slide: k, slides: slides, sl: sl };
    if (sl.k !== 'hero' && sl.k !== 'clear') body = roadHTML(sl, st);
    if (sl.k === 'hero') body = '<div class="hero"><div class="hic">' + d.icon + '</div><p class="s-kicker">' + d.period + ' · ' + d.page + '</p><h1 class="s-title">' + d.place + '</h1><p class="hsub">' + d.title + '</p><p class="hintro">' + d.intro + '</p>' + (d.cq ? '<div class="cqbox"><span>🧭 오늘의 탐구 질문</span><b>' + d.cq + '</b></div>' : '') + (d.std ? '<p class="hstd"><b>' + T.stds[d.std].code + '</b> ' + T.stds[d.std].text + '</p>' : '') + '</div>';
    else if (sl.k === 'q') body += '<p class="s-kicker">' + kick + '</p>' + (st.note ? '<p class="note">' + st.note + '</p>' : '') + mcq(pfx(d, sl.si) + sl.j, st.items[sl.j], 'free', 0);
    else if (sl.k === 'pq') body += '<p class="s-kicker">' + kick + '</p>' + mcq('p.' + sl.id, T.pool[sl.id], 'quiz', 0);
    else if (sl.k === 'card') {
      var c = st.cards[sl.j], seen = S.seen[pfx(d, sl.si) + sl.j];
      body += '<p class="s-kicker">' + kick + '</p><article class="bigcard"><h2 class="s-title">' + c.h + '</h2><p class="s-body">' + (seen ? c.b : c.b.replace(/<b>/g, '<b class="blank" data-act="blank" role="button" tabindex="0">')) + '</p></article>';
    }
    else if (sl.k === 'ex') body += exSimHTML(d, st, sl.si);
    else if (sl.k === 'expa') body += expaHTML(d, st, sl.si);
    else if (sl.k === 'expb') body += expbHTML(d, st, sl.si);
    else if (sl.k === 'labs') body += '<p class="s-kicker">' + st.title + ' · 오늘 수업에서 하는 실험</p>' + labsHTML(st);
    else if (sl.k === 'clear') {
      var got = d.std ? ['see', 'meas', 'part'].map(function (x) { return stampHTML(d.std, x); }).join('') : '', ni = T.dests.indexOf(d) + 1, nd = T.dests[ni];
      body = '<div class="hero"><div class="hic">🏁</div><h1 class="s-title">' + d.place + ' 여행 끝!</h1>' + sumHTML(d) + (d.std ? '<p class="hsub">' + T.stds[d.std].short + ' 도장</p><div class="clr">' + got + '</div>' : '') + '<div class="btns ctr">' + (nd ? '<a class="btn yel" href="#d/' + nd.id + '/0">다음 여행지: ' + nd.icon + ' ' + nd.place + '</a>' : '') + '<a class="btn" href="#home">내 여권 보기</a></div></div>';
    }
    else body += '<p class="s-kicker">' + kick + '</p>' + (st.stamp && d.std ? '<p class="goal" style="--c:' + T.kinds[st.stamp].color + '">이 활동을 마치면 <b>‘' + T.kinds[st.stamp].name + '’ 도장</b>을 받아요.</p>' : '') + (st.note ? '<p class="note">' + st.note + '</p>' : '') + '<div id="stepbody">' + STEP[st.type](d, st, sl.si) + '</div>';
    app.innerHTML = '<div class="stage" style="--c:' + d.color + '" data-kind="' + sl.k + '" data-type="' + (st ? st.type : '') + '" data-si="' + (sl.si == null ? '' : sl.si) + '" data-j="' + (sl.j == null ? '' : sl.j) + '" data-id="' + (sl.id || '') + '">' +
      '<div class="stg-top"><a class="btn sm exit" href="#home">✕ 나가기</a><span class="ttl">' + d.icon + ' ' + d.period + ' · ' + d.place + '</span><span class="mtop" aria-label="모은 마일">🧳 <b id="mcount">' + S.miles + '</b></span><span class="num">' + (k + 1) + ' / ' + slides.length + '</span></div>' +
      '<div class="pbar"><i style="width:' + ((k + 1) / slides.length * 100).toFixed(1) + '%"></i></div>' +
      '<div class="stg-body" id="stgbody"><div class="slide t-' + sl.k + (st ? ' y-' + st.type : '') + '">' + body + '</div></div>' +
      '<div class="stg-nav"><button class="btn prev" data-act="go" data-d="-1"' + (k === 0 ? ' disabled' : '') + '>◀ 이전</button><span class="hintkey" id="hintkey"></span><button class="btn pri next" data-act="go" data-d="1" id="next">' + (k === slides.length - 1 ? '여권으로 🏁' : '다음 ▶') + '</button></div></div>';
    if (sl.k === 'whole' && AFTER[st.type]) AFTER[st.type](d, st, sl.si);
    if (sl.k === 'ex') exSimInit(d, st, sl.si);
    var be = $('#stgbody'), tx = null, ty = null;
    be.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
    be.addEventListener('touchend', function (e) { if (tx === null) return; var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && !e.target.closest('textarea,input,select,canvas,svg,.tbl')) go(dx < 0 ? 1 : -1); tx = null; }, { passive: true });
    check();
  }
  function go(dir) {
    var d = cur.dest; if (!d || $('.celeb')) return;
    if (dir > 0 && cur.locked) { toast('<p>🔒 ' + cur.why + '</p>'); return; }
    var ni = cur.slide + dir; if (ni < 0) return;
    if (ni >= cur.slides.length) { location.hash = '#home'; return; }
    location.replace('#d/' + d.id + '/' + ni);
  }
  document.addEventListener('keydown', function (e) {
    if (!cur.dest) return;
    if (e.target.classList && e.target.classList.contains('blank') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.target.click(); return; }
    if ($('.celeb')) { if (e.key === 'Escape') $('.celeb').remove(); return; }
    if (e.target.closest && e.target.closest('input,textarea,select,button,a')) return;
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1); } else if (e.key === 'ArrowLeft') go(-1);
  });
  function check() {
    var d = cur.dest; if (!d) return; var sl = cur.sl, st = sl.si != null ? d.steps[sl.si] : null;
    if (st && DONE[st.type](d, st, sl.si)) markDone(d, sl.si);
    var ok = slideDone(d, sl), hk = $('#hintkey'), nx = $('#next'); if (!hk) return;
    cur.locked = !ok && !isT() && !(st && st.free && sl.k === 'whole');
    cur.why = sl.k === 'card' ? '노란 빈칸을 모두 눌러 확인하세요' : (sl.k === 'q' || sl.k === 'pq') ? '질문에 답하면 넘어갈 수 있어요' : (st ? TODO[st.type] : '');
    if (sl.k === 'expa' || sl.k === 'expb') cur.why = sl.k === 'expa' ? '실험을 마치면 ‘우리 모둠 실험 완료’를 눌러요' : '질문에 답하고, 설명을 끝까지 보고, 빈칸을 눌러요';
    if (st && st.type === 'vac' && !ok && vacOwn(d, st, sl.si) && !dataDoneIn(d)) cur.why = '감압 용기는 끝! 이제 실험 바구니를 바꿔 앞 장의 주사기 측정을 끝내야 넘어갈 수 있어요';
    if (st && st.free && sl.k === 'whole' && !ok && !isT()) { var hk0 = $('#hintkey'); if (hk0) { hk0.className = 'hintkey lockmsg'; hk0.textContent = '감압 용기 먼저 하는 팀은 넘어가도 돼요. 주사기 측정은 실험 바구니를 바꾼 뒤 꼭 돌아와서 해요'; } nx.classList.remove('lock'); nx.setAttribute('aria-disabled', false); return; }
    nx.classList.toggle('lock', cur.locked); nx.setAttribute('aria-disabled', cur.locked);
    hk.className = 'hintkey' + (cur.locked ? ' lockmsg' : ok && sl.k !== 'hero' && sl.k !== 'clear' && sl.k !== 'ex' && sl.k !== 'labs' ? ' okmsg' : '');
    hk.textContent = cur.locked ? '🔒 ' + cur.why : (hk.className.indexOf('okmsg') > 0 ? '✓ 완료 · ' : '') + '← → 키 · 밀어서 넘기기';
  }
  var STEP = {}, AFTER = {}, DONE = {}, TODO = {};
  function pfx(d, i) { return d.id + '.' + i + '.'; }
  function itemsHTML(d, st, i, mode) { return st.items.map(function (it, j) { return mcq(pfx(d, i) + j, it, mode, st.items.length > 1 ? j + 1 : 0); }).join(''); }

  // 예측
  STEP.predict = function (d, st, i) { return itemsHTML(d, st, i, 'free'); };
  DONE.predict = function (d, st, i) { return allAnswered(pfx(d, i), st.items); };
  TODO.predict = '질문에 모두 답해 보세요';

  // 안내 카드

  // 생활 속 예 시뮬레이션
  var EXSIM = {
    '높은 산의 과자 봉지': { v: 'P', lo: 1, hi: 0.7, kind: 'bag', ctl: '오르는 높이', a: '산 아래', b: '산꼭대기', obj: '봉지 속 기체' },
    '잠수부의 공기 방울': { v: 'P', lo: 3, hi: 1, kind: 'bubble', ctl: '방울의 위치', a: '깊은 물속', b: '수면 근처', obj: '방울 속 기체' },
    '비행기에서 먹먹한 귀': { v: 'P', lo: 1, hi: 0.8, kind: 'ear', ctl: '비행기 높이', a: '땅', b: '하늘 높이', obj: '고막 안쪽 공기' },
    '점핑 볼': { v: 'P', lo: 1, hi: 1.6, kind: 'ball', ctl: '올라타 누르는 정도', a: '그냥 둠', b: '꾹 누름', obj: '공 속 기체' },
    '운동화 공기 주머니': { v: 'P', lo: 1, hi: 2, kind: 'shoe', ctl: '발로 누르는 정도', a: '발을 뗌', b: '땅을 디딤', obj: '주머니 속 기체' },
    '압축 천연가스(CNG) 버스': { v: 'P', lo: 1, hi: 8, kind: 'cng', ctl: '가하는 압력', a: '보통', b: '아주 큰 압력', obj: '천연가스' },
    '냉장고 속 페트병': { v: 'T', lo: 25, hi: 3, kind: 'bottle', ctl: '병 속 기체의 온도', a: '실온 25 ℃', b: '냉장고 3 ℃', obj: '병 속 기체' },
    '찌그러진 탁구공': { v: 'T', lo: 20, hi: 80, kind: 'pong', ctl: '공 속 기체의 온도', a: '20 ℃', b: '뜨거운 물 80 ℃', obj: '공 속 기체' },
    '햇빛 아래 과자 봉지': { v: 'T', lo: 20, hi: 45, kind: 'sunbag', ctl: '봉지 속 기체의 온도', a: '그늘 20 ℃', b: '햇빛 45 ℃', obj: '봉지 속 기체' },
    '열기구': { v: 'T', lo: 20, hi: 100, kind: 'hot', ctl: '풍선 속 기체의 온도', a: '20 ℃', b: '버너로 가열 100 ℃', obj: '풍선 속 기체' },
    '추운 날의 풍선': { v: 'T', lo: 22, hi: -10, kind: 'cold', ctl: '풍선 속 기체의 온도', a: '실내 22 ℃', b: '바깥 -10 ℃', obj: '풍선 속 기체' },
    '스르르 움직이는 그릇': { v: 'T', lo: 20, hi: 70, kind: 'bowl', ctl: '그릇 밑 기체의 온도', a: '20 ℃', b: '뜨거운 그릇 70 ℃', obj: '그릇 밑 기체' }
  };
  function exState(c, x) {
    var val = c.lo + (c.hi - c.lo) * x, V, Vv, sp = 1, N = 30;
    if (c.v === 'P') { V = c.lo / val; Vv = V; }
    else { var tk = val + 273, t0 = c.lo + 273; V = tk / t0; Vv = 1 + 3 * (V - 1); sp = Math.max(0.35, 1 + 2.5 * (V - 1)); }
    if (c.kind === 'hot') { N = Math.round(30 * (1 - 3 * (1 - 1 / V))); }
    return { val: val, V: V, Vv: Vv, sp: sp, N: N };
  }
  function exScene(c, x, s) {
    var v = s.Vv, k = c.kind, ink = '#1B1F3B', o = '';
    var bagPath = function (cx, cy, w, h, b) { return '<path d="M' + (cx - w / 2) + ' ' + (cy - h / 2) + ' Q' + cx + ' ' + (cy - h / 2 - b * 0.6) + ' ' + (cx + w / 2) + ' ' + (cy - h / 2) + ' Q' + (cx + w / 2 + b) + ' ' + cy + ' ' + (cx + w / 2) + ' ' + (cy + h / 2) + ' Q' + cx + ' ' + (cy + h / 2 + b * 0.6) + ' ' + (cx - w / 2) + ' ' + (cy + h / 2) + ' Q' + (cx - w / 2 - b) + ' ' + cy + ' ' + (cx - w / 2) + ' ' + (cy - h / 2) + 'Z" fill="#FFD43B" stroke="' + ink + '" stroke-width="3"/><path d="M' + (cx - w / 2) + ' ' + (cy - h / 2) + 'h' + w + 'M' + (cx - w / 2) + ' ' + (cy + h / 2) + 'h' + w + '" stroke="' + ink + '" stroke-width="5" stroke-dasharray="3 3"/><text x="' + cx + '" y="' + (cy + 6) + '" text-anchor="middle" font-size="16" font-weight="700">과자</text>'; };
    if (k === 'bag') { o = '<path d="M0 220 L120 60 L200 160 L250 110 L320 220Z" fill="#B5E3DD" stroke="' + ink + '" stroke-width="2"/><circle cx="' + (40 + x * 80) + '" cy="' + (200 - x * 135) + '" r="7" fill="#D6336C"/>' + bagPath(235, 70, 70, 70, (v - 1) * 70); }
    else if (k === 'sunbag') { o = '<circle cx="50" cy="45" r="' + (18 + x * 14) + '" fill="#FFB020" opacity="' + (0.3 + x * 0.7) + '"/>' + bagPath(180, 125, 110, 110, (v - 1) * 90); }
    else if (k === 'bubble') { o = '<rect x="0" y="20" width="320" height="200" fill="#BFE3FF"/><path d="M0 20 q20 -8 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0" fill="none" stroke="#2F4BD8" stroke-width="3"/><text x="8" y="214" font-size="13">깊이 ' + Math.round((1 - x) * 20) + ' m</text><circle cx="160" cy="' + (195 - x * 150) + '" r="' + (14 * Math.cbrt(s.V) * 1.4) + '" fill="#fff" fill-opacity="0.7" stroke="' + ink + '" stroke-width="3"/><g transform="translate(70,' + (180 - x * 10) + ')"><ellipse cx="0" cy="0" rx="34" ry="12" fill="#1B1F3B"/><circle cx="30" cy="-4" r="9" fill="#FFD9A8" stroke="' + ink + '" stroke-width="2"/></g>'; }
    else if (k === 'ear') { var bl = (v - 1) * 120; o = '<text x="10" y="22" font-size="13">✈️ 높이 ' + Math.round(x * 10) + ' km</text><rect x="0" y="80" width="150" height="70" fill="#FFE2C6" stroke="' + ink + '" stroke-width="2"/><text x="20" y="72" font-size="13">바깥쪽(귓구멍)</text><rect x="170" y="70" width="150" height="90" fill="#FFF3E8" stroke="' + ink + '" stroke-width="2"/><text x="190" y="62" font-size="13">고막 안쪽 공기</text><path d="M160 80 Q' + (160 - bl) + ' 115 160 150" fill="none" stroke="#D6336C" stroke-width="5"/><text x="120" y="185" font-size="13" fill="#D6336C">고막</text>'; }
    else if (k === 'ball') { var ry = 60 * v, rx = 60 / Math.sqrt(v); o = '<rect x="0" y="200" width="320" height="20" fill="#C9CEE8"/><ellipse cx="160" cy="' + (200 - ry) + '" rx="' + rx + '" ry="' + ry + '" fill="#FF8FB1" stroke="' + ink + '" stroke-width="3"/><path d="M160 ' + (200 - 2 * ry - 4) + 'v-14" stroke="' + ink + '" stroke-width="4"/><rect x="' + (160 - 34) + '" y="' + (200 - 2 * ry - 30) + '" width="68" height="14" rx="6" fill="#FFD9A8" stroke="' + ink + '" stroke-width="2"/><text x="160" y="' + (200 - 2 * ry - 38) + '" text-anchor="middle" font-size="13">' + (x > 0.1 ? '⬇ 누르는 힘' : '') + '</text>'; }
    else if (k === 'shoe') { var hp = 34 * v; o = '<rect x="0" y="200" width="320" height="20" fill="#C9CEE8"/><rect x="60" y="' + (200 - hp - 16) + '" width="200" height="16" rx="6" fill="#fff" stroke="' + ink + '" stroke-width="3"/><rect x="60" y="184" width="200" height="16" rx="6" fill="#fff" stroke="' + ink + '" stroke-width="3"/><rect x="110" y="' + (184 - hp) + '" width="100" height="' + hp + '" rx="10" fill="#8EC5FF" fill-opacity="0.6" stroke="' + ink + '" stroke-width="2"/><path d="M60 ' + (200 - hp - 16) + ' q0 -70 90 -70 h60 q50 0 50 70" fill="#E9ECF5" stroke="' + ink + '" stroke-width="3"/><text x="160" y="' + (184 - hp / 2 + 5) + '" text-anchor="middle" font-size="12">공기 주머니</text><text x="160" y="40" text-anchor="middle" font-size="14">' + (x > 0.1 ? '⬇ 발로 누르는 힘' : '') + '</text>'; }
    else if (k === 'cng') { var pw = 220 * v; o = '<rect x="40" y="80" width="240" height="80" rx="12" fill="#fff" stroke="' + ink + '" stroke-width="3"/><rect x="50" y="88" width="' + Math.max(8, pw) + '" height="64" rx="8" fill="#8EC5FF" fill-opacity="' + (0.3 + 0.7 * (1 - v)) + '"/><rect x="' + (50 + Math.max(8, pw)) + '" y="84" width="12" height="72" fill="' + ink + '"/><rect x="' + (62 + Math.max(8, pw)) + '" y="115" width="' + (280 - 62 - Math.max(8, pw) + 30) + '" height="10" fill="' + ink + '"/><text x="160" y="190" text-anchor="middle" font-size="14">부피를 줄인 천연가스를 가스통에 저장해요</text><text x="160" y="60" text-anchor="middle" font-size="13">압력 ' + s.val.toFixed(1) + '배</text>'; }
    else if (k === 'bottle') { var bw = 70 * Math.min(1, v), cr = 1 - Math.min(1, v); o = '<rect x="80" y="20" width="160" height="195" rx="10" fill="#E3F2FF" stroke="' + ink + '" stroke-width="2"/><text x="160" y="40" text-anchor="middle" font-size="13">냉장고</text><path d="M' + (160 - bw / 2) + ' 80 q' + (cr * 30) + ' 40 0 80 q' + (-cr * 30) + ' 30 0 50 h' + bw + ' q' + (cr * 30) + ' -30 0 -50 q' + (-cr * 30) + ' -40 0 -80 z" fill="#fff" stroke="' + ink + '" stroke-width="3"/><rect x="146" y="62" width="28" height="18" rx="3" fill="' + ink + '"/>'; }
    else if (k === 'pong') { var dep = Math.max(0, 28 * (1 - x)); o = '<rect x="40" y="110" width="240" height="100" rx="10" fill="' + (x > 0.5 ? '#FFC9A8' : '#E3F2FF') + '" stroke="' + ink + '" stroke-width="2"/><text x="160" y="200" text-anchor="middle" font-size="13">' + Math.round(s.val) + ' ℃ 물</text><path d="M110 110 A50 50 0 1 1 210 110 Q160 ' + (110 - dep * 2 + 0) + ' 110 110Z" fill="#fff" stroke="' + ink + '" stroke-width="3"/>'; }
    else if (k === 'hot') { var up = x * 26, fl = 6 + x * 16; o = '<g transform="translate(0,' + (16 - up) + ')"><path d="M160 30 C90 30 90 120 140 150 L180 150 C230 120 230 30 160 30Z" fill="#FF8FB1" stroke="' + ink + '" stroke-width="3"/><path d="M152 158 q8 ' + (-fl) + ' 16 0" fill="#FFB020" stroke="#D6336C" stroke-width="2"/><rect x="145" y="168" width="30" height="20" fill="#C9A26B" stroke="' + ink + '" stroke-width="2"/><path d="M142 150 L148 168 M178 150 L172 168" stroke="' + ink + '" stroke-width="2"/></g><rect x="0" y="210" width="320" height="10" fill="#B5E3DD"/><text x="300" y="30" text-anchor="end" font-size="13">' + (x > 0.6 ? '⬆ 떠오름' : '') + '</text>'; }
    else if (k === 'cold') { var r = 50 * Math.cbrt(v); o = '<rect x="0" y="0" width="320" height="220" fill="' + (x > 0.5 ? '#E3F2FF' : '#FFF6E6') + '"/>' + (x > 0.5 ? '<text x="30" y="40" font-size="20">❄️</text><text x="270" y="70" font-size="20">❄️</text>' : '<text x="30" y="40" font-size="14">🏠 실내</text>') + '<circle cx="160" cy="100" r="' + r + '" fill="#FF6B6B" stroke="' + ink + '" stroke-width="3"/><path d="M160 ' + (100 + r) + ' l-6 10 h12z" fill="#FF6B6B" stroke="' + ink + '" stroke-width="2"/><path d="M160 ' + (110 + r) + ' q10 30 0 60" fill="none" stroke="' + ink + '" stroke-width="2"/>'; }
    else if (k === 'bowl') { var lift = Math.max(0, (v - 1) * 40), sh = x * 30; o = '<rect x="0" y="170" width="320" height="50" fill="#D8C7A0" stroke="' + ink + '" stroke-width="2"/><rect x="0" y="166" width="320" height="4" fill="#8EC5FF"/><g transform="translate(' + sh + ',' + (-lift) + ')"><path d="M90 166 Q90 90 160 90 Q230 90 230 166Z" fill="#fff" stroke="' + ink + '" stroke-width="3"/><text x="160" y="140" text-anchor="middle" font-size="13">그릇 밑 기체</text></g><text x="160" y="40" text-anchor="middle" font-size="13">' + (x > 0.3 ? '그릇이 살짝 들려 스르르' : '') + '</text>'; }
    return '<svg viewBox="0 0 320 220" class="exscene" role="img" aria-label="' + esc(c.ctl) + '에 따라 변하는 모습">' + o + '</svg>';
  }
  function exSimHTML(d, st, si) {
    var k = pfx(d, si), cur0 = S.seen[k + 'xi'] || 0;
    return '<p class="s-kicker">' + st.title + ' · 생활 속 예 시뮬레이션</p><div class="extabs">' + st.examples.map(function (e, j) { return '<button class="' + (j === cur0 ? 'on' : '') + '" data-act="extab" data-j="' + j + '">' + (S.seen[k + 'x' + j] ? '✓ ' : '') + esc(e[0]) + '</button>'; }).join('') + '</div><div id="exbox"></div>';
  }
  function exSimInit(d, st, si) {
    var k = pfx(d, si), j = S.seen[k + 'xi'] || 0, e = st.examples[j], c = EXSIM[e[0]], box = $('#exbox'); if (!box) return;
    if (!c) { box.innerHTML = '<div class="card"><b>' + esc(e[0]) + '</b><p>' + esc(e[1]) + '</p></div>'; return; }
    var x = 0;
    box.innerHTML = '<div class="exgrid"><div class="card"><div id="exsc"></div><label class="exctl"><span>' + esc(c.ctl) + '</span><input type="range" id="exr" min="0" max="100" value="0"><span class="exends"><i>' + esc(c.a) + '</i><i>' + esc(c.b) + '</i></span></label></div>' +
      '<div class="card"><p class="tiny"><b>' + esc(c.obj) + '</b>을 크게 확대한 모습</p><canvas id="exc" width="300" height="200" role="img" aria-label="' + esc(c.obj) + ' 입자 모형"></canvas><div id="exg" class="gauges"></div></div></div>' +
      '<div class="card exnote"><b>' + esc(e[0]) + '</b> ' + esc(e[1]) + (c.v === 'T' ? '<p class="tiny">눈에 잘 보이도록 변화를 실제보다 크게 그렸어요.</p>' : '') + '</div>';
    var cv = $('#exc'), ctx = cv.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = 300 * dpr; cv.height = 200 * dpr; ctx.scale(dpr, dpr);
    var ps = []; for (var n = 0; n < 40; n++) { var an = Math.random() * 6.283; ps.push({ x: 0.1 + Math.random() * 0.8, y: 0.1 + Math.random() * 0.8, vx: Math.cos(an), vy: Math.sin(an) }); }
    var run = true, s = exState(c, 0), fr = 0;
    function paint() {
      $('#exsc').innerHTML = exScene(c, x, s);
      var vt = c.v === 'P' ? '바깥 압력 ' + s.val.toFixed(2) + ' 기압' : '온도 ' + Math.round(s.val) + ' ℃';
      var bar = function (nm, pct, t) { return '<div class="g"><span>' + nm + '</span><div class="gb"><i style="width:' + Math.max(3, Math.min(100, pct)) + '%"></i></div><b>' + t + '</b></div>'; };
      $('#exg').innerHTML = bar(c.v === 'P' ? '바깥 압력' : '온도', c.v === 'P' ? s.val / Math.max(c.lo, c.hi) * 100 : (s.val + 20) / 120 * 100, vt.split(' ').slice(1).join(' ')) +
        (c.kind === 'hot' ? bar('풍선 속 입자 수', s.N / 30 * 100, s.N + '개') : bar('부피', s.V / Math.max(exState(c, 0).V, exState(c, 1).V) * 100, s.V.toFixed(2) + '배')) +
        bar('입자의 운동 빠르기', s.sp / 2 * 100, s.sp > 1.05 ? '빨라짐' : s.sp < 0.95 ? '느려짐' : '그대로');
    }
    function tick() {
      if (!run || !document.body.contains(cv)) return;
      var side = c.kind === 'hot' ? 1 : Math.max(0.3, Math.min(1, Math.sqrt(s.Vv) * 0.62)), W = 280 * side, H = 180 * (c.kind === 'hot' ? 1 : Math.max(0.45, Math.min(1, Math.sqrt(s.Vv) * 0.62))) / 1, x0 = (300 - W) / 2, y0 = (200 - H) / 2, nShow = c.kind === 'hot' ? s.N : 30;
      ctx.clearRect(0, 0, 300, 200); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1B1F3B'; ctx.lineWidth = 3; ctx.fillRect(x0, y0, W, H); ctx.strokeRect(x0, y0, W, H);
      ps.forEach(function (p, i) {
        p.x += p.vx * 0.006 * s.sp; p.y += p.vy * 0.006 * s.sp;
        if (p.x < 0.03 || p.x > 0.97) { p.vx *= -1; p.x = Math.max(0.03, Math.min(0.97, p.x)); }
        if (p.y < 0.03 || p.y > 0.97) { p.vy *= -1; p.y = Math.max(0.03, Math.min(0.97, p.y)); }
        if (i >= nShow) return;
        ctx.beginPath(); ctx.arc(x0 + p.x * W, y0 + p.y * H, 6, 0, 6.283); ctx.fillStyle = '#FFD43B'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
      });
      requestAnimationFrame(tick);
    }
    $('#exr').addEventListener('input', function () { x = this.value / 100; s = exState(c, x); paint(); if (x >= 0.95 && !S.seen[k + 'x' + j]) { S.seen[k + 'x' + j] = 1; save(); mile('ex.' + k + j, 1); var tb = document.querySelector('.extabs [data-j="' + j + '"]'); if (tb) tb.textContent = '✓ ' + e[0]; } });
    sim = { stop: function () { run = false; } };
    paint(); requestAnimationFrame(tick);
  }

  function exHTML(st) { return '<ul class="exs">' + st.examples.map(function (e) { return '<li><b>' + e[0] + '</b>' + e[1] + '</li>'; }).join('') + '</ul>'; }
  function labsHTML(st) { return '<ul class="labs">' + st.labs.map(function (l) { return '<li><div><b>' + l.name + '</b><span>' + l.note + '</span></div><a class="btn sm" target="_blank" rel="noopener" href="' + boothURL('#slides/' + l.booth) + '">실험 안내 열기</a></li>'; }).join('') + '</ul>'; }
  STEP.cards = function () { return ''; };
  DONE.cards = function () { return true; };
  function boothURL(hash) { return (CFG.BOOTH_URL || 'https://syjh0412.github.io/gas-booth/').split('#')[0] + (hash || ''); }


  // 직접 하는 실험 (1~2차시)
  function expaHTML(d, st, i) {
    var e = T.exps[st.code], ok = S.seen[pfx(d, i) + 'ea'];
    return '<p class="s-kicker">' + st.title + ' · 실험 방법</p><h2 class="s-title">' + esc(e.title) + '</h2><p class="hook">' + esc(e.hook) + '</p>' +
      '<div class="expgrid"><div class="card expart"><svg role="img" aria-label="' + esc(e.title) + ' 실험 그림" viewBox="0 0 660 300">' + e.art + '</svg></div>' +
      '<div><div class="card"><h3>준비물</h3><div class="mchips">' + e.materials.map(function (m) { return '<span class="mchip">' + esc(m) + '</span>'; }).join('') + '</div></div>' +
      '<div class="card"><h3>실험 방법</h3><ol class="esteps">' + e.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></div></div></div>' +
      '<div class="expgrid"><div class="card safe"><h3>⚠️ 안전</h3><ul class="plain">' + e.safety.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="card tips"><h3>💡 잘하는 요령</h3><ul class="plain">' + e.tips.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul></div></div>' +
      '<div class="btns ctr">' + (ok ? '<span class="tag okt">✓ 실험 완료</span>' : '<button class="btn yel" data-act="expdone">✓ 우리 모둠 실험 완료</button>') + '</div>';
  }
  function expbDone(d, st, i) {
    var e = T.exps[st.code], k = pfx(d, i), an = S.ans[k + 'ew'];
    return !!(an && an.c === e.ws.a && (S.seen[k + 'wy'] || 0) >= e.why.length && S.seen[k + 'ef']);
  }
  function expbHTML(d, st, i) {
    var e = T.exps[st.code], k = pfx(d, i), n = S.seen[k + 'wy'] || 0, fdone = S.seen[k + 'ef'];
    var f = esc(e.ws.f).replace(/\[([^\]]+)\]/g, function (m, w) { return fdone ? '<b class="blank on">' + w + '</b>' : '<b class="blank" data-act="eblank" role="button" tabindex="0">' + w + '</b>'; });
    return '<p class="s-kicker">' + st.title + ' · 결과와 까닭</p><h2 class="s-title">' + esc(e.title) + '</h2>' +
      '<div class="card"><h3>결과 확인</h3>' + mcq(k + 'ew', { q: e.ws.q, opts: e.ws.o, a: e.ws.a, ex: e.law }, 'retry', 0) + '</div>' +
      '<div class="card"><h3>모둠에서 이야기해 보기</h3><ol class="esteps">' + e.qs.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ol>' +
      '<ul class="plain why">' + e.why.map(function (w, j) { return j < n ? '<li>' + esc(w) + '</li>' : ''; }).join('') + '</ul>' +
      (n < e.why.length ? '<button class="btn" data-act="whynext">설명 한 줄씩 보기 (' + n + '/' + e.why.length + ')</button>' : '') + '</div>' +
      (n >= e.why.length ? '<article class="bigcard"><h3>한 문장으로 정리</h3><p class="s-body">' + f + '</p></article>' : '');
  }
  DONE.exp = function (d, st, i) { return !!S.seen[pfx(d, i) + 'ea'] && expbDone(d, st, i); };
  TODO.exp = '실험을 하고 결과와 까닭을 확인해요';

  // 점토 실험실
  var LABC = { fw: ['가득', '넓은 바닥', 1, '(가)'], fn: ['가득', '좁은 뚜껑', 4, '(나)'], hn: ['반', '좁은 뚜껑', 2, '(다)'], hw: ['반', '넓은 바닥', 0.5, '(라)'] };
  STEP.presslab = function (d, st, i) {
    var L = S.lab.press = S.lab.press || { f: 'f', a: 'w', tried: {} };
    return '<div class="lab card"><div class="labctl"><div><span class="lb">물의 양 (누르는 힘)</span><div class="seg"><button data-act="lab" data-k="f" data-v="f">가득</button><button data-act="lab" data-k="f" data-v="h">반</button></div></div><div><span class="lb">세우는 방향 (닿는 넓이)</span><div class="seg"><button data-act="lab" data-k="a" data-v="w">넓은 바닥</button><button data-act="lab" data-k="a" data-v="n">좁은 뚜껑</button></div></div></div><div id="labview"></div></div><div id="labq"></div>';
  };
  AFTER.presslab = function (d, st, i) { drawLab(d, st, i); };
  var labAnim = 0;
  function drawLab(d, st, i, replay) {
    var L = S.lab.press, key = L.f + L.a, c = LABC[key];
    document.querySelectorAll('.seg button').forEach(function (b) { b.classList.toggle('on', L[b.dataset.k] === b.dataset.v); });
    var U = 16, CY = 190, CX0 = 30, CX1 = 290, wide = L.a === 'w', full = L.f === 'f', foot = wide ? 96 : 26, bw = 70, bx = 160 - bw / 2, bodyH = 120;
    var bottle = wide
      ? '<rect x="112" y="170" width="96" height="10" fill="#fff" stroke="#1B1F3B" stroke-width="3"/><rect x="' + bx + '" y="50" width="' + bw + '" height="' + bodyH + '" rx="10" fill="#fff" stroke="#1B1F3B" stroke-width="3"/><rect x="' + (bx + 3) + '" y="' + (full ? 58 : 110) + '" width="' + (bw - 6) + '" height="' + (full ? 109 : 57) + '" rx="6" fill="#8EC5FF"/><rect x="147" y="34" width="26" height="18" rx="3" fill="#1B1F3B"/>'
      : '<rect x="147" y="162" width="26" height="18" rx="3" fill="#1B1F3B"/><rect x="' + bx + '" y="42" width="' + bw + '" height="' + bodyH + '" rx="10" fill="#fff" stroke="#1B1F3B" stroke-width="3"/><rect x="' + (bx + 3) + '" y="' + (full ? 50 : 102) + '" width="' + (bw - 6) + '" height="' + (full ? 109 : 57) + '" rx="6" fill="#8EC5FF"/><rect x="112" y="32" width="96" height="10" fill="#fff" stroke="#1B1F3B" stroke-width="3"/>';
    var lines = '', ruler = '';
    for (var k = 1; k <= 4; k++) lines += '<line x1="' + (CX0 + 3) + '" x2="' + (CX1 - 3) + '" y1="' + (CY + k * U) + '" y2="' + (CY + k * U) + '" stroke="#8A5A3C" stroke-opacity="0.35" stroke-width="1.5" stroke-dasharray="4 4"/>';
    for (var h = 0; h <= 8; h++) { var yy = CY + h * U / 2, mj = h % 2 === 0; ruler += '<line x1="302" x2="' + (mj ? 318 : 311) + '" y1="' + yy + '" y2="' + yy + '" stroke="#1B1F3B" stroke-width="' + (mj ? 2.2 : 1.4) + '"/>' + (mj ? '<text x="322" y="' + (yy + 5) + '" font-size="15" font-weight="700">' + (h / 2) + '</text>' : ''); }
    var svg = '<svg viewBox="0 0 360 300" class="labsvg" role="img" aria-label="점토 위에 페트병을 놓는 모습. 눌린 깊이 ' + c[2] + '칸">' +
      '<rect x="' + CX0 + '" y="' + CY + '" width="' + (CX1 - CX0) + '" height="84" rx="6" fill="#E9B48A" stroke="#1B1F3B" stroke-width="3"/>' +
      '<rect id="ldent" x="' + (160 - foot / 2) + '" y="' + CY + '" width="' + foot + '" height="0" fill="#F3F5FB" stroke="#1B1F3B" stroke-width="2"/>' + lines +
      '<line x1="302" x2="302" y1="' + CY + '" y2="' + (CY + 4 * U) + '" stroke="#1B1F3B" stroke-width="2"/>' + ruler + '<text x="300" y="' + (CY - 10) + '" font-size="13" fill="#555">깊이(칸)</text>' +
      '<line id="lmark" x1="' + (160 + foot / 2) + '" x2="302" y1="' + CY + '" y2="' + CY + '" stroke="#D6336C" stroke-width="2" stroke-dasharray="5 4" opacity="0"/>' +
      '<g id="lbot">' + bottle + '</g>' +
      '<text id="ldep" x="350" y="24" font-size="16" font-weight="700" text-anchor="end">눌린 깊이 0칸</text></svg>';
    var rows = function () { return Object.keys(L.tried).map(function (k2) { var x = LABC[k2]; return '<tr' + (k2 === key ? ' class="cur"' : '') + '><td>' + (x[3] || '') + '</td><td>' + x[0] + '</td><td>' + x[1] + '</td><td><b>' + x[2] + '칸</b></td></tr>'; }).join(''); };
    $('#labview').innerHTML = '<div class="labgrid"><div>' + svg + '<div class="btns" style="justify-content:center"><button class="btn sm" data-act="labreplay">↻ 다시 놓기</button></div></div><table class="tbl"><caption>내 실험 기록</caption><thead><tr><th></th><th>물의 양</th><th>닿는 면</th><th>눌린 깊이</th></tr></thead><tbody id="labrows">' + rows() + '</tbody></table></div>';
    var n0 = Object.keys(L.tried).length;
    $('#labq').innerHTML = n0 >= 4 ? itemsHTML(d, st, i, 'retry') : '<p class="hint">병을 놓아 보고, 조건을 바꿔 ' + (4 - n0) + '가지를 더 해 보면 질문이 나와요.</p>';
    var my = ++labAnim, g = $('#lbot'), dent = $('#ldent'), lab = $('#ldep'), mark = $('#lmark'), D = c[2] * U, t0 = performance.now(), T1 = 450, T2 = 1100;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function setPos(drop, dep) { g.setAttribute('transform', 'translate(0,' + (10 + drop + dep) + ')'); dent.setAttribute('height', dep); lab.textContent = '눌린 깊이 ' + (Math.round(dep / U * 10) / 10) + '칸'; mark.setAttribute('y1', CY + dep); mark.setAttribute('y2', CY + dep); mark.setAttribute('opacity', dep > 0.5 ? 1 : 0); }
    function finish() {
      setPos(0, D); lab.textContent = '눌린 깊이 ' + c[2] + '칸';
      var first = !L.tried[key]; L.tried[key] = 1; save();
      var tb = $('#labrows'); if (tb) tb.innerHTML = rows();
      if (first) { var n = Object.keys(L.tried).length; $('#labq').innerHTML = n >= 4 ? itemsHTML(d, st, i, 'retry') : '<p class="hint">조건을 바꿔 ' + (4 - n) + '가지를 더 해 보면 질문이 나와요.</p>'; check(); }
    }
    if (reduce) { finish(); return; }
    setPos(-70, 0);
    (function step(now) {
      if (my !== labAnim || !document.body.contains(g)) return;
      var t = now - t0;
      if (t < T1) { var q = t / T1; setPos(-70 * (1 - q * q), 0); }
      else if (t < T1 + T2) { var r = (t - T1) / T2, ez = 1 - Math.pow(1 - r, 3); setPos(0, D * ez); }
      else { finish(); return; }
      requestAnimationFrame(step);
    })(t0);
  }
  DONE.presslab = function (d, st, i) { return Object.keys((S.lab.press || { tried: {} }).tried).length >= 4 && allRight(pfx(d, i), st.items); };
  TODO.presslab = '네 가지 조건을 모두 실험하고 질문에 답해요';

  // 입자 모형
  STEP.sim = function (d, st, i) {
    var ctl = st.mode === 'box' ? '<label class="sl">입자 수 <output id="simo">25개</output><input type="range" id="simr" min="10" max="60" step="5" value="25"></label>'
      : st.mode === 'boyle' ? '<label class="sl">바깥 압력 <output id="simo">1.0기압</output><input type="range" id="simr" min="0.5" max="2" step="0.1" value="1"></label>'
        : '<label class="sl">온도 <output id="simo">20 ℃</output><input type="range" id="simr" min="0" max="80" step="5" value="20"></label>';
    return '<div class="simbox card"><canvas id="simc" width="640" height="320" role="img" aria-label="입자 모형. 노란 입자들이 용기 안에서 움직이며 벽에 충돌한다."></canvas><div class="simctl">' + ctl + '<p id="simst" class="simst" aria-live="polite"></p></div><div id="simg" class="gauges"></div></div><div class="qcol">' + itemsHTML(d, st, i, 'retry') + '</div>';
  };
  AFTER.sim = function (d, st) { sim = new Sim($('#simc'), st.mode); };
  DONE.sim = function (d, st, i) { return allRight(pfx(d, i), st.items); };
  TODO.sim = '모형을 움직여 보고 질문에 답해요';

  function Sim(cv, mode) {
    var ctx = cv.getContext('2d'), W = 640, H = 320, self = this, run = true;
    var dpr = Math.min(2, window.devicePixelRatio || 1); cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
    var x0 = 50, y0 = mode === 'box' ? 40 : 60, bh = mode === 'box' ? 240 : 200, w = mode === 'box' ? 540 : 270, tw = w, R = 7, V0 = 2.4, sp = 1, P = 1, Tc = 20, ps = [], hits = [], wall = [[], [], [], []], frame = 0;
    function add(n) { while (ps.length < n) { var a = Math.random() * 6.283; ps.push({ x: x0 + R + Math.random() * (w - 2 * R), y: y0 + R + Math.random() * (bh - 2 * R), vx: Math.cos(a), vy: Math.sin(a) }); } ps.length = n; }
    add(mode === 'box' ? 25 : 28);
    var r = $('#simr'), out = $('#simo');
    function ctl() {
      var v = parseFloat(r.value);
      if (mode === 'box') { add(v); out.textContent = v + '개'; }
      else if (mode === 'boyle') { P = v; tw = 270 / P; out.textContent = v.toFixed(1) + '기압'; }
      else { Tc = v; sp = Math.sqrt((273 + v) / 293); tw = 270 * (273 + v) / 293; out.textContent = v + ' ℃'; }
    }
    r.addEventListener('input', ctl); ctl(); w = tw;
    function bar(name, val, txt) { return '<div class="g"><span>' + name + '</span><div class="gb"><i style="width:' + Math.max(4, Math.min(100, val)) + '%"></i></div><b>' + txt + '</b></div>'; }
    function lv(x) { return x < 0.8 ? '작음' : x > 1.25 ? '큼' : '보통'; }
    function tick() {
      if (!run || !document.body.contains(cv)) return;
      frame++;
      var moving = Math.abs(tw - w) > 0.6; if (moving) w += (tw - w) * 0.03; else w = tw;
      var now = performance.now(), v = V0 * sp;
      ps.forEach(function (p) {
        p.x += p.vx * v; p.y += p.vy * v;
        if (p.x < x0 + R) { p.x = x0 + R; if (p.vx < 0) { p.vx = -p.vx; hits.push(now); wall[3].push(now); } }
        if (p.x > x0 + w - R) { p.x = x0 + w - R; if (p.vx > 0) { p.vx = -p.vx; hits.push(now); wall[1].push(now); } }
        if (p.y < y0 + R) { p.y = y0 + R; if (p.vy < 0) { p.vy = -p.vy; hits.push(now); wall[0].push(now); } }
        if (p.y > y0 + bh - R) { p.y = y0 + bh - R; if (p.vy > 0) { p.vy = -p.vy; hits.push(now); wall[2].push(now); } }
      });
      while (hits.length && hits[0] < now - 3000) hits.shift();
      wall.forEach(function (a) { while (a.length && a[0] < now - 3000) a.shift(); });
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#1B1F3B'; ctx.lineWidth = 4;
      ctx.fillRect(x0, y0, w, bh); ctx.strokeRect(x0, y0, w, bh);
      if (mode !== 'box') {
        ctx.fillStyle = '#1B1F3B'; ctx.fillRect(x0 + w, y0 - 8, 14, bh + 16); ctx.fillRect(x0 + w + 14, y0 + bh / 2 - 7, 60, 14);
        var na = mode === 'boyle' ? Math.round(P * 3) : 3; ctx.strokeStyle = '#A61E6E'; ctx.fillStyle = '#A61E6E'; ctx.lineWidth = 3;
        for (var k = 0; k < na; k++) { var ay = y0 + (k + 1) * bh / (na + 1) + (k >= na / 2 ? 14 : -14), ax = x0 + w + 96; ctx.beginPath(); ctx.moveTo(ax + 34, ay); ctx.lineTo(ax, ay); ctx.stroke(); ctx.beginPath(); ctx.moveTo(ax - 8, ay); ctx.lineTo(ax + 4, ay - 7); ctx.lineTo(ax + 4, ay + 7); ctx.fill(); }
        ctx.font = '700 14px sans-serif'; ctx.fillText('바깥 압력', Math.min(W - 70, x0 + w + 84), y0 - 14);
      }
      ctx.strokeStyle = '#1B1F3B'; ctx.lineWidth = 2;
      ps.forEach(function (p) { ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 6.283); ctx.fillStyle = '#FFD43B'; ctx.fill(); ctx.stroke(); });
      if (mode === 'box') {
        ctx.fillStyle = '#1B1F3B'; ctx.font = '700 17px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('위 ' + wall[0].length + '번', x0 + w / 2, y0 - 12); ctx.fillText('아래 ' + wall[2].length + '번', x0 + w / 2, y0 + bh + 26);
        ctx.save(); ctx.translate(x0 - 14, y0 + bh / 2); ctx.rotate(-1.5708); ctx.fillText('왼쪽 ' + wall[3].length + '번', 0, 0); ctx.restore();
        ctx.save(); ctx.translate(x0 + w + 22, y0 + bh / 2); ctx.rotate(1.5708); ctx.fillText('오른쪽 ' + wall[1].length + '번', 0, 0); ctx.restore(); ctx.textAlign = 'left';
      }
      if (frame % 12 === 0) {
        var g = '', vol = w / 270;
        if (mode === 'box') { g = bar('입자 수', ps.length / 60 * 100, ps.length + '개') + bar('충돌 횟수 (3초)', hits.length / 3.2, hits.length + '번'); $('#simst').textContent = '네 벽의 숫자를 비교해 보세요.'; }
        else if (mode === 'boyle') {
          g = bar('기체의 부피', vol * 50, lv(vol)) + bar('충돌 횟수 (3초)', hits.length / 3.2, hits.length + '번') + bar('입자의 운동 빠르기', 50, '그대로') + bar('입자 수', 47, '28개 그대로');
          $('#simst').textContent = moving ? (tw < w ? '바깥 압력이 더 커요 → 피스톤이 안으로 밀려요' : '기체의 압력이 더 커요 → 피스톤이 밖으로 밀려요') : '바깥 압력 = 기체의 압력 → 피스톤이 멈췄어요';
        } else {
          g = bar('입자의 운동 빠르기', sp * sp * 50, lv(sp * sp)) + bar('충돌 세기', sp * sp * 50, lv(sp * sp)) + bar('기체의 부피', vol * 50, lv(vol)) + bar('입자 수', 47, '28개 그대로');
          $('#simst').textContent = moving ? (tw > w ? '입자가 벽을 더 세게 밀어요 → 피스톤이 밖으로 밀려요' : '입자가 벽을 약하게 밀어요 → 피스톤이 안으로 밀려요') : '바깥 압력 = 기체의 압력 → 피스톤이 멈췄어요';
        }
        $('#simg').innerHTML = g;
      }
      requestAnimationFrame(tick);
    }
    this.stop = function () { run = false; };
    requestAnimationFrame(tick);
  }

  // 감압 용기 측정
  var VACS = [[0, 1.00], [1, 0.84], [2, 0.72], [3, 0.62], [4, 0.54], [5, 0.48], [6, 0.43], [7, 0.39], [8, 0.36], [9, 0.34], [10, 0.32], [11, 0.30], [12, 0.29], [13, 0.28], [14, 0.27], [15, 0.26]];
  function vacS() { return S.lab.vac = S.lab.vac || { rows: [], sample: false }; }
  STEP.vac = function (d, st, i) {
    var bt = !!navigator.bluetooth || isT();
    return '<div class="card sens"><h3>📡 감압 용기 속 기압 재기</h3><p class="tiny" style="margin:0 0 8px">대기압온도센서를 켜서 풍선과 함께 감압 용기에 넣고 뚜껑을 닫은 뒤 연결해요. <b>펌프질을 한 번(끝까지 당겼다가 끝까지 밀기) 할 때마다</b> 숫자가 멈추면 기록 버튼을 눌러요.</p>' +
      (bt ? '<div class="slive"><span id="slive">–</span><small>기압</small></div><p class="tiny" id="stemp"></p><p class="tiny" id="sstat" aria-live="polite"></p><div class="btns"><button class="btn pri" id="sconn" data-act="sconn">📡 센서 연결</button><button class="btn yel" data-act="vrec" disabled id="vrecb">기록하기</button></div><p class="turn">👥 <b>한 사람씩 차례로</b> 재요. 센서는 한 번에 태블릿 한 대에만 연결돼요. 내 측정이 끝나면 <b>‘내 차례 끝 · 연결 끊기’</b>를 눌러야 다음 친구가 연결할 수 있어요.</p>' : '<p class="tiny">이 기기에서는 센서를 연결할 수 없어요. 아래에 기압을 직접 써서 기록해요.</p>') +
      (CFG.API_URL ? '<div class="vacman"><label>모둠 <input id="vgroup" type="number" min="1" max="12" inputmode="numeric" value="' + esc(String(vacS().group || '')) + '" placeholder="번호"></label><button class="btn sm pri" data-act="vgather">👥 모둠 자료 모으기</button></div><p class="tiny" id="vgmsg" aria-live="polite"></p>' : '') +
      '<div class="vacman"><label>손으로 기록 <input id="vacin" type="number" step="0.01" min="0" max="1.2" inputmode="decimal" placeholder="예: 0.85"> 기압</label><button class="btn sm" data-act="vadd">추가</button></div>' +
      '<div class="btns"><button class="btn sm" data-act="vundo">마지막 기록 지우기</button><button class="btn sm" data-act="vclear">처음부터 다시</button><button class="btn sm" data-act="vsample">예시 자료 보기</button></div></div>' +
      '<div id="vacbox"></div><div id="vacq"></div>';
  };
  AFTER.vac = function (d, st, i) { drawVac(d, st, i); sPaint(); var gi = $('#vgroup'); if (gi) gi.addEventListener('change', function () { vacS().group = gi.value.trim(); save(); }); };
  function vacGraph(rows, ser) {
    var W = 560, H = 300, L = 62, R = 20, Tp = 20, B = 50, xm = 15, ym = 1.1; (ser || []).concat([{ rows: rows }]).forEach(function (q) { q.rows.forEach(function (r) { xm = Math.max(xm, r[0]); }); });
    var X = function (x) { return L + x / xm * (W - L - R); }, Y = function (y) { return H - B - y / ym * (H - Tp - B); }, s = '';
    for (var g = 0; g <= 22; g++) { var yv = g * 0.05, mj = g % 2 === 0; s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(yv) + '" y2="' + Y(yv) + '" class="' + (mj ? 'gl' : 'gm') + '"/>' + (g % 4 === 0 ? '<text x="' + (L - 8) + '" y="' + (Y(yv) + 5) + '" text-anchor="end" class="gt">' + yv.toFixed(1) + '</text>' : ''); }
    for (var k = 0; k <= xm; k++) s += '<line y1="' + Y(0) + '" y2="' + Y(ym) + '" x1="' + X(k) + '" x2="' + X(k) + '" class="gl"/><text x="' + X(k) + '" y="' + (H - B + 22) + '" text-anchor="middle" class="gt">' + k + '</text>';
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" class="gax"/><line x1="' + L + '" x2="' + L + '" y1="' + Y(0) + '" y2="' + Y(ym) + '" class="gax"/>';
    s += '<text x="' + ((L + W - R) / 2) + '" y="' + (H - 6) + '" text-anchor="middle" class="gn">펌프질 횟수 (번)</text><text transform="translate(16,' + ((Tp + H - B) / 2) + ') rotate(-90)" text-anchor="middle" class="gn">용기 속 기압</text>';
    (ser || []).forEach(function (q) { if (q.rows.length > 1) s += '<polyline fill="none" stroke="' + q.color + '" stroke-width="2" stroke-dasharray="5 4" points="' + q.rows.map(function (r) { return X(r[0]) + ',' + Y(r[1]); }).join(' ') + '"/>'; q.rows.forEach(function (r) { s += '<circle cx="' + X(r[0]) + '" cy="' + Y(r[1]) + '" r="5" fill="' + q.color + '" stroke="#1B1F3B" stroke-width="1.5"/>'; }); });
    if (rows.length > 1) s += '<polyline fill="none" stroke="#2F4BD8" stroke-width="3" points="' + rows.map(function (r) { return X(r[0]) + ',' + Y(r[1]); }).join(' ') + '"/>';
    rows.forEach(function (r) { s += '<circle cx="' + X(r[0]) + '" cy="' + Y(r[1]) + '" r="' + (ser ? 4.5 : 7) + '" fill="' + (ser ? '#2F4BD8' : '#FFD43B') + '" stroke="#1B1F3B" stroke-width="' + (ser ? 1.5 : 2.5) + '"/>'; });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="graph vacg" role="img" aria-label="펌프질 횟수에 따른 용기 속 기압 그래프">' + s + '</svg>';
  }
  function drawVac(d, st, i) {
    var V = vacS(), rows = V.rows, box = $('#vacbox'); if (!box) return;
    var vb = $('#vrecb'); if (vb) vb.textContent = rows.length ? '펌프질 ' + rows.length + '번 뒤 기압 기록' : '처음 기압 기록 (펌프질 전)';
    var G = V.gather && V.gather.members && V.gather.members.length ? V.gather.members : null;
    if (G) {
      G.forEach(function (m) { if (m.me && !V.sample) m.rows = rows.map(function (r) { return r.slice(); }); });
      var mx = 0; G.forEach(function (m) { m.rows.forEach(function (r) { mx = Math.max(mx, r[0]); }); });
      var av = []; for (var k = 0; k <= mx; k++) { var vs = G.map(function (m) { var c = m.rows.filter(function (r) { return r[0] === k; })[0]; return c ? c[1] : null; }).filter(function (v) { return v != null; }); if (vs.length) av.push([k, vs.reduce(function (t, v) { return t + v; }, 0) / vs.length, vs.length]); }
      var ser = G.map(function (m, j) { return { rows: m.rows, color: GCOL[j % GCOL.length], label: m.label }; });
      box.innerHTML = '<div class="card"><h3>👥 ' + esc(String(V.group)) + '모둠 ' + G.length + '명 비교</h3>' + vacGraph(av.map(function (r) { return [r[0], r[1]]; }), ser) +
        '<div class="clegend">' + ser.map(function (q) { return '<span><i style="background:' + q.color + '"></i>' + esc(q.label) + '</span>'; }).join('') + '<span><i style="background:#2F4BD8"></i><b>모둠 평균</b></span></div>' +
        '<div class="scroll"><table class="tbl gtab"><thead><tr><th>펌프질 횟수</th>' + G.map(function (m) { return '<th>' + esc(m.label) + '</th>'; }).join('') + '<th class="avg">평균</th></tr></thead><tbody>' +
        av.map(function (r) { return '<tr><td>' + (r[0] ? r[0] + '번' : '처음') + '</td>' + G.map(function (m) { var c = m.rows.filter(function (x) { return x[0] === r[0]; })[0]; return '<td>' + (c ? c[1].toFixed(2) : '–') + '</td>'; }).join('') + '<td class="avg">' + r[1].toFixed(2) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<div class="btns"><button class="btn sm" data-act="vmine">내 자료만 보기</button></div></div>';
    } else
    box.innerHTML = '<div class="card">' + (V.sample ? '<p class="tiny"><b>예시 자료</b>예요. 우리 모둠이 잰 값으로 바꾸려면 ‘처음부터 다시’를 눌러요.</p>' : '') + vacGraph(rows) +
      (rows.length ? '<div class="scroll"><table class="tbl"><thead><tr><th>펌프질 횟수</th><th>용기 속 기압</th><th>한 번에 줄어든 기압</th></tr></thead><tbody>' + rows.map(function (r, k) { return '<tr><td>' + (r[0] ? r[0] + '번' : '처음') + '</td><td>' + r[1].toFixed(2) + '</td><td>' + (k ? (rows[k - 1][1] - r[1]).toFixed(2) : '–') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="hint">처음 기압부터 기록해요.</p>') + '</div>';
    $('#vacq').innerHTML = rows.length >= 6 ? itemsHTML(d, st, i, 'retry') : '<p class="hint">펌프질 5번까지 기록하면 질문이 나와요. (지금 ' + Math.max(0, rows.length - 1) + '번)</p>';
  }
  function vacPush(p) { var V = vacS(); if (V.sample) { V.rows = []; V.sample = false; } V.rows.push([V.rows.length, Math.round(p * 100) / 100]); save(); sync('vac', { group: V.group || '', rows: V.rows }); chip((V.rows.length - 1 ? '펌프질 ' + (V.rows.length - 1) + '번' : '처음') + ' → ' + p.toFixed(2) + ' 기압'); }
  function vGather(d, st, i) {
    var V = vacS(), m = $('#vgmsg'), gi = $('#vgroup'); if (gi) V.group = gi.value.trim();
    if (!V.group) { m.innerHTML = '<b class="warn">먼저 ‘모둠’ 칸에 모둠 번호를 쓰세요.</b>'; if (gi) gi.focus(); return; }
    save(); m.textContent = '내 값을 올리고 모둠 자료를 모으는 중…';
    var up = V.rows.length && !V.sample ? tpost({ cls: S.profile.cls, num: S.profile.num, name: S.profile.name, key: 'vac', val: { group: V.group, rows: V.rows } }).catch(function () { }) : Promise.resolve();
    up.then(function () { return apiGet({ cls: S.profile.cls, key: 'vac' }); }).then(function (res) {
      if (res.error) throw new Error(res.error);
      var mem = (res.rows || []).filter(function (r) { return r.val && r.val.rows && r.val.rows.length && !r.val.sample && String(r.val.group) === String(V.group); }).map(function (r) { var me = String(r.num) === String(S.profile.num); return { label: r.num + '번' + (me ? '(나)' : ''), rows: r.val.rows, num: r.num, me: me }; }).sort(function (p, q) { return p.num - q.num; });
      V.gather = { members: mem, t: Date.now() }; save(); drawVac(d, st, i);
      var m2 = $('#vgmsg'); if (m2) m2.textContent = mem.length ? V.group + '모둠 ' + mem.length + '명의 자료를 모았어요. 아직 안 올린 모둠원이 있으면 잠시 뒤 다시 눌러요.' : '아직 올라온 자료가 없어요. 기압을 기록하고 다시 눌러 보세요.';
    }).catch(function () { var m3 = $('#vgmsg'); if (m3) m3.textContent = '자료를 모으지 못했어요. 잠시 뒤에 다시 눌러 보세요.'; });
  }
  function vacOwn(d, st, i) { var V = S.lab.vac; return !!(V && V.rows.length >= 6 && allRight(pfx(d, i), st.items)); }
  function dataDoneIn(d) { for (var k = 0; k < d.steps.length; k++) if (d.steps[k].type === 'data' && !DONE.data(d, d.steps[k], k)) return false; return true; }
  DONE.vac = function (d, st, i) { return vacOwn(d, st, i) && dataDoneIn(d); };
  TODO.vac = '펌프질 5번까지 기압을 기록하고 질문에 답해요';

  // 펌프 속 입자 모형
  function Pump(cv) {
    var ctx = cv.getContext('2d'), W = 640, H = 320, run = true, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr; cv.height = H * dpr; ctx.scale(dpr, dpr);
    var CX0 = 24, CX1 = 330, CY0 = 30, CY1 = 300, GA0 = 112, GA1 = 218, PY0 = 96, PY1 = 234, LMIN = 22, LMAX = 236, HB0 = CX1 + 2, HB1 = CX1 + 40, R = 6, V0 = 3.2, N0 = 64;
    var L = LMIN, tL = LMIN, ph = 'idle', A = false, B = false, ps = [], hist = [N0], strokes = 0, hits = [], frame = 0, pushT = 0, auto = 0, br = 34, bx = 120, by = 196;
    function inBalloon(x, y) { var dx = x - bx, dy = y - by; return dx * dx + dy * dy < (br + R + 4) * (br + R + 4); }
    while (ps.length < N0) { var x = CX0 + R + Math.random() * (CX1 - CX0 - 2 * R), y = CY0 + R + Math.random() * (CY1 - CY0 - 2 * R); if (inBalloon(x, y)) continue; var an = Math.random() * 6.283; ps.push({ x: x, y: y, vx: Math.cos(an), vy: Math.sin(an), r: 'c' }); }
    function nC() { return ps.filter(function (p) { return p.r === 'c'; }).length; }
    function bar(name, val, txt) { return '<div class="g"><span>' + name + '</span><div class="gb"><i style="width:' + Math.max(3, Math.min(100, val)) + '%"></i></div><b>' + txt + '</b></div>'; }
    var self = this;
    this.pull = function () { if (ph !== 'idle') return; ph = 'pull'; A = true; B = false; tL = LMAX; paintBtns(); };
    this.push = function () { if (ph !== 'pulled') return; ph = 'push'; A = false; B = true; tL = LMIN; pushT = 0; paintBtns(); };
    this.auto = function () { auto = 5; if (ph === 'idle') self.pull(); else if (ph === 'pulled') self.push(); };
    this.reset = function () { ps.forEach(function (p) { if (p.r !== 'c') p.r = 'x'; }); ps = ps.filter(function (p) { return p.r === 'c'; }); while (ps.length < N0) { var x = CX0 + R + Math.random() * (CX1 - CX0 - 2 * R), y = CY0 + R + Math.random() * (CY1 - CY0 - 2 * R); if (inBalloon(x, y)) continue; var an = Math.random() * 6.283; ps.push({ x: x, y: y, vx: Math.cos(an), vy: Math.sin(an), r: 'c' }); } hist = [N0]; strokes = 0; ph = 'idle'; A = B = false; L = tL = LMIN; auto = 0; paintBtns(); };
    function paintBtns() { var a = $('#ppull'), b = $('#ppush'); if (a) a.disabled = ph !== 'idle'; if (b) b.disabled = ph !== 'pulled'; }
    paintBtns();
    function tick() {
      if (!run || !document.body.contains(cv)) return;
      frame++; var now = performance.now();
      if (L !== tL) { var st = (LMAX - LMIN) / 55; L = tL > L ? Math.min(tL, L + st) : Math.max(tL, L - st); }
      else if (ph === 'pull') { ph = 'pulled'; pushT = 0; paintBtns(); }
      if (ph === 'pulled') { pushT++; if (auto && pushT > 150) self.push(); }
      if (ph === 'push' && L === tL) { pushT++; if (pushT > 25) { ps.forEach(function (p) { if (p.r === 'p') { p.r = 'o'; p.x = (HB0 + HB1) / 2; p.y = PY0 + 4; p.vx = 0; p.vy = -1; } }); if (pushT > 40) { ph = 'idle'; B = false; strokes++; hist.push(nC()); paintBtns(); var S2 = S.lab.pump = S.lab.pump || { n: 0 }; S2.n++; save(); var ph0 = $('#pumphint'); if (ph0 && S2.n >= 3 && cur.dest) { var sd = cur.dest.steps[cur.sl.si]; ph0.parentNode.innerHTML = itemsHTML(cur.dest, sd, cur.sl.si, 'retry'); } check(); if (auto) { auto--; if (auto) setTimeout(function () { self.pull(); }, 300); } } } }
      var px = CX1 + L, tb = Math.min(70, 34 * Math.cbrt(N0 / Math.max(6, nC()))); br += (tb - br) * 0.05;
      ps.forEach(function (p) {
        p.x += p.vx * V0; p.y += p.vy * V0;
        if (p.r === 'c') {
          if (p.x < CX0 + R) { p.x = CX0 + R; p.vx = Math.abs(p.vx); hits.push(now); }
          if (p.y < CY0 + R) { p.y = CY0 + R; p.vy = Math.abs(p.vy); hits.push(now); }
          if (p.y > CY1 - R) { p.y = CY1 - R; p.vy = -Math.abs(p.vy); hits.push(now); }
          if (p.x > CX1 - R) { if (A && p.y > GA0 + R && p.y < GA1 - R && p.vx > 0) { if (p.x > CX1 + R) p.r = 'p'; } else { p.x = CX1 - R; p.vx = -Math.abs(p.vx); hits.push(now); } }
          var dx = p.x - bx, dy = p.y - by, dd = Math.sqrt(dx * dx + dy * dy), mn = br + R;
          if (dd < mn && dd > 0) { var nx = dx / dd, ny = dy / dd, dot = p.vx * nx + p.vy * ny; p.x = bx + nx * mn; p.y = by + ny * mn; if (dot < 0) { p.vx -= 2 * dot * nx; p.vy -= 2 * dot * ny; } }
        } else if (p.r === 'p') {
          if (p.y < PY0 + R) { if (B && p.x > HB0 + R && p.x < HB1 - R) { if (p.y < PY0 - R) p.r = 'o'; } else { p.y = PY0 + R; p.vy = Math.abs(p.vy); } }
          if (p.y > PY1 - R) { p.y = PY1 - R; p.vy = -Math.abs(p.vy); }
          if (p.x > px - R) { p.x = px - R; p.vx = -Math.abs(p.vx); }
          if (p.x < CX1 + R) { if (A && p.y > GA0 + R && p.y < GA1 - R && p.vx < 0) { if (p.x < CX1 - R) p.r = 'c'; } else { p.x = CX1 + R; p.vx = Math.abs(p.vx); } }
        } else if (p.r === 'o') { p.vy = -Math.abs(p.vy) - 0.02; if (p.y < -12) p.r = 'x'; }
      });
      ps = ps.filter(function (p) { return p.r !== 'x'; });
      while (hits.length && hits[0] < now - 3000) hits.shift();
      // draw
      ctx.clearRect(0, 0, W, H); ctx.lineWidth = 4; ctx.strokeStyle = '#1B1F3B';
      ctx.fillStyle = '#fff'; ctx.fillRect(CX0, CY0, CX1 - CX0, CY1 - CY0); ctx.fillRect(CX1, PY0, L, PY1 - PY0);
      ctx.beginPath(); ctx.moveTo(CX1, GA0); ctx.lineTo(CX1, CY0); ctx.lineTo(CX0, CY0); ctx.lineTo(CX0, CY1); ctx.lineTo(CX1, CY1); ctx.lineTo(CX1, GA1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(CX1, GA0); ctx.lineTo(CX1, PY0); ctx.lineTo(HB0, PY0); ctx.moveTo(HB1, PY0); ctx.lineTo(px, PY0); ctx.moveTo(CX1, GA1); ctx.lineTo(CX1, PY1); ctx.lineTo(px, PY1); ctx.stroke();
      // valves
      ctx.lineWidth = 5; ctx.strokeStyle = A ? '#2E9E5B' : '#D6336C'; ctx.beginPath(); if (A) { ctx.moveTo(CX1, GA0); ctx.lineTo(CX1 + 30, GA0 + 10); } else { ctx.moveTo(CX1, GA0); ctx.lineTo(CX1, GA1); } ctx.stroke();
      ctx.strokeStyle = B ? '#2E9E5B' : '#D6336C'; ctx.beginPath(); if (B) { ctx.moveTo(HB1, PY0); ctx.lineTo(HB1 - 8, PY0 - 30); } else { ctx.moveTo(HB0, PY0); ctx.lineTo(HB1, PY0); } ctx.stroke();
      // piston + handle
      ctx.fillStyle = '#1B1F3B'; ctx.fillRect(px, PY0 + 3, 12, PY1 - PY0 - 6); ctx.fillRect(px + 12, (PY0 + PY1) / 2 - 5, 34, 10); ctx.fillRect(px + 46, (PY0 + PY1) / 2 - 34, 14, 68); ctx.font = '700 13px sans-serif'; ctx.fillText('손잡이', Math.min(W - 48, px + 34), (PY0 + PY1) / 2 + 52);
      // balloon
      ctx.lineWidth = 3; ctx.strokeStyle = '#1B1F3B'; ctx.fillStyle = '#FF8FB1'; ctx.beginPath(); ctx.arc(bx, by, br, 0, 6.283); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(bx - 6, by + br + 8); ctx.lineTo(bx + 6, by + br + 8); ctx.lineTo(bx, by + br - 1); ctx.closePath(); ctx.fillStyle = '#FF8FB1'; ctx.fill(); ctx.stroke();
      // particles
      ctx.lineWidth = 2; ps.forEach(function (p) { ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 6.283); ctx.fillStyle = p.r === 'c' ? '#FFD43B' : p.r === 'p' ? '#7FD1FF' : '#C9CEE6'; ctx.fill(); ctx.stroke(); });
      ctx.fillStyle = '#1B1F3B'; ctx.font = '700 15px sans-serif'; ctx.fillText('감압 용기', CX0 + 8, CY0 - 10); ctx.fillText('펌프 통', CX1 + 20, PY1 + 22); ctx.fillText('바깥', HB1 + 6, PY0 - 34);
      ctx.font = '700 13px sans-serif'; ctx.fillText('밸브 ①', CX1 - 50, GA0 - 8); ctx.fillText('밸브 ②', HB1 + 4, PY0 - 8);
      if (frame % 10 === 0) {
        var n = nC();
        $('#simst').textContent = { idle: strokes ? '펌프질 ' + strokes + '번 끝. 다시 손잡이를 당겨 보세요.' : '손잡이를 당겨 보세요.', pull: '당기는 중: 펌프 통이 넓어지고 밸브 ①이 열려요. 용기 속 입자 일부가 움직이다가 넓어진 펌프 통으로 들어가요.', pulled: '입자가 용기와 펌프 통에 고르게 퍼졌어요. 이제 손잡이를 밀어요.', push: '미는 중: 밸브 ①은 닫히고 밸브 ②가 열려요. 펌프 통에 들어온 입자가 바깥으로 나가요.' }[ph];
        $('#simg').innerHTML = bar('용기 속 입자 수', n / N0 * 100, n + '개') + bar('용기 속 기압 (처음 1기압)', n / N0 * 100, (n / N0).toFixed(2) + ' 기압') + bar('용기 벽 충돌 횟수 (3초)', hits.length / 4, hits.length + '번') + bar('풍선 크기', br / 70 * 100, br < 40 ? '처음 정도' : br < 52 ? '커짐' : '많이 커짐');
        var hb = $('#phist'); if (hb) hb.innerHTML = hist.map(function (v, k) { return '<div class="ph"><i style="height:' + Math.max(2, Math.round(v / N0 * 80)) + 'px"></i><b>' + v + '</b><span>' + (k ? k + '번' : '처음') + '</span></div>'; }).join('');
      }
      requestAnimationFrame(tick);
    }
    this.stop = function () { run = false; };
    requestAnimationFrame(tick);
  }
  STEP.pumpsim = function (d, st, i) {
    return '<div class="simbox card pumpbox"><div class="pv"><canvas id="simc" width="640" height="320" role="img" aria-label="감압 용기와 손펌프의 입자 모형. 손잡이를 당기면 용기 속 입자 일부가 펌프 통으로 들어가고, 밀면 바깥으로 나간다."></canvas></div><div class="pc">' +
      '<div class="btns"><button class="btn pri" id="ppull" data-act="ppull">⬅️ 손잡이 당기기</button><button class="btn pri" id="ppush" data-act="ppush" disabled>손잡이 밀기 ➡️</button><button class="btn sm" data-act="pauto">5번 자동으로</button><button class="btn sm" data-act="preset">처음으로</button></div>' +
      '<p id="simst" class="simst" aria-live="polite"></p><div id="simg" class="gauges"></div><p class="tiny" style="margin:12px 0 4px"><b>펌프질 뒤 용기 속 입자 수</b></p><div id="phist" class="phist"></div></div></div>' +
      '<div class="qcol">' + ((S.lab.pump && S.lab.pump.n >= 3) || isT() ? itemsHTML(d, st, i, 'retry') : '<p class="hint" id="pumphint">펌프질을 3번 해 보면 질문이 나와요.</p>') + '</div>';
  };
  AFTER.pumpsim = function (d, st) { sim = new Pump($('#simc')); };
  DONE.pumpsim = function (d, st, i) { return !!(S.lab.pump && S.lab.pump.n >= 3 && allRight(pfx(d, i), st.items)); };
  TODO.pumpsim = '펌프질을 3번 해 보고 질문에 답해요';

  // 자료 입력과 그래프
  var KIND = {
    boyle: { cols: ['부피', '압력'], unitA: 'mL', units: ['기압', 'kPa', 'hPa'], x: 1, y: 0, n: 7, sample: [[20, 1.0], [18, 1.12], [16, 1.26], [14, 1.44], [12, 1.66], [10, 1.98], [8, 2.45]], sampleUnit: '기압' },
    charles: { cols: ['온도', '부피'], unitA: '℃', units: null, x: 0, y: 1, n: 6, sample: [[60, 6.14], [50, 5.95], [40, 5.77], [30, 5.58], [20, 5.40], [10, 5.21]], sampleUnit: 'mL' }
  };
  function getData(kind) {
    var K = KIND[kind];
    S.data[kind] = S.data[kind] || { group: '', unit: K.units ? K.units[0] : (CFG.CHARLES_UNIT || 'mL'), rows: [], locked: false, placed: 0, fails: 0, sample: false };
    var D = S.data[kind]; while (D.rows.length < K.n) D.rows.push(['', '']); return D;
  }
  function validRows(D) { return D.rows.filter(function (r) { return r[0] !== '' && r[1] !== '' && isFinite(+r[0]) && isFinite(+r[1]); }).map(function (r) { return [+r[0], +r[1]]; }); }
  function units(kind, D) { return kind === 'boyle' ? ['mL', D.unit] : ['℃', D.unit]; }
  /* ---------- 무선 압력 센서 (사이언스큐브 SC:PRES, 투명 직렬 통신) ---------- */
  var SENS = { dev: null, rx: null, poll: null, recent: [], raws: [], zero: null, raw: null, buf: '', busy: false, state: 'off', kpa: null };
  var SVC = '49535343-fe7d-4ae5-8fa9-9fafd205e455', STX = '49535343-1e4d-4bd9-ba61-23c647249616', SRX = '49535343-8841-43f4-a8d4-ecbe34729bb3';
  function sFrame(ch) { var b = new Uint8Array(12); b[0] = ch.charCodeAt(0); b[11] = b[0]; var t = ''; for (var i = 0; i < 12; i++) t += String.fromCharCode(b[i]); return '{{' + btoa(t) + '}}'; }
  function sSend(ch) { if (!SENS.rx || SENS.busy) return Promise.resolve(); SENS.busy = true; return SENS.rx.writeValue(new TextEncoder().encode(sFrame(ch))).catch(function () { }).then(function () { SENS.busy = false; }); }
  function sToKpa(v) { return 101.325 + (v - SENS.zero) / 10; }
  function sZero() { SENS.raws = []; SENS.zero = null; SENS.kpa = null; SENS.recent = []; sPaint(); }
  function sNow() { var a = SENS.recent; if (!a.length) return null; return a.reduce(function (t, x) { return t + x[1]; }, 0) / a.length; }
  function sPaint() {
    var el = $('#slive'), stt = $('#sstat'); if (stt) stt.textContent = { off: '센서가 연결되지 않았어요.', wait: '센서를 고르는 중…', conn: '연결하는 중…', on: SENS.atm ? '연결됐어요. 대기압온도센서는 실제 기압을 그대로 보내요.' : SENS.zero == null ? '1기압을 맞추는 중이에요. 피스톤을 건드리지 마세요…' : '연결됐어요. 지금 압력을 1기압으로 맞췄어요.', err: SENS.err || '연결하지 못했어요.' }[SENS.state];
    if (el) el.textContent = SENS.kpa == null ? (SENS.state === 'on' ? '…' : '–') : (SENS.kpa / 101.325).toFixed(2);
    var rw = $('#sraw'); if (rw) rw.textContent = SENS.raw == null ? '' : '센서 원래 숫자 ' + SENS.raw.toFixed(1) + ' · 기준 ' + (SENS.zero == null ? '맞추는 중' : SENS.zero.toFixed(1));
    var sz = $('#szero'); if (sz) sz.disabled = SENS.state !== 'on' || SENS.atm;
    var tp = $('#stemp'); if (tp) tp.textContent = SENS.temp == null ? '' : '온도 ' + SENS.temp.toFixed(1) + ' ℃';
    document.querySelectorAll('[data-act=vrec]').forEach(function (b) { b.disabled = SENS.state !== 'on' || SENS.zero == null; });
    var c = $('#sconn'); if (c) { c.textContent = SENS.state === 'on' ? '내 차례 끝 · 연결 끊기' : '📡 센서 연결'; c.dataset.act = SENS.state === 'on' ? 'sdisc' : 'sconn'; }
    document.querySelectorAll('[data-act=srec]').forEach(function (b) { b.disabled = SENS.state !== 'on'; });
  }
  function sDisconnect() { clearInterval(SENS.poll); SENS.poll = null; SENS.zero = null; SENS.raws = []; SENS.raw = null; try { if (SENS.dev && SENS.dev.gatt.connected) SENS.dev.gatt.disconnect(); } catch (e) { } SENS.dev = null; SENS.rx = null; SENS.state = 'off'; SENS.kpa = null; SENS.recent = []; SENS.mode = null; SENS.atm = false; SENS.temp = null; sPaint(); }
  function sConnect() {
    if (!navigator.bluetooth) { SENS.state = 'err'; SENS.err = '이 기기에서는 센서를 연결할 수 없어요. 갤럭시 태블릿의 크롬에서 열어 주세요.'; sPaint(); return; }
    SENS.state = 'wait'; sPaint();
    navigator.bluetooth.requestDevice({ filters: [{ namePrefix: 'SC:PRES' }, { namePrefix: 'SC:' }], optionalServices: [SVC] }).then(function (dev) {
      SENS.dev = dev; SENS.atm = /ATM/i.test(dev.name || ''); SENS.temp = null; SENS.state = 'conn'; sPaint();
      dev.addEventListener('gattserverdisconnected', function () { if (SENS.dev === dev) { clearInterval(SENS.poll); SENS.state = 'err'; SENS.err = '연결이 끊겼어요. 다시 연결해 주세요.'; SENS.dev = null; SENS.rx = null; sPaint(); } });
      return dev.gatt.connect();
    }).then(function (g) { return g.getPrimaryService(SVC); }).then(function (svc) {
      return Promise.all([svc.getCharacteristic(STX), svc.getCharacteristic(SRX)]);
    }).then(function (cs) {
      SENS.rx = cs[1];
      cs[0].addEventListener('characteristicvaluechanged', function (ev) {
        var dv = ev.target.value, t = ''; for (var i = 0; i < dv.byteLength; i++) t += String.fromCharCode(dv.getUint8(i));
        SENS.buf += t; var re = /\{\{([A-Za-z0-9+\/=]{16})\}\}/g, m, last = 0;
        while ((m = re.exec(SENS.buf))) {
          last = re.lastIndex; var raw = atob(m[1]); if (raw.charAt(0) !== 't') continue;
          var b = new Uint8Array(12); for (var k = 0; k < 12; k++) b[k] = raw.charCodeAt(k);
          var dvb = new DataView(b.buffer), now = performance.now();
          if (SENS.atm) { SENS.temp = dvb.getUint16(4, true) / 100; SENS.kpa = dvb.getUint16(6, true) / 100; SENS.zero = 0; SENS.recent.push([now, SENS.kpa]); while (SENS.recent.length && SENS.recent[0][0] < now - 1000) SENS.recent.shift(); SENS.state = 'on'; sPaint(); continue; }
          var v = dvb.getFloat32(4, true); SENS.raw = v;
          if (SENS.zero == null) { SENS.raws.push(v); if (SENS.state !== 'on') SENS.state = 'on'; if (SENS.raws.length >= 6) { var srt = SENS.raws.slice(1).sort(function (p1, p2) { return p1 - p2; }); SENS.zero = srt[Math.floor(srt.length / 2)]; } sPaint(); continue; }
          SENS.kpa = sToKpa(v); SENS.recent.push([now, SENS.kpa]); while (SENS.recent.length && SENS.recent[0][0] < now - 1000) SENS.recent.shift();
          if (SENS.state !== 'on') { SENS.state = 'on'; }
          sPaint();
        }
        SENS.buf = SENS.buf.slice(last); if (SENS.buf.length > 400) SENS.buf = SENS.buf.slice(-60);
      });
      return cs[0].startNotifications();
    }).then(function () { return sSend('N'); }).then(function () { return new Promise(function (r) { setTimeout(r, 300); }); }).then(function () { return sSend('V'); }).then(function () {
      SENS.poll = setInterval(function () { sSend('S'); }, 250);
      setTimeout(function () { if (SENS.state === 'conn') { SENS.state = 'err'; SENS.err = '센서가 대답하지 않아요. 센서를 껐다 켜고 다시 연결해 보세요.'; sPaint(); } }, 4000);
    }).catch(function (e) { if (e && e.name === 'NotFoundError') { SENS.state = 'off'; } else { SENS.state = 'err'; SENS.err = '연결하지 못했어요. (' + (e && e.message || e) + ')'; } sPaint(); });
  }
  function sensorCard(D) {
    if (!navigator.bluetooth && !isT()) return '';
    var vols = []; for (var v = 20; v >= 7; v -= 1) vols.push(v);
    return '<div class="card sens"><h3>📡 무선 압력 센서로 재기</h3><p class="tiny" style="margin:0 0 8px">사이언스샵 앱은 꺼 두세요. 센서를 켜고 연결한 뒤, 피스톤을 눈금에 맞추고 <b>숫자가 멈추면</b> 그 부피를 눌러요. 압력이 표에 들어가요.</p>' +
      '<div class="slive"><span id="slive">–</span><small>기압</small></div><p class="tiny" id="sstat" aria-live="polite"></p>' + (isT() ? '<p class="tiny" id="sraw"></p>' : '') +
      '<div class="btns"><button class="btn pri" id="sconn" data-act="sconn">📡 센서 연결</button><button class="btn sm" id="szero" data-act="szero" disabled>다시 1기압 맞추기</button></div><p class="tiny" style="margin:4px 0 0">연결할 때와 ‘다시 1기압 맞추기’를 누를 때는 주사기 피스톤을 건드리지 마세요.</p>' +
      '<p class="turn">👥 <b>한 사람씩 차례로</b> 재요. 센서는 한 번에 태블릿 한 대에만 연결돼요. 내 측정이 끝나면 <b>‘내 차례 끝 · 연결 끊기’</b>를 눌러야 다음 친구가 연결할 수 있어요.</p>' +
      '<p class="tiny" style="margin:10px 0 4px"><b>내가 맡은 부피</b> (짝과 나눠 재요)</p><div class="seg spart">' + [['e', '짝수 20·18…8'], ['o', '홀수 19·17…7'], ['', '전부']].map(function (p) { return '<button class="' + ((D.part || '') === p[0] ? 'on' : '') + '" data-act="spart" data-p="' + p[0] + '">' + p[1] + '</button>'; }).join('') + '</div>' +
      '<p class="tiny" style="margin:10px 0 4px"><b>지금 부피를 눌러 기록하기</b></p><div class="svols part-' + (D.part || 'a') + '">' + vols.map(function (x) { return '<button class="btn sm p' + (x % 2 ? 'o' : 'e') + '" data-act="srec" data-v="' + x + '"' + (SENS.state === 'on' ? '' : ' disabled') + '>' + x + ' mL</button>'; }).join('') + '</div></div>';
  }
  /* ---------- 모둠 자료 모으기 · 반/학년 그래프 ---------- */
  var GCOL = ['#E4572E', '#17BEBB', '#E0A800', '#4E9F3D', '#9B5DE5', '#F15BB5', '#2E86AB', '#8D6E63', '#00897B', '#5C6BC0'];
  function xKey(kind, x) { return kind === 'boyle' ? String(+x) : String(Math.round(+x)); }
  function avgRows(kind, list) { // list: [[x,y],...] from several people -> averaged by x
    var by = {}, K = KIND[kind]; list.forEach(function (r) { var k = xKey(kind, r[K.x === 1 ? 1 : 0]); });
    list.forEach(function (r) { var k = xKey(kind, r[0]); (by[k] = by[k] || []).push(+r[1]); });
    return Object.keys(by).map(function (k) { var a = by[k]; return [+k, a.reduce(function (t, v) { return t + v; }, 0) / a.length, a.length]; }).sort(function (a, b) { return a[0] - b[0]; });
  }
  function recOK(v, D) { return v && v.rows && v.rows.length && !v.sample && !v.avg && (!D || v.unit === D.unit); }
  function gatherCard(kind, D) {
    var g = D.gather, h = '<div class="card gath"><h3>👥 모둠 자료 모으기</h3><p class="tiny" style="margin:0 0 8px">모둠원이 각자 자기 태블릿에서 측정했다면, <b>모두 같은 모둠 번호</b>를 쓰고 이 버튼을 눌러요. 내 값이 올라가고, 모둠원들의 값이 함께 모여요.</p><div class="btns"><button class="btn pri" data-act="gather">' + (g ? '다시 불러오기' : '모둠 자료 모으기') + '</button></div><p class="tiny" id="gmsg2b" aria-live="polite"></p>';
    if (g && g.members.length) {
      var K = KIND[kind], xs = {}; g.members.forEach(function (m) { m.rows.forEach(function (r) { xs[xKey(kind, r[0])] = 1; }); });
      var keys = Object.keys(xs).map(Number).sort(function (a, b) { return kind === 'boyle' ? b - a : a - b; }), av = avgRows(kind, [].concat.apply([], g.members.map(function (m) { return m.rows; })));
      var avMap = {}; av.forEach(function (r) { avMap[r[0]] = r[1]; });
      h += '<div class="scroll"><table class="tbl gtab"><thead><tr><th>' + K.cols[0] + '</th>' + g.members.map(function (m) { return '<th>' + esc(m.label) + '</th>'; }).join('') + '<th class="avg">평균</th></tr></thead><tbody>' +
        keys.map(function (k) { return '<tr><td>' + k + '</td>' + g.members.map(function (m) { var c = m.rows.filter(function (r) { return xKey(kind, r[0]) === String(k); })[0]; return '<td>' + (c ? c[1] : '–') + '</td>'; }).join('') + '<td class="avg">' + (+avMap[k].toFixed(kind === 'boyle' ? 2 : 2)) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
        '<div class="btns"><button class="btn yel" data-act="useavg">평균값으로 그래프 그리기</button></div>';
    }
    return h + '</div>';
  }
  function gather(d, st, i) {
    var kind = st.kind; readRows(kind); var D = S.data[kind], m = $('#gmsg2b'), own = validRows(D);
    if (!D.group) { m.innerHTML = '<b class="warn">먼저 위의 ‘모둠’ 칸에 모둠 번호를 쓰세요.</b>'; var gi = $('#dgroup'); if (gi) gi.focus(); return; }
    m.textContent = '내 값을 올리고 모둠 자료를 모으는 중…';
    var up = own.length && !D.sample ? tpost({ cls: S.profile.cls, num: S.profile.num, name: S.profile.name, key: kind, val: { group: D.group, unit: D.unit, rows: own, sample: false } }).catch(function () { }) : Promise.resolve();
    up.then(function () { return apiGet({ cls: S.profile.cls, key: kind }); }).then(function (res) {
      var mem = (res.rows || []).filter(function (r) { return recOK(r.val, D) && String(r.val.group) === String(D.group); }).map(function (r) { return { label: r.num + '번' + (String(r.num) === String(S.profile.num) ? '(나)' : ''), rows: r.val.rows, num: r.num }; }).sort(function (a, b) { return a.num - b.num; });
      D.gather = { members: mem, t: Date.now() }; save(); drawData(d, st, i);
      var m2 = $('#gmsg2b'); if (m2) m2.textContent = mem.length ? D.group + '모둠 ' + mem.length + '명의 자료를 모았어요. 아직 안 올린 모둠원이 있으면 잠시 뒤 다시 불러오세요.' : '아직 올라온 자료가 없어요. 표에 측정값을 넣고 다시 눌러 보세요.';
    }).catch(function () { var m3 = $('#gmsg2b'); if (m3) m3.textContent = '자료를 모으지 못했어요. 잠시 뒤에 다시 눌러 보세요.'; });
  }
  STEP.data = function (d, st, i) { return '<div id="databox"></div>'; };
  AFTER.data = function (d, st, i) { drawData(d, st, i); };
  function drawData(d, st, i) {
    var kind = st.kind, K = KIND[kind], D = getData(kind), u = units(kind, D), h = '';
    if (!D.locked) {
      if (kind === 'boyle') h += sensorCard(D);
      if (CFG.API_URL) h += gatherCard(kind, D);
      h += '<div class="card"><h3>① 측정값 입력</h3><div class="row3"><label>모둠<input id="dgroup" inputmode="numeric" maxlength="2" value="' + esc(D.group) + '" placeholder="예: 3"></label>' +
        (K.units ? '<label>압력 단위<select id="dunit">' + K.units.map(function (x) { return '<option' + (x === D.unit ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' : '<label>부피 단위<input id="dunit" maxlength="8" value="' + esc(D.unit) + '"></label>') + '</div>' +
        '<table class="tbl in"><thead><tr><th>번호</th><th>' + K.cols[0] + ' (' + u[0] + ')</th><th>' + K.cols[1] + ' (' + u[1] + ')</th></tr></thead><tbody>' +
        D.rows.map(function (r, j) { return '<tr><td>' + (j + 1) + '</td><td><input inputmode="decimal" data-r="' + j + '" data-c="0" value="' + esc(r[0]) + '" aria-label="' + (j + 1) + '번 ' + K.cols[0] + '"></td><td><input inputmode="decimal" data-r="' + j + '" data-c="1" value="' + esc(r[1]) + '" aria-label="' + (j + 1) + '번 ' + K.cols[1] + '"></td></tr>'; }).join('') +
        '</tbody></table><div class="btns"><button class="btn sm" data-act="addrow">줄 추가</button><button class="btn sm" data-act="sample">예시 자료로 연습</button><button class="btn pri" data-act="lock">표 완성 → 그래프 그리기</button></div><p class="tiny" id="dmsg">측정값을 4개 이상 입력해요.' + (kind === 'boyle' ? ' 센서로 재면 압력이 자동으로 들어가요.' : '') + ' 실험을 못 했다면 예시 자료로 연습할 수 있어요.</p></div>';
      $('#databox').innerHTML = h; sPaint(); return;
    }
    var rows = validRows(D), xi = K.x, yi = K.y;
    h += '<div class="card"><h3>① 우리 모둠 자료' + (D.sample ? ' <span class="tag">예시 자료</span>' : '') + (D.avg ? ' <span class="tag">모둠원 ' + (D.gather ? D.gather.members.length : '') + '명 평균</span>' : '') + ' <button class="linkbtn" data-act="unlock">다시 측정하기</button></h3><table class="tbl"><thead><tr><th>번호</th><th>' + K.cols[0] + ' (' + u[0] + ')</th><th>' + K.cols[1] + ' (' + u[1] + ')</th>' + (kind === 'boyle' ? '<th>압력 × 부피</th>' : '') + '</tr></thead><tbody>' +
      rows.map(function (r, j) { return '<tr class="' + (j === D.placed ? 'cur' : '') + '"><td>' + (j + 1) + (j < D.placed ? ' ✓' : '') + '</td><td>' + r[0] + '</td><td>' + r[1] + '</td>' + (kind === 'boyle' ? '<td>' + (+(r[0] * r[1]).toPrecision(3)) + '</td>' : '') + '</tr>'; }).join('') + '</tbody></table></div>';
    var ax = axes(rows, xi, yi, kind), done = D.placed >= rows.length, tr = done && D.trendOK, cur0 = done ? null : rows[D.placed];
    graphSVG.extra = { trend: tr, miss: !done && D.miss ? D.miss : null, guide: !done && D.fails >= 2 ? cur0[xi] : null, guideY: !done && D.fails >= 3 ? cur0[yi] : null };
    var gm = done ? (tr ? '경향선을 그렸어요. 이론값과 비교해 보세요.' : '점을 모두 찍었어요. 이제 점들이 보여 주는 <b>경향</b>을 찾아요.') :
      D.fails ? '<b class="warn">그 자리가 아니에요.</b> 점 찍을 위치를 다시 확인해 보세요. 가로축에서 <b>' + cur0[xi] + '</b>을(를) 먼저 찾고, 그 위로 올라가 세로축 <b>' + cur0[yi] + '</b> 높이를 눌러요.' + (D.fails >= 2 ? ' (분홍 점선이 가로축 ' + cur0[xi] + '의 자리예요.)' : '') :
      '<b>' + (D.placed + 1) + '번</b> 자료 (' + K.cols[xi] + ' ' + cur0[xi] + ', ' + K.cols[yi] + ' ' + cur0[yi] + ')의 자리를 그래프에서 눌러 보세요.';
    h += '<div class="card"><h3>② 그래프에 점 찍기</h3><p id="gmsg" class="gmsg" aria-live="polite">' + gm + '</p>' +
      '<div class="gwrap">' + graphSVG(ax, rows, xi, yi, D.placed, kind, K, u, done, null) + '</div>' +
      (!done && D.fails >= 3 ? '<button class="btn sm" data-act="autoplace">이 점은 도움 받기</button>' : '') + '</div>';
    if (done) {
      var right = kind === 'boyle' ? 'inv' : 'upi', topts = [['upi', '오른쪽 위로 곧게 올라간다'], ['down', '오른쪽 아래로 곧게 내려간다'], ['inv', '오른쪽 아래로 휘어지며 내려간다'], ['flat', '가로로 평평하다']];
      h += '<div class="card"><h3>③ 경향선 그리기</h3><p>그래프는 점을 찍는 것으로 끝나지 않아요. 점 하나하나보다 <b>점들이 모여서 보여 주는 모양(경향)</b>이 중요해요. 점들은 어떤 선을 따라 놓여 있나요?</p>' +
        '<div class="opts figs trendopts">' + topts.map(function (o) { var c = 'opt' + (D.trendPick === o[0] ? (o[0] === right ? ' ok' : ' no') : ''); return '<button class="' + c + '" data-act="trend" data-v="' + o[0] + '"' + (tr ? ' disabled' : '') + '>' + figSVG(o[0], K.cols[xi], K.cols[yi]) + '<span class="tl">' + o[1] + '</span></button>'; }).join('') + '</div>' +
        (D.trendPick && !tr ? '<p class="fb no">점들을 한 번 더 보세요. 점 몇 개만 보지 말고 처음부터 끝까지 어떻게 이어지는지 손가락으로 따라가 보세요.</p>' : '');
      if (tr) {
        var tc = trendCurves(rows, xi, yi, kind);
        h += '<p class="fb ok"><b>맞아요.</b> ' + (kind === 'boyle' ? '압력이 커질수록 부피가 작아지는데, 곧은 선이 아니라 휘어지는 곡선이에요. 압력이 2배가 되면 부피가 1/2배가 되는 <b>반비례</b> 관계예요.' : '온도가 높아질수록 부피가 일정하게 커지는 <b>곧은 선</b>이에요.') + '</p>' +
          '<h4>측정값과 이론값 비교</h4><p class="tiny" style="margin:0 0 6px">' + tc.note + '</p><div class="scroll"><table class="tbl"><thead><tr><th>번호</th><th>' + K.cols[xi] + ' (' + u[xi] + ')</th><th>측정한 ' + K.cols[yi] + '</th><th>이론값</th><th>차이</th></tr></thead><tbody>' +
          rows.map(function (r, j) { var th = tc.at(r[xi]), df = (r[yi] - th) / th * 100; return '<tr><td>' + (j + 1) + '</td><td>' + r[xi] + '</td><td>' + r[yi] + '</td><td>' + (+th.toFixed(2)) + '</td><td>' + (df >= 0 ? '+' : '') + df.toFixed(1) + '%</td></tr>'; }).join('') + '</tbody></table></div>' +
          '<p class="tiny">차이가 몇 % 정도는 생길 수 있어요. 눈금을 읽는 오차, 주사기 연결 부분의 공기, 손의 온도 같은 것 때문이에요. 차이가 큰 점이 있다면 그때 무슨 일이 있었는지 모둠에서 이야기해 보세요.</p>' +
          '<div class="btns"><button class="btn sm" data-act="classdata">우리 반 그래프 보기</button><button class="btn sm" data-act="gradedata">1학년 전체 그래프 보기</button></div><div id="clegend" class="clegend"></div><p class="tiny" id="cmsg">' + (kind === 'charles' ? '세로축은 0부터 시작하지 않아요. 눈금의 숫자를 잘 보세요.' : '') + '</p>';
      }
      h += '</div>';
      if (tr) h += '<h3 class="sub3">④ 그래프 해석</h3>' + itemsHTML(d, st, i, 'retry');
    }
    $('#databox').innerHTML = h;
    var svg = $('#gsvg');
    if (svg && !done) svg.addEventListener('click', function (e) {
      var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; var q = pt.matrixTransform(svg.getScreenCTM().inverse());
      var vx = ax.x0 + (q.x - ax.L) / ax.pw * (ax.x1 - ax.x0), vy = ax.y0 + (ax.T + ax.ph - q.y) / ax.ph * (ax.y1 - ax.y0), r = rows[D.placed];
      if (Math.abs(vx - r[xi]) <= (ax.x1 - ax.x0) * 0.045 && Math.abs(vy - r[yi]) <= (ax.y1 - ax.y0) * 0.06) { D.placed++; D.fails = 0; D.miss = null; if (D.placed >= rows.length && !D.missed && !D.sample) S.flags.sharp = 1; save(); if (D.placed >= rows.length && !D.avg) sync(kind, { group: D.group, unit: D.unit, rows: rows, sample: D.sample }); drawData(d, st, i); check(); }
      else { D.fails++; D.missed = 1; D.miss = [q.x, q.y]; save(); drawData(d, st, i); }
    });
  }
  function nice(lo, hi, n) { var raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p, s = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; return s; }
  function axes(rows, xi, yi, kind) {
    var xs = rows.map(function (r) { return r[xi]; }), ys = rows.map(function (r) { return r[yi]; });
    var xmax = Math.max.apply(null, xs), ymax = Math.max.apply(null, ys), ymin = Math.min.apply(null, ys);
    var a = { L: 62, T: 16, pw: 540, ph: 320 };
    a.xs = nice(0, xmax * 1.05, 8); a.x0 = 0; a.x1 = Math.ceil(xmax * 1.02 / a.xs) * a.xs;
    if (kind === 'boyle') { a.ys = nice(0, ymax * 1.05, 8); a.y0 = 0; a.y1 = Math.ceil(ymax * 1.02 / a.ys) * a.ys; }
    else { var pad = Math.max((ymax - ymin) * 0.6, ymax * 0.02); a.ys = nice(ymin - pad, ymax + pad * 0.4, 8); a.y0 = Math.max(0, Math.floor((ymin - pad) / a.ys) * a.ys); a.y1 = Math.ceil((ymax + pad * 0.3) / a.ys) * a.ys; }
    a.X = function (v) { return a.L + (v - a.x0) / (a.x1 - a.x0) * a.pw; }; a.Y = function (v) { return a.T + a.ph - (v - a.y0) / (a.y1 - a.y0) * a.ph; };
    return a;
  }
  function fmt(v) { return +v.toFixed(3); }
  function trendCurves(rows, xi, yi, kind) {
    if (kind === 'boyle') {
      var k = rows.reduce(function (t, r) { return t + r[0] * r[1]; }, 0) / rows.length, k0 = rows[0][0] * rows[0][1];
      return { trend: function (x) { return k / x; }, theory: function (x) { return k0 / x; }, at: function (x) { return k0 / x; }, note: '처음 상태(' + rows[0][xi] + ' 기압, ' + rows[0][yi] + ' mL)에서 압력×부피가 ' + (+k0.toFixed(2)) + '로 일정하다고 보고 계산했어요.' };
    }
    var n = rows.length, sx = 0, sy = 0, sxx = 0, sxy = 0; rows.forEach(function (r) { sx += r[xi]; sy += r[yi]; sxx += r[xi] * r[xi]; sxy += r[xi] * r[yi]; });
    var m = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1), b0 = (sy - m * sx) / n, t0 = rows[0][xi], v0 = rows[0][yi];
    return { trend: function (x) { return b0 + m * x; }, theory: function (x) { return v0 * (273 + x) / (273 + t0); }, at: function (x) { return v0 * (273 + x) / (273 + t0); }, note: '처음 상태(' + t0 + ' ℃, ' + v0 + ')에서 샤를 법칙대로 온도가 1 ℃ 오를 때마다 일정하게 늘어난다고 보고 계산했어요.' };
  }
  function graphSVG(a, rows, xi, yi, placed, kind, K, u, done, cls) {
    var s = '<svg id="gsvg" viewBox="0 0 620 390" class="graph' + (done ? '' : ' live') + '" role="img" aria-label="' + K.cols[xi] + '과 ' + K.cols[yi] + '의 그래프">', v, mi;
    function sub(st) { var p10 = Math.pow(10, Math.floor(Math.log10(st) + 1e-9)), f = Math.round(st / p10 * 10) / 10; return st / (f === 2 ? 4 : 5); }
    var mx = sub(a.xs), my = sub(a.ys);
    for (mi = a.x0; mi <= a.x1 + 1e-9; mi += mx) s += '<line x1="' + a.X(mi) + '" x2="' + a.X(mi) + '" y1="' + a.T + '" y2="' + (a.T + a.ph) + '" class="gm"/>';
    for (mi = a.y0; mi <= a.y1 + 1e-9; mi += my) s += '<line x1="' + a.L + '" x2="' + (a.L + a.pw) + '" y1="' + a.Y(mi) + '" y2="' + a.Y(mi) + '" class="gm"/>';
    for (v = a.x0; v <= a.x1 + 1e-9; v += a.xs) s += '<line x1="' + a.X(v) + '" x2="' + a.X(v) + '" y1="' + a.T + '" y2="' + (a.T + a.ph) + '" class="gl"/><text x="' + a.X(v) + '" y="' + (a.T + a.ph + 20) + '" text-anchor="middle" class="gt">' + fmt(v) + '</text>';
    for (v = a.y0; v <= a.y1 + 1e-9; v += a.ys) s += '<line x1="' + a.L + '" x2="' + (a.L + a.pw) + '" y1="' + a.Y(v) + '" y2="' + a.Y(v) + '" class="gl"/><text x="' + (a.L - 8) + '" y="' + (a.Y(v) + 5) + '" text-anchor="end" class="gt">' + fmt(v) + '</text>';
    s += '<path d="M' + a.L + ' ' + a.T + 'V' + (a.T + a.ph) + 'H' + (a.L + a.pw) + '" class="gax"/><text x="' + (a.L + a.pw / 2) + '" y="384" text-anchor="middle" class="gn">' + K.cols[xi] + ' (' + u[xi] + ')</text><text x="16" y="' + (a.T + a.ph / 2) + '" text-anchor="middle" class="gn" transform="rotate(-90 16 ' + (a.T + a.ph / 2) + ')">' + K.cols[yi] + ' (' + u[yi] + ')</text>';
    if (cls) cls.forEach(function (g) { g.rows.forEach(function (r) { var px = kind === 'boyle' ? r[1] : r[0], py = kind === 'boyle' ? r[0] : r[1]; if (g.color) { px = r[xi]; py = r[yi]; } if (px >= a.x0 && px <= a.x1 && py >= a.y0 && py <= a.y1) s += '<circle cx="' + a.X(px) + '" cy="' + a.Y(py) + '" r="' + (g.me ? 6.5 : 5.5) + '" class="gc"' + (g.color ? ' style="fill:' + g.color + ';opacity:.85"' : '') + '/>'; }); });
    var ex = graphSVG.extra || {};
    if (ex.guide != null) s += '<line x1="' + a.X(ex.guide) + '" x2="' + a.X(ex.guide) + '" y1="' + a.T + '" y2="' + (a.T + a.ph) + '" class="gguide"/>';
    if (ex.guideY != null) s += '<line x1="' + a.L + '" x2="' + (a.L + a.pw) + '" y1="' + a.Y(ex.guideY) + '" y2="' + a.Y(ex.guideY) + '" class="gguide"/>';
    if (ex.miss) s += '<g class="gmiss" transform="translate(' + ex.miss[0].toFixed(1) + ' ' + ex.miss[1].toFixed(1) + ')"><path d="M-8-8L8 8M8-8L-8 8"/></g>';
    if (ex.trend) {
      var tc = trendCurves(rows, xi, yi, kind), path = function (fn) { var d = '', j, x, y; for (j = 0; j <= 80; j++) { x = a.x0 + (a.x1 - a.x0) * j / 80; if (kind === 'boyle' && x < (a.x1 - a.x0) * 0.08) continue; y = fn(x); if (y < a.y0 || y > a.y1) continue; d += (d ? 'L' : 'M') + a.X(x).toFixed(1) + ' ' + a.Y(y).toFixed(1); } return d; };
      s += '<path d="' + path(tc.theory) + '" class="gtheo"/><path d="' + path(tc.trend) + '" class="gtrend"/>' +
        '<g class="glegend" transform="translate(' + (a.L + a.pw - 196) + ' ' + (a.T + 8) + ')"><rect width="190" height="54" rx="8"/><path d="M10 18h30" class="gtrend"/><text x="48" y="23">우리 모둠 경향선</text><path d="M10 40h30" class="gtheo"/><text x="48" y="45">이론값</text></g>';
    }
    rows.forEach(function (r, j) { if (j < placed) s += '<circle cx="' + a.X(r[xi]) + '" cy="' + a.Y(r[yi]) + '" r="7" class="gp"/>'; });
    return s + '</svg>';
  }
  DONE.data = function (d, st, i) { var D = S.data[st.kind]; return !!(D && D.locked && D.placed >= validRows(D).length && D.trendOK && allRight(pfx(d, i), st.items)); };
  TODO.data = '표를 채우고, 점을 찍고, 경향선을 그리고, 질문에 답해요';

  // 입자로 설명하기 (변화 사슬)
  STEP.chain = function (d, st, i) {
    var C = S.chain[d.id] = S.chain[d.id] || { sel: [], ok: false };
    var h = '<div class="card chain"><p class="scene"><b>상황</b> ' + st.scene + '</p><ol class="links">';
    st.slots.forEach(function (sl, j) {
      h += '<li><span class="ll">' + sl.label + '</span><div class="copts">' + sl.opts.map(function (o, k) {
        var cls = 'copt' + (C.sel[j] === k ? ' on' : '') + (C.checked && C.sel[j] === k ? (k === sl.a ? ' ok' : ' no') : '');
        return '<button class="' + cls + '" data-act="chain" data-j="' + j + '" data-k="' + k + '"' + (C.ok ? ' disabled' : '') + '>' + esc(o) + '</button>';
      }).join('') + '</div></li>';
    });
    h += '</ol>' + (C.ok ? '<p class="fb ok"><b>설명이 완성됐어요.</b> 위에서부터 이어서 소리 내어 읽어 보세요.</p>' : '<button class="btn pri" data-act="chaincheck">설명 확인하기</button>' + (C.checked ? '<p class="fb no">빨간 칸을 다시 골라 보세요. 입자의 수와 크기는 변하지 않는다는 점을 떠올려요.</p>' : '')) + '</div>';
    return h;
  };
  DONE.chain = function (d) { return !!(S.chain[d.id] && S.chain[d.id].ok); };
  TODO.chain = '네 칸을 모두 골라 설명을 완성해요';

  // 여행 안내 한 줄
  STEP.line = function (d, st) {
    var v = S.lines[d.id] || '', sn = CFG.SNORKL && CFG.SNORKL[d.id];
    return '<div class="card"><p class="prompt">' + st.prompt + '</p><p class="words">꼭 넣을 말: ' + st.words.map(function (w) { return '<span class="w" data-w="' + w + '">' + w + '</span>'; }).join(' ') + '</p><textarea id="line" rows="4" maxlength="300" placeholder="여기에 써 보세요" aria-label="여행 안내 한 줄">' + esc(v) + '</textarea><div class="btns"><button class="btn pri" data-act="saveline">저장</button>' + (sn ? '<a class="btn" target="_blank" rel="noopener" href="' + esc(sn) + '">스노클에서 말로 설명하기</a>' : '') + '</div><p class="tiny" id="linemsg">' + (v ? '저장되어 있어요. 고쳐서 다시 저장할 수 있어요.' : '15자 이상 써서 저장하면 완료돼요.') + '</p></div>';
  };
  AFTER.line = function (d, st) { var ta = $('#line'); function mk() { document.querySelectorAll('.words .w').forEach(function (w) { w.classList.toggle('in', ta.value.indexOf(w.dataset.w) >= 0); }); } ta.addEventListener('input', mk); mk(); };
  DONE.line = function (d) { return (S.lines[d.id] || '').trim().length >= 15; };
  TODO.line = '안내 문장을 써서 저장해요';

  // 개념기반 탐구: 일반화하기 · 생각 나누기 · 돌아보기 · 큰 생각 잇기
  function rerender() { var d = cur.dest, si = cur.sl.si, st = d.steps[si], sb = $('#stepbody'); if (!sb) return; sb.innerHTML = STEP[st.type](d, st, si); if (AFTER[st.type]) AFTER[st.type](d, st, si); }
  function syncThink() { sync('think', { gen: S.gen, deb: S.deb, refl: S.refl, big: S.bigtxt }); }
  function genCompose(st, v) { return st.parts.map(function (p, j) { var x = (v[j] || '').trim(); if (!x) return ''; return (p.pre || '') + x + (p.post || ''); }).filter(Boolean).reduce(function (a, x) { if (a && /^왜냐하면/.test(x) && !/[.,]$/.test(a)) a += '.'; return a ? a + ' ' + x : x; }, '').replace(/\s+/g, ' ').replace(/([^.])$/, '$1.').trim(); }
  function genText(g) { return g ? (g.text || (g.parts ? g.parts.join(' ') : '')) : ''; }
  function ownPairs(kind) {
    var D = S.data && S.data[kind]; if (!D) return ''; var r = validRows(D); if (r.length < 2) return '';
    var K = KIND[kind], u = units(kind, D), a = r[0], b = r[r.length - 1];
    var f = function (x) { return kind === 'boyle' ? x[0] + ' mL일 때 ' + x[1] + ' ' + u[1] : x[0] + ' ℃일 때 ' + x[1] + ' ' + u[1]; };
    return '<li class="own">📊 우리가 잰 값: ' + esc(f(a)) + ', ' + esc(f(b)) + '</li>';
  }
  STEP.gen = function (d, st, i) {
    var g = S.gen[d.id] || {}, prev = st.from && S.gen[st.from], tmp = st.mode === 'tmp', n = st.parts.length;
    var pst = st.from && (T.dests.filter(function (x) { return x.id === st.from; })[0] || { steps: [] }).steps.filter(function (x) { return x.type === 'gen'; })[0], vals = (g.parts || []).slice(), pre = false; if (!g.parts && prev && prev.parts && pst) prev.parts.forEach(function (x, j) { if (j < n && (pst.parts[j].pre || '') === (st.parts[j].pre || '')) { vals[j] = x; pre = true; } });
    var h = '<div class="card genq"><p class="cqlab">🧭 탐구 질문</p><p class="cqtx">' + st.q + '</p></div>';
    if (prev && genText(prev)) h += '<div class="card genprev"><p class="tiny">📒 ' + (T.dests.filter(function (x) { return x.id === st.from; })[0] || {}).period + '에 쓴 내 문장' + (pre ? ' · 아래 칸에 미리 넣어 두었어요. 오늘 사례에도 맞는지 보고 고치고, 입자로 까닭을 붙여요.' : ' · 오늘 사례까지 넣어 더 넓게 들어맞는 문장으로 다듬어요.') + '</p><p>“' + esc(genText(prev)) + '”</p></div>';
    h += '<div class="card"><p class="h4">🔎 증거로 쓸 사례</p><ul class="gcases">' + st.cases.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + (st.own ? ownPairs(st.own) : '') + '</ul></div>';
    h += '<div class="card"><p class="h4">✍️ ' + (tmp ? '사례들에 공통으로 들어맞는 규칙을 한 문장으로 써요' : '모든 사례에 들어맞는 일반화 문장을 써요') + '</p><div class="gparts">' + st.parts.map(function (pt, j) { return '<label class="gpart"><span class="glab">' + (j + 1) + '. ' + esc(pt.lab) + '</span><span class="grow">' + (pt.pre ? '<em>' + esc(pt.pre) + '</em>' : '') + '<input class="gin" data-j="' + j + '" maxlength="120" placeholder="' + esc(pt.ph) + '" value="' + esc(vals[j] || '') + '">' + (pt.post ? '<em>' + esc(pt.post) + '</em>' : '') + '</span></label>'; }).join('') + '</div>' +
      '<p class="words">꼭 넣을 말: ' + st.words.map(function (w) { return '<span class="w" data-w="' + w + '">' + w + '</span>'; }).join(' ') + '</p><p class="gprev" id="gprev"></p><div class="btns"><button class="btn pri" data-act="gensave">저장</button>' + ((CFG.SNORKL && CFG.SNORKL[d.id]) ? '<a class="btn" target="_blank" rel="noopener" href="' + esc(CFG.SNORKL[d.id]) + '">스노클에서 말로 설명하기</a>' : '') + '</div><p class="tiny" id="genmsg" aria-live="polite"></p></div>';
    if (g.parts) {
      var ck = g.ck || {}, items = ['개념 두 가지 이상을 이어서 썼다', '증거로 쓴 사례 모두에 들어맞는다'].concat(tmp ? [] : ['입자로 까닭을 설명했다']);
      h += '<div class="card gcheck"><p class="h4">✅ 스스로 점검하고 짝과 비교해요</p>' + items.map(function (t, j) { return '<label class="gck"><input type="checkbox" data-act="genck" data-j="' + j + '"' + (ck[j] ? ' checked' : '') + '> ' + t + '</label>'; }).join('') +
        '<p class="tiny">짝의 문장과 비교해서 빠진 말이 있으면 위 칸을 고쳐 다시 저장해요.</p>' +
        (g.cmp ? '<div class="gmodel"><p class="tiny">🎓 선배 가이드의 문장 · 내 문장과 무엇이 같고 무엇이 다른가요?</p><p>“' + esc(st.model) + '”</p></div>' : '<button class="btn" data-act="gencmp"' + (Object.keys(ck).filter(function (k) { return ck[k]; }).length < items.length ? ' disabled' : '') + '>선배 가이드의 문장과 비교하기</button>') + '</div>';
    }
    return h;
  };
  AFTER.gen = function (d, st) {
    function mk() { var t = [].map.call(document.querySelectorAll('.gin'), function (x) { return x.value.trim(); }); var all = t.join(' '); $('#gprev').textContent = all.trim() ? '→ ' + genCompose(st, t) : ''; document.querySelectorAll('.words .w').forEach(function (w) { w.classList.toggle('in', all.indexOf(w.dataset.w) >= 0); }); }
    document.querySelectorAll('.gin').forEach(function (x) { x.addEventListener('input', mk); }); mk();
  };
  DONE.gen = function (d, st) { var g = S.gen[d.id]; return !!(g && g.parts && g.parts.every(function (x) { return x && x.trim().length >= 2; }) && g.cmp); };
  TODO.gen = '문장을 저장하고, 점검한 뒤 선배 가이드의 문장과 비교해요';

  STEP.debate = function (d, st) {
    var v = S.deb[d.id] || {};
    return '<div class="card genq deb"><p class="cqlab">💬 생각 나누기 · 정답이 하나로 정해진 질문이 아니에요</p><p class="cqtx">' + st.q + '</p></div><div class="card"><p class="h4">내 생각은?</p><div class="seg dseg">' + st.opts.map(function (o, j) { return '<button data-act="debpick" data-j="' + j + '" class="' + (v.pick === j ? 'on' : '') + '" aria-pressed="' + (v.pick === j) + '">' + esc(o) + '</button>'; }).join('') + '</div>' +
      '<p class="h4">그렇게 생각한 까닭 (근거가 된 실험이나 사례를 넣어요)</p><textarea id="debtx" rows="3" maxlength="300" placeholder="왜냐하면 …">' + esc(v.why || '') + '</textarea><div class="btns"><button class="btn pri" data-act="debsave">저장</button></div><p class="tiny" id="debmsg" aria-live="polite"></p></div>' +
      (v.pick != null && (v.why || '').trim().length >= 10 ? '<div class="card gmodel"><p class="h4">🤔 생각할 거리</p><p>' + esc(st.think) + '</p><p class="tiny">짝이나 모둠 친구와 서로 다른 생각을 나눠 보세요. 생각이 바뀌었다면 위 칸을 고쳐 다시 저장해도 돼요.</p></div>' : '');
  };
  DONE.debate = function (d) { var v = S.deb[d.id]; return !!(v && v.pick != null && (v.why || '').trim().length >= 10); };
  TODO.debate = '내 생각을 고르고 까닭을 10자 이상 써서 저장해요';

  var REFL = ['생각이 바뀌었어요', '더 확실해졌어요', '아직 궁금한 게 있어요'];
  STEP.reflect = function (d) {
    var v = S.refl[d.id] || {}, h = '<div class="card"><p class="h4">🔮 처음 내 예측</p><ul class="rpred">';
    d.steps.forEach(function (st, si) { if (st.type !== 'predict') return; st.items.forEach(function (it, j) { var a = S.ans[pfx(d, si) + j], f = a ? a.first : null; h += '<li><span>' + esc(it.q) + '</span><b class="' + (f === it.a ? 'ok' : f == null ? '' : 'no') + '">' + (f == null ? '답하지 않음' : esc(it.opts[f])) + (f === it.a ? ' ✓' : f == null ? '' : ' → 지금은 ' + esc(it.opts[it.a])) + '</b></li>'; }); });
    h += '</ul></div>';
    var g = S.gen[d.id]; if (g && genText(g)) h += '<div class="card"><p class="h4">📒 오늘 내가 만든 문장</p><p>“' + esc(genText(g)) + '”</p></div>';
    h += '<div class="card"><p class="h4">오늘 내 생각은</p><div class="seg dseg">' + REFL.map(function (o, j) { return '<button data-act="reflpick" data-j="' + j + '" class="' + (v.pick === j ? 'on' : '') + '" aria-pressed="' + (v.pick === j) + '">' + o + '</button>'; }).join('') + '</div>' +
      '<textarea id="refltx" rows="2" maxlength="200" placeholder="' + (v.pick === 2 ? '아직 궁금한 것: …' : v.pick === 0 ? '처음에는 … 라고 생각했는데, 지금은 …' : '… 덕분에 더 확실해졌어요') + '">' + esc(v.tx || '') + '</textarea><div class="btns"><button class="btn pri" data-act="reflsave">저장</button></div><p class="tiny" id="reflmsg" aria-live="polite"></p></div>';
    return h;
  };
  DONE.reflect = function (d) { var v = S.refl[d.id]; return !!(v && v.pick != null && (v.tx || '').trim().length >= 5); };
  TODO.reflect = '하나를 고르고 한 줄을 써서 저장해요';

  STEP.bigidea = function () {
    var ids = [['T2', 'T1'], ['T4', 'T3'], ['T6', 'T5']].map(function (x) { return genText(S.gen[x[0]]) ? x[0] : genText(S.gen[x[1]]) ? x[1] : x[0]; }), h = '<div class="card genq"><p class="cqlab">🧭 이번 여행의 큰 질문</p><p class="cqtx">' + T.big.q + '</p></div><div class="card"><p class="h4">📒 내가 만든 일반화 세 문장</p><ol class="gnote">';
    ids.forEach(function (id) { var dd = T.dests.filter(function (x) { return x.id === id; })[0]; h += '<li><small>' + dd.period + ' · ' + T.stds[dd.std].short + '</small>' + (genText(S.gen[id]) ? esc(genText(S.gen[id])) : '<em>아직 쓰지 않았어요</em>') + '</li>'; });
    h += '</ol></div><div class="card"><p class="h4">✍️ 세 문장에 공통으로 들어 있는 생각을 이어서, 큰 질문에 한두 문장으로 답해요</p><p class="words">꼭 넣을 말: <span class="w" data-w="입자">입자</span> <span class="w" data-w="충돌">충돌</span></p><textarea id="bigtx" rows="3" maxlength="300" placeholder="보이지 않는 기체의 행동은 …">' + esc(S.bigtxt || '') + '</textarea><div class="btns"><button class="btn pri" data-act="bigsave">저장</button></div><p class="tiny" id="bigmsg" aria-live="polite"></p></div>';
    if ((S.bigtxt || '').trim().length >= 15) h += '<div class="card gmodel"><p class="h4">🎓 이 단원의 핵심 아이디어</p><p>“' + esc(T.big.idea) + '”</p><p class="tiny">내 문장과 비교해 보세요. 개념 렌즈: ' + esc(T.big.lens) + '</p></div>';
    return h;
  };
  AFTER.bigidea = function () { var ta = $('#bigtx'); function mk() { document.querySelectorAll('.words .w').forEach(function (w) { w.classList.toggle('in', ta.value.indexOf(w.dataset.w) >= 0); }); } ta.addEventListener('input', mk); mk(); };
  DONE.bigidea = function () { return (S.bigtxt || '').trim().length >= 15; };
  TODO.bigidea = '큰 질문에 답하는 문장을 15자 이상 써서 저장해요';


  // 연습 문제
  STEP.quiz = function (d, st, i) {
    var h = st.ids.map(function (id, j) { return mcq('p.' + id, T.pool[id], 'quiz', j + 1); }).join('');
    return h + '<div id="qsum"></div>';
  };
  AFTER.quiz = function (d, st) { quizSum(st); };
  function quizSum(st) { var n = 0, ok = 0; st.ids.forEach(function (id) { var a = S.ans['p.' + id]; if (a) { n++; if (a.c === T.pool[id].a) ok++; } }); var el = $('#qsum'); if (el) el.innerHTML = n === st.ids.length ? '<p class="sum">' + st.ids.length + '문제 중 <b>' + ok + '문제</b>를 맞혔어요.' + (ok < st.ids.length ? ' 틀린 문제의 풀이를 읽어 보세요.' : '') + ' <button class="linkbtn" data-act="requiz">다시 풀기</button></p>' : ''; }
  DONE.quiz = function (d, st) { return st.ids.every(function (id) { return S.ans['p.' + id]; }); };
  TODO.quiz = '문제를 모두 풀어요';

  // 부스
  STEP.booth = function () {
    var h = '<div class="card"><p>부스 웹앱에서 실험 방법과 입자 모형을 볼 수 있어요.</p><a class="btn yel wide" target="_blank" rel="noopener" href="' + esc(CFG.BOOTH_URL || boothURL('')) + '">🎪 부스 웹앱 열기</a></div><div class="card"><h3>체험한 부스에 표시해요</h3><div class="bl">';
    T.booths.forEach(function (b) { var on = S.booths.indexOf(b[0]) >= 0; h += '<button class="bchip' + (on ? ' on' : '') + '" data-act="booth" data-c="' + b[0] + '" aria-pressed="' + on + '">' + (on ? '✓ ' : '') + b[1] + '</button>'; });
    return h + '</div><p class="tiny">세 곳 이상 체험하면 완료돼요. 우리 반에서 운영하지 않는 부스도 목록에 있을 수 있어요.</p></div>';
  };
  DONE.booth = function () { return S.booths.length >= 3; };
  TODO.booth = '부스를 세 곳 이상 체험해요';

  // 자격시험
  var EX = null;
  STEP.exam = function () { return '<div id="exam"></div>'; };
  AFTER.exam = function () { drawExam(); };
  function examAll() {
    return '<div class="card"><h3>🧑‍🏫 전체 문항 보기 · 정답과 풀이</h3><p class="tiny">선생님 화면에서만 보여요. 학생은 한 문제씩 풀어요.</p></div>' + T.exam.map(function (id, n) {
      var it = T.pool[id];
      return '<div class="mcq"><p class="q"><span class="qn">' + (n + 1) + '</span>' + esc(it.q).replace(/\n/g, '<br>') + ' <span class="tag">' + T.stds[it.std].short + '</span></p><div class="opts' + (it.opts[0].fig ? ' figs' : '') + '">' +
        it.opts.map(function (o, i) { return '<button class="opt' + (i === it.a ? ' ok' : '') + '" disabled>' + (o.fig ? figSVG(o.fig, it.fx, it.fy) : '<span class="on">' + '①②③④⑤'[i] + '</span>' + esc(o)) + '</button>'; }).join('') +
        '</div><p class="fb ok"><b>정답 ' + '①②③④⑤'[it.a] + '. </b>' + esc(it.ex) + '</p></div>';
    }).join('');
  }
  function drawExam() {
    var el = $('#exam'); if (!el) return; var h = '';
    if (!EX && isT() && sessionStorage.getItem('gastrip.tpin')) { el.innerHTML = examAll(); return; }
    if (!EX) {
      h = '<div class="card"><h3>시험 안내</h3><ul class="plain"><li>모두 20문항이에요. 한 문제씩 풀고 바로 풀이를 확인해요.</li><li>14문항 이상 맞히면 입자 가이드 자격을 얻어요.</li><li>끝나면 틀린 문제만 다시 풀 수 있어요.</li></ul>' + (S.exam ? '<p>지난 기록: <b>' + S.exam.last + ' / ' + S.exam.total + '</b> (최고 ' + S.exam.best + ')</p>' : '') + '<div class="btns"><button class="btn pri" data-act="exstart">시험 시작</button>' + (S.exam && S.exam.wrong.length ? '<button class="btn" data-act="exwrong">틀린 ' + S.exam.wrong.length + '문제 다시 풀기</button>' : '') + '</div></div>';
    } else if (EX.i < EX.ids.length) {
      var id = EX.ids[EX.i], key = 'x.' + EX.run + '.' + id;
      h = '<p class="exprog"><b>' + (EX.i + 1) + '</b> / ' + EX.ids.length + ' <span class="pb"><i style="width:' + (EX.i / EX.ids.length * 100) + '%"></i></span></p>' + mcq(key, T.pool[id], 'quiz', 0) + (S.ans[key] ? '<div class="btns"><button class="btn pri" data-act="exnext">' + (EX.i + 1 < EX.ids.length ? '다음 문제' : '결과 보기') + '</button></div>' : '');
    } else {
      var ok = EX.ids.length - EX.wrong.length, pass = !EX.retry && ok >= 14;
      h = '<div class="card result"><h3>' + (EX.retry ? '다시 풀기 결과' : '시험 결과') + '</h3><p class="score"><b>' + ok + '</b> / ' + EX.ids.length + '</p>' + (EX.retry ? '' : pass ? '<div class="cert"><p class="c1">입자 가이드 자격증</p><p class="c2">' + esc(S.profile.name) + '</p><p class="c3">위 사람은 보이지 않는 입자로 기체의 변화를 설명할 수 있으므로 이 자격증을 드립니다.</p><p class="c4">기체 안전 여행사</p></div>' : '<p>14문항 이상 맞히면 자격을 얻어요. 틀린 문제를 다시 풀고 재도전해요.</p>') +
        (EX.wrong.length ? '<h4>틀린 문제</h4><ul class="plain">' + EX.wrong.map(function (id) { return '<li>' + esc(T.pool[id].q.split('\n')[0]) + ' <span class="tag">' + T.stds[T.pool[id].std].short + '</span></li>'; }).join('') + '</ul>' : '<p>모두 맞혔어요!</p>') +
        '<div class="btns">' + (EX.wrong.length ? '<button class="btn pri" data-act="exwrong">틀린 문제 다시 풀기</button>' : '') + '<button class="btn" data-act="exstart">처음부터 다시</button></div></div>';
    }
    el.innerHTML = h;
  }
  function examStart(ids, retry) { EX = { ids: ids.slice(), i: 0, wrong: [], retry: retry, run: Date.now() % 100000 }; drawExam(); var sb = $('#stgbody'); if (sb) sb.scrollTop = 0; }
  function examFinish() {
    if (!EX.retry) { var ok = EX.ids.length - EX.wrong.length; S.exam = { last: ok, total: EX.ids.length, best: Math.max(ok, S.exam ? S.exam.best : 0), wrong: EX.wrong.slice(), ts: Date.now() }; }
    else if (S.exam) { S.exam.wrong = EX.wrong.slice(); S.flags.retry = 1; }
    if (S.exam) mile('exam', S.exam.best * 2);
    Object.keys(S.ans).forEach(function (k) { if (k.indexOf('x.') === 0) delete S.ans[k]; });
    save(); syncProgress(); check();
  }
  DONE.exam = function () { return !!S.exam; };
  TODO.exam = '시험을 끝까지 풀어요';

  /* ---------- 클릭 처리 ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.dataset.act, d = cur.dest, i = cur.step, st = d && d.steps[i];
    if (act === 'mcq') {
      var key = b.dataset.key, m = MCQ[key], c = +b.dataset.i; if (!m) return;
      var firstTry = !S.ans[key], right = c === m.item.a;
      S.ans[key] = { c: c, first: firstTry ? c : S.ans[key].first }; save();
      if (m.mode === 'free') mile('a.' + key, right ? 3 : 2);
      else {
        if (firstTry) { S.combo = right ? (S.combo || 0) + 1 : 0; if (S.combo >= 3) S.flags.c3 = 1; if (S.combo >= 5) S.flags.c5 = 1; save(); if (S.combo === 3 || S.combo === 5) mile('combo' + S.combo, S.combo); }
        if (key.indexOf('x.') !== 0 && (right || m.mode === 'quiz')) mile('a.' + key, right ? (S.ans[key].first === m.item.a ? 3 : 1) : 1);
      }
      if (EX && key.indexOf('x.') === 0) { if (c !== m.item.a) EX.wrong.push(EX.ids[EX.i]); drawExam(); return; }
      var el = document.getElementById('q-' + key); el.outerHTML = mcq(key, m.item, m.mode, m.no);
      if (st && st.type === 'quiz') { quizSum(st); sync('quiz', quizScores()); }
      check();
    }
    else if (act === 'go') go(+b.dataset.d);
    else if (act === 'sconn') sConnect();
    else if (act === 'sdisc') sDisconnect();
    else if (act === 'szero') sZero();
    else if (act === 'srec') {
      var pk = sNow(); if (pk == null) return; pk = pk / 101.325; readRows('boyle'); var SD = S.data.boyle, vv = b.dataset.v, put = false;
      SD.unit = '기압'; SD.sample = false;
      for (var ri = 0; ri < SD.rows.length; ri++) if (SD.rows[ri][0] === vv) { SD.rows[ri][1] = pk.toFixed(2); put = true; break; }
      if (!put) { for (ri = 0; ri < SD.rows.length; ri++) if (SD.rows[ri][0] === '' && SD.rows[ri][1] === '') { SD.rows[ri] = [vv, pk.toFixed(2)]; put = true; break; } }
      if (!put) SD.rows.push([vv, pk.toFixed(2)]);
      save(); drawData(d, st, i); chip(vv + ' mL → ' + pk.toFixed(2) + ' 기압'); var D7 = S.data[st.kind] || {}; if (vv === (D7.part === 'e' ? '8' : '7')) setTimeout(function () { chip('다 쟀어요! 피스톤을 20 mL로 돌리고 ‘내 차례 끝 · 연결 끊기’를 눌러 다음 친구에게 넘겨요'); }, 1600);
    }
    else if (act === 'vrec') { var vk = sNow(); if (vk == null) return; vacPush(vk / 101.325); drawVac(d, st, i); check(); }
    else if (act === 'vadd') { var vi = $('#vacin'), vv2 = parseFloat(vi.value); if (!(vv2 > 0 && vv2 < 1.3)) { chip('0에서 1.3 사이의 기압을 써요'); return; } vacPush(vv2); vi.value = ''; drawVac(d, st, i); check(); }
    else if (act === 'vgather') vGather(d, st, i);
    else if (act === 'vmine') { vacS().gather = null; save(); drawVac(d, st, i); }
    else if (act === 'vundo') { vacS().rows.pop(); save(); drawVac(d, st, i); check(); }
    else if (act === 'vclear') { if (!confirmBox(b, '한 번 더 누르면 기록이 모두 지워져요')) return; var VV = vacS(); VV.rows = []; VV.sample = false; save(); b.removeAttribute('data-sure'); b.textContent = '처음부터 다시'; drawVac(d, st, i); check(); }
    else if (act === 'vsample') { var VS = vacS(); VS.rows = VACS.map(function (r) { return r.slice(); }); VS.sample = true; save(); drawVac(d, st, i); check(); }
    else if (act === 'ppull' && sim && sim.pull) sim.pull();
    else if (act === 'ppush' && sim && sim.push) sim.push();
    else if (act === 'pauto' && sim && sim.auto) sim.auto();
    else if (act === 'preset' && sim && sim.reset) sim.reset();
    else if (act === 'celebok') { var ce = $('.celeb'); if (ce) ce.remove(); if (cur && !cur.dest && b.tagName !== 'A') viewHome(); }
    else if (act === 'eye') { var pi = b.previousElementSibling, sh = pi.classList.toggle('show'); b.textContent = sh ? '숨김' : '보기'; }
    else if (act === 'gteach') { $('#gtbox').hidden = !$('#gtbox').hidden; if (!$('#gtbox').hidden) $('#gpin').focus(); }
    else if (act === 'gtgo') { var gv = $('#gpin').value.trim(); $('#gmsg2').textContent = '확인 중…'; checkPin(gv, function () { sessionStorage.setItem('gastrip.tpin', gv); location.hash = '#teacher'; route(); }, function (why) { $('#gmsg2').innerHTML = '<b class="warn">' + (why || '교사 비밀번호가 달라요.') + '</b>'; }); }
    else if (act === 'gguest') { $('#ggbox').hidden = !$('#ggbox').hidden; }
    else if (act === 'ggo') { sessionStorage.setItem('gastrip.guest', '1'); for (var gk in S) if (gk !== 'profile') S[gk] = Array.isArray(S[gk]) ? [] : (S[gk] && typeof S[gk] === 'object') ? {} : (typeof S[gk] === 'number' ? 0 : null); S.profile = { cls: '0', num: '0', name: '참관 선생님' }; location.hash = '#home'; route(); }
    else if (act === 'bdg') { $('#bdgmsg').innerHTML = '<b>' + b.dataset.n + '</b> — ' + b.dataset.d; }
    else if (act === 'look') { S.look = S.look || {}; S.look[b.dataset.k] = b.dataset.v; save(); var y1 = window.scrollY; viewHome(); window.scrollTo(0, y1); }
    else if (act === 'lookrand') { S.look = {}; for (var lk in LOOK) { var arr = LOOK[lk]; S.look[lk] = arr[Math.floor(Math.random() * arr.length)][0]; } if (S.look.move === 'off') S.look.move = 'right'; save(); var y2 = window.scrollY; viewHome(); window.scrollTo(0, y2); }
    else if (act === 'lookreset') { S.look = {}; save(); var y3 = window.scrollY; viewHome(); window.scrollTo(0, y3); }
    else if (act === 'wear') { if (b.dataset.lock) PREV = PREV === b.dataset.id ? null : b.dataset.id; else { PREV = null; S.wear[b.dataset.id] = !S.wear[b.dataset.id]; save(); } var y = window.scrollY; viewHome(); window.scrollTo(0, y); }
    else if (act === 'blank') { b.classList.add('on'); b.removeAttribute('data-act'); if (!document.querySelector('.blank:not(.on)')) { S.seen[pfx(d, i) + cur.sl.j] = 1; save(); mile('c.' + pfx(d, i) + cur.sl.j, 2); } check(); }
    else if (act === 'lab') { S.lab.press[b.dataset.k] = b.dataset.v; drawLab(d, st, i); check(); }
    else if (act === 'labreplay') drawLab(d, st, i);
    else if (act === 'spart') { var DP = S.data[st.kind] = S.data[st.kind] || {}; DP.part = b.dataset.p; save(); document.querySelectorAll('.spart button').forEach(function (x3) { x3.classList.toggle('on', x3 === b); }); var sv = $('.svols'); if (sv) sv.className = 'svols part-' + (DP.part || 'a'); chip(DP.part === 'e' ? '20, 18, 16 … 8 mL를 재요' : DP.part === 'o' ? '19, 17, 15 … 7 mL를 재요' : '20부터 7 mL까지 모두 재요'); }
    else if (act === 'road') roadGo(+b.dataset.r);
    else if (act === 'roadg') slideGo(+b.dataset.t);
    else if (act === 'sblank') { b.classList.add('on'); b.removeAttribute('data-act'); if (!document.querySelector('.blank[data-act=sblank]')) { S.seen['sum.' + d.id] = 1; save(); mile('sum.' + d.id, 2); } }
    else if (act === 'extab') { S.seen[pfx(d, i) + 'xi'] = +b.dataset.j; save(); if (sim) { sim.stop(); sim = null; } document.querySelectorAll('.extabs button').forEach(function (x2) { x2.classList.toggle('on', x2 === b); }); exSimInit(d, st, i); }
    else if (act === 'expdone') { S.seen[pfx(d, i) + 'ea'] = 1; save(); b.outerHTML = '<span class="tag okt">✓ 실험 완료</span>'; check(); }
    else if (act === 'whynext') { var wk = pfx(d, i) + 'wy'; S.seen[wk] = (S.seen[wk] || 0) + 1; save(); var sb = $('#stgbody'), y = sb ? sb.scrollTop : 0; route(); var sb2 = $('#stgbody'); if (sb2) sb2.scrollTop = y; }
    else if (act === 'eblank') { b.classList.add('on'); b.removeAttribute('data-act'); if (!document.querySelector('.blank[data-act=eblank]')) { S.seen[pfx(d, i) + 'ef'] = 1; save(); mile('f.' + pfx(d, i), 2); } check(); }
    else if (act === 'addrow') { readRows(st.kind); S.data[st.kind].rows.push(['', '']); save(); drawData(d, st, i); }
    else if (act === 'sample') { var K = KIND[st.kind], D = getData(st.kind); D.rows = K.sample.map(function (r) { return [String(r[0]), String(r[1])]; }); D.unit = K.sampleUnit; D.sample = true; save(); drawData(d, st, i); }
    else if (act === 'lock') {
      readRows(st.kind); var D2 = S.data[st.kind], rows = validRows(D2);
      if (rows.length < 4) { $('#dmsg').innerHTML = '<b class="warn">숫자로 된 측정값이 4개 이상 필요해요.</b> 지금은 ' + rows.length + '개예요.'; return; }
      D2.locked = true; D2.placed = 0; D2.fails = 0; D2.missed = 0; D2.miss = null; D2.trendOK = 0; D2.trendPick = null; save(); if (!D2.sample && !D2.avg) sync(st.kind, { group: D2.group, unit: D2.unit, rows: rows, sample: false }); drawData(d, st, i); check(); var gmv = $('#gmsg'); if (gmv && gmv.scrollIntoView) gmv.scrollIntoView({ block: 'start' });
    }
    else if (act === 'unlock') { if (!confirmBox(b, '한 번 더 누르면 표가 비워지고 처음부터 다시 측정해요')) return; var D3 = S.data[st.kind]; D3.locked = false; D3.placed = 0; D3.sample = false; D3.avg = 0; D3.rows = []; D3.gather = null; D3.trendOK = 0; D3.trendPick = null; D3.miss = null; save(); drawData(d, st, i); check(); }
    else if (act === 'trend') { var D5 = S.data[st.kind], rt = st.kind === 'boyle' ? 'inv' : 'upi'; D5.trendPick = b.dataset.v; if (b.dataset.v === rt) { D5.trendOK = 1; mile('trend.' + st.kind, 4); } save(); drawData(d, st, i); check(); var tb = document.querySelector('.trendopts'); if (tb && D5.trendOK) tb.closest('.card').scrollIntoView({ block: 'start' }); }
    else if (act === 'autoplace') { var D4 = S.data[st.kind]; D4.placed++; D4.fails = 0; D4.missed = 1; D4.miss = null; save(); drawData(d, st, i); check(); }
    else if (act === 'classdata') { classData(st.kind, 'class'); }
    else if (act === 'gradedata') { classData(st.kind, 'grade'); }
    else if (act === 'gather') { gather(d, st, i); }
    else if (act === 'useavg') {
      var DA = S.data[st.kind], av = avgRows(st.kind, [].concat.apply([], DA.gather.members.map(function (m) { return m.rows; })));
      if (av.length < 4) { toast('<p>평균을 낼 자료가 4개 이상 필요해요.</p>'); return; }
      DA.rows = av.map(function (r) { return [String(r[0]), String(+r[1].toFixed(2))]; }); DA.avg = 1; DA.sample = false;
      DA.locked = true; DA.placed = 0; DA.fails = 0; DA.missed = 0; DA.miss = null; DA.trendOK = 0; DA.trendPick = null; save(); drawData(d, st, i); check(); window.scrollTo(0, 0); var sb2 = $('#stgbody'); if (sb2) sb2.scrollTop = 0;
    }
    else if (act === 'chain') { var C = S.chain[d.id]; C.sel[+b.dataset.j] = +b.dataset.k; C.checked = false; save(); $('#stepbody').innerHTML = STEP.chain(d, st, i); }
    else if (act === 'chaincheck') {
      var C2 = S.chain[d.id];
      if (st.slots.some(function (s, j) { return C2.sel[j] == null; })) { toast('<p>네 칸을 모두 골라요.</p>'); return; }
      C2.checked = true; C2.ok = st.slots.every(function (s, j) { return C2.sel[j] === s.a; }); save();
      $('#stepbody').innerHTML = STEP.chain(d, st, i); if (C2.ok) sync('chain', S.chain); check();
    }
    else if (act === 'gensave') { var gst = d.steps[cur.sl.si], gv = [].map.call(document.querySelectorAll('.gin'), function (x) { return x.value.trim(); }), g0 = S.gen[d.id] || {}; if (gv.some(function (x) { return x.length < 2; })) { $('#genmsg').textContent = '모든 칸을 채워 주세요.'; return; } var miss = gst.words.filter(function (w) { return gv.join(' ').indexOf(w) < 0; }); S.gen[d.id] = { parts: gv, text: genCompose(gst, gv), ck: g0.ck || {}, cmp: g0.cmp || false, at: Date.now() }; save(); syncThink(); rerender(); var gm = $('#genmsg'); if (gm) gm.textContent = miss.length ? '저장했어요. ‘' + miss.join('’, ‘') + '’도 넣으면 더 좋아요.' : '저장했어요. 아래에서 스스로 점검해요.'; check(); }
    else if (act === 'genck') { var gg = S.gen[d.id]; if (!gg) return; gg.ck = gg.ck || {}; gg.ck[b.dataset.j] = b.checked; save(); var y5 = window.scrollY; rerender(); window.scrollTo(0, y5); }
    else if (act === 'gencmp') { S.gen[d.id].cmp = true; save(); syncThink(); var y6 = window.scrollY; rerender(); window.scrollTo(0, y6); check(); }
    else if (act === 'debpick') { S.deb[d.id] = S.deb[d.id] || {}; S.deb[d.id].pick = +b.dataset.j; var dt = $('#debtx'); if (dt) S.deb[d.id].why = dt.value; save(); var y7 = window.scrollY; rerender(); window.scrollTo(0, y7); }
    else if (act === 'debsave') { S.deb[d.id] = S.deb[d.id] || {}; S.deb[d.id].why = $('#debtx').value.trim(); if (S.deb[d.id].pick == null) { $('#debmsg').textContent = '먼저 내 생각을 골라요.'; return; } save(); syncThink(); var y8 = window.scrollY; rerender(); window.scrollTo(0, y8); $('#debmsg').textContent = S.deb[d.id].why.length >= 10 ? '저장했어요.' : '까닭을 조금 더 자세히 써 보세요. (10자 이상)'; check(); }
    else if (act === 'reflpick') { S.refl[d.id] = S.refl[d.id] || {}; S.refl[d.id].pick = +b.dataset.j; var rt = $('#refltx'); if (rt) S.refl[d.id].tx = rt.value; save(); rerender(); }
    else if (act === 'reflsave') { S.refl[d.id] = S.refl[d.id] || {}; S.refl[d.id].tx = $('#refltx').value.trim(); save(); syncThink(); $('#reflmsg').textContent = S.refl[d.id].pick == null ? '위에서 하나를 골라요.' : S.refl[d.id].tx.length >= 5 ? '저장했어요.' : '한 줄을 써 주세요.'; check(); }
    else if (act === 'bigsave') { S.bigtxt = $('#bigtx').value.trim(); save(); syncThink(); var y9 = window.scrollY; rerender(); window.scrollTo(0, y9); var bm = $('#bigmsg'); if (bm) bm.textContent = S.bigtxt.length >= 15 ? '저장했어요. 아래 핵심 아이디어와 비교해 보세요.' : '조금 더 자세히 써 보세요. (15자 이상)'; check(); }
    else if (act === 'saveline') { var v = $('#line').value.trim(); S.lines[d.id] = v; save(); sync('lines', S.lines); $('#linemsg').textContent = v.length >= 15 ? '저장했어요.' : '조금 더 자세히 써 보세요. (15자 이상)'; check(); }
    else if (act === 'booth') { var c2 = b.dataset.c, ix = S.booths.indexOf(c2); if (ix >= 0) S.booths.splice(ix, 1); else S.booths.push(c2); save(); $('#stepbody').innerHTML = STEP.booth(); syncProgress(); check(); }
    else if (act === 'exstart') examStart(T.exam, false);
    else if (act === 'exwrong') examStart((EX && EX.i >= EX.ids.length ? EX.wrong : S.exam.wrong), true);
    else if (act === 'exnext') { EX.i++; if (EX.i >= EX.ids.length) examFinish(); drawExam(); window.scrollTo(0, 0); }
    else if (act === 'reset') { if (confirmBox(b, b.classList.contains('outbtn') ? '한 번 더 누르면 나가요' : CFG.API_URL ? '이 기기에서 나가요. 같은 암호로 다시 들어오면 이어서 할 수 있어요. 한 번 더 누르면 나가요.' : '지금까지의 기록이 이 기기에서 모두 지워져요. 한 번 더 누르면 지워요.')) { sessionStorage.removeItem('gastrip.in'); sessionStorage.removeItem('gastrip.tpin'); sessionStorage.removeItem('gastrip.guest'); if (CFG.API_URL || b.dataset.wipe) localStorage.removeItem(KEY); location.hash = ''; location.reload(); } }
    else if (TEACH[act]) TEACH[act](b);
  });
  function confirmBox(b, msg) { if (b.dataset.sure) return true; b.dataset.sure = '1'; b.textContent = msg; return false; }
  function readRows(kind) { var D = S.data[kind]; document.querySelectorAll('.tbl.in input').forEach(function (inp) { D.rows[+inp.dataset.r][+inp.dataset.c] = inp.value.trim().replace(',', '.'); }); var g = $('#dgroup'), u = $('#dunit'); if (g) D.group = g.value.trim(); if (u) D.unit = u.value.trim() || D.unit; D.sample = false; save(); }
  function quizScores() { var o = {}; Object.keys(S.ans).forEach(function (k) { if (k.indexOf('p.') === 0) o[k.slice(2)] = S.ans[k].first === T.pool[k.slice(2)].a ? 1 : 0; }); return o; }
  function classData(kind, scope) {
    var msg = $('#cmsg'), leg = $('#clegend');
    if (!CFG.API_URL) { msg.textContent = '선생님이 ‘반 자료 모으기’를 켜면 다른 모둠의 점도 함께 볼 수 있어요.'; return; }
    msg.textContent = (scope === 'grade' ? '1학년 전체' : '우리 반') + ' 자료를 불러오는 중…';
    apiGet({ cls: scope === 'grade' ? 'all' : S.profile.cls, key: kind }).then(function (res) {
      var D = S.data[kind], K = KIND[kind], rows = validRows(D), grp = {};
      (res.rows || []).forEach(function (r) { var v = r.val; if (!recOK(v, D)) return; var c = scope === 'grade' ? String(r.cls) : String(S.profile.cls), g = v.group ? String(v.group) : r.num + '번', id = c + '|' + g; (grp[id] = grp[id] || { cls: c, group: g, list: [], n: 0 }); grp[id].list = grp[id].list.concat(v.rows); grp[id].n++; });
      var ids = Object.keys(grp).sort(function (a, b) { var A = grp[a], B = grp[b]; return (A.cls - B.cls) || (parseFloat(A.group) - parseFloat(B.group)) || (A.group < B.group ? -1 : 1); });
      if (!ids.length) { msg.textContent = '아직 올라온 자료가 없어요.'; return; }
      var classes = []; ids.forEach(function (id) { if (classes.indexOf(grp[id].cls) < 0) classes.push(grp[id].cls); });
      var series = ids.map(function (id, j) { var G = grp[id], col = scope === 'grade' ? GCOL[classes.indexOf(G.cls) % GCOL.length] : GCOL[j % GCOL.length], me = G.cls === String(S.profile.cls) && G.group === String(D.group);
        return { rows: avgRows(kind, G.list).map(function (r) { return [r[0], r[1]]; }), color: col, label: scope === 'grade' ? G.cls + '반 ' + G.group + '모둠' : G.group + '모둠' + (me ? '(우리)' : ''), n: G.n, me: me }; });
      var all = rows.concat.apply(rows, series.map(function (sr) { return sr.rows; }));
      graphSVG.extra = { trend: !!D.trendOK }; $('.gwrap').innerHTML = graphSVG(axes(all, K.x, K.y, kind), rows, K.x, K.y, rows.length, kind, K, units(kind, D), true, series);
      leg.innerHTML = scope === 'grade' ? classes.map(function (c, j) { return '<span><i style="background:' + GCOL[j % GCOL.length] + '"></i>' + c + '반 (' + series.filter(function (sr) { return sr.label.indexOf(c + '반') === 0; }).length + '모둠)</span>'; }).join('') :
        series.map(function (sr) { return '<span' + (sr.me ? ' class="me"' : '') + '><i style="background:' + sr.color + '"></i>' + esc(sr.label) + ' · ' + sr.n + '명</span>'; }).join('');
      msg.textContent = scope === 'grade' ? classes.length + '개 반, ' + series.length + '개 모둠의 평균을 반마다 다른 색으로 그렸어요. 반이 달라도 같은 경향이 나타나는지 보세요.' : series.length + '개 모둠의 평균을 모둠마다 다른 색으로 그렸어요. 우리 모둠의 점(파란색)과 비교해 보세요.';
    }).catch(function () { msg.textContent = '자료를 불러오지 못했어요. 잠시 뒤에 다시 눌러 보세요.'; });
  }

  /* ---------- 선생님 화면 ---------- */
  function tpost(o) { return fetch(CFG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(o) }).then(function (r) { return r.json(); }); }
  function checkPin(v, ok, bad) {
    if (!CFG.API_URL) return (v === String(CFG.TEACHER_PIN || '0000') ? ok : bad)();
    tpost({ action: 'rows', pin: v }).then(function (r) { (r && !r.error ? ok : bad)(); }).catch(function () { bad('서버에 연결하지 못했어요.'); });
  }
  var TEACH = {}, TS = { tab: 'guide', rows: null, cls: '', msg: '' };
  function viewTeacher() {
    cur = { dest: null, step: 0 };
    var okPin = sessionStorage.getItem('gastrip.tpin');
    var h = '<header class="dtop" style="--c:#1B1F3B"><a class="back" href="#home">← 학생 화면</a><div class="dhead"><span class="dic">🧑‍🏫</span><div><h1>선생님 화면</h1><p>통통 입자 여행 · 기체 안전 여행사</p></div></div></header><main class="dmain teacher">';
    if (!okPin) { app.innerHTML = h + '<div class="card"><h3>비밀번호</h3><div class="row3"><label>교사 비밀번호<input id="tpin" type="text" class="secret" inputmode="numeric" autocomplete="off" data-lpignore="true" data-1p-ignore></label></div><button class="btn pri" data-act="tlogin">들어가기</button><p class="tiny" id="tmsg">' + (CFG.API_URL ? '구글 스크립트(Code.gs)에 정해 둔 교사 비밀번호예요.' : 'config.js의 TEACHER_PIN 값이에요. 처음 값은 0000입니다.') + '</p></div></main>'; return; }
    var tabs = [['guide', '수업 안내'], ['class', '반 현황'], ['data', '실험 자료'], ['lines', '학생 글'], ['snorkl', '스노클 과제'], ['setup', '설정 방법']];
    h += '<nav class="ttabs">' + tabs.map(function (t) { return '<button data-act="ttab" data-t="' + t[0] + '" class="' + (TS.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</nav>';
    if (['class', 'data', 'lines'].indexOf(TS.tab) >= 0) {
      h += '<div class="card"><div class="row3"><label>반<input id="tcls" inputmode="numeric" maxlength="2" value="' + esc(TS.cls) + '"></label></div><button class="btn pri" data-act="tload"' + (CFG.API_URL ? '' : ' disabled') + '>불러오기</button><p class="tiny">' + (CFG.API_URL ? esc(TS.msg) : '반 자료를 모으려면 ‘설정 방법’ 탭의 구글 시트 연결이 필요해요. 연결 전에는 학생 기기에만 저장됩니다.') + '</p></div>';
      if (TS.rows) h += TVIEW[TS.tab]();
    } else h += TVIEW[TS.tab]();
    app.innerHTML = h + '</main>';
  }
  TEACH.tlogin = function () { var v = $('#tpin').value.trim(); $('#tmsg').textContent = '확인 중…'; checkPin(v, function () { sessionStorage.setItem('gastrip.tpin', v); viewTeacher(); }, function (why) { $('#tmsg').innerHTML = '<b class="warn">' + (why || '비밀번호가 달라요.') + '</b>'; }); };
  TEACH.tlogout = function () { var g = isG(); sessionStorage.removeItem('gastrip.tpin'); sessionStorage.removeItem('gastrip.guest'); if (S.profile && S.profile.cls === '0') { S.profile = null; if (!g) save(); } location.hash = ''; location.reload(); };
  TEACH.ttab = function (b) { TS.tab = b.dataset.t; viewTeacher(); };
  TEACH.tload = function () {
    TS.cls = $('#tcls').value.trim(); if (!TS.cls) return; TS.msg = '불러오는 중…'; viewTeacher();
    tpost({ action: 'rows', cls: TS.cls, pin: sessionStorage.getItem('gastrip.tpin') }).then(function (res) { if (res.error) throw new Error(res.error); TS.rows = res.rows || []; TS.msg = TS.rows.length + '건을 불러왔어요.'; viewTeacher(); }).catch(function (e) { TS.msg = '불러오지 못했어요. (' + e.message + ')'; viewTeacher(); });
  };
  TEACH.tcopy = function (b) { var t = b.previousElementSibling.textContent; if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { b.textContent = '복사했어요'; }); };
  TEACH.tcsv = function () {
    var out = [['반', '모둠', '종류', '단위', '가로값', '세로값']]; byKey(['boyle', 'charles']).forEach(function (r) { var v = r.val; (v.rows || []).forEach(function (x) { out.push([r.cls, v.group, r.key, v.unit, x[KIND[r.key].x], x[KIND[r.key].y]]); }); });
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out.map(function (l) { return l.join(','); }).join('\n')], { type: 'text/csv' })); a.download = TS.cls + '반_실험자료.csv'; a.click();
  };
  function byKey(keys) { return TS.rows.filter(function (r) { return keys.indexOf(r.key) >= 0; }); }
  function students() { var m = {}; TS.rows.forEach(function (r) { var id = r.num; m[id] = m[id] || { num: r.num, name: r.name }; m[id][r.key] = r.val; }); return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return a.num - b.num; }); }
  var TVIEW = {
    guide: function () {
      var h = '<div class="card"><h3>9차시 흐름</h3><table class="tbl"><thead><tr><th>차시</th><th>여행지</th><th>성취기준</th><th>받는 도장</th></tr></thead><tbody>';
      T.dests.forEach(function (d) { var st = d.steps.filter(function (s) { return s.stamp; }).map(function (s) { return T.kinds[s.stamp].name; }).join(', '); h += '<tr><td>' + d.period + '</td><td>' + d.icon + ' ' + d.place + '<br><small>' + d.title + '</small></td><td>' + (d.std ? T.stds[d.std].code : '전체') + '</td><td>' + (st || '–') + '</td></tr>'; });
      h += '</tbody></table></div><div class="card"><h3>도장과 성취수준</h3><table class="tbl"><thead><tr><th>도장</th><th>학생이 한 일</th><th>참고할 성취수준</th></tr></thead><tbody><tr><td>본 것</td><td>현상을 보고 변화 방향을 예측함</td><td>E·D</td></tr><tr><td>잰 것</td><td>자료를 표와 그래프로 나타내고 관계를 해석함</td><td>C·B</td></tr><tr><td>입자</td><td>입자 모형으로 변화의 까닭을 설명함</td><td>A (06-01은 C·A)</td></tr></tbody></table><p class="tiny">도장은 학생의 활동 완료를 뜻해요. 성취수준 판단은 ‘안내 한 줄’의 서술과 수업 관찰을 함께 보고 선생님이 확정해 주세요. ‘본 것’ 도장은 예측이 틀려도 찍힙니다. ‘잰 것’ 도장은 예시 자료로 연습해도 찍히며, 그 경우 ‘실험 자료’ 탭에는 나타나지 않습니다.</p></div>';
      h += '<div class="card"><h3>개념기반 탐구 설계</h3><p><b>단원의 큰 질문</b> ' + esc(T.big.q) + '<br><b>핵심 아이디어</b> ' + esc(T.big.idea) + '<br><b>개념 렌즈</b> ' + esc(T.big.lens) + '</p><table class="tbl"><thead><tr><th>차시</th><th>개념적 질문</th><th>학생이 쓰는 문장</th><th>논쟁적 질문</th></tr></thead><tbody>';
      T.dests.forEach(function (d) { if (!d.cq) return; var g = d.steps.filter(function (x) { return x.type === 'gen'; })[0], db = d.steps.filter(function (x) { return x.type === 'debate'; })[0]; h += '<tr><td>' + d.period + '</td><td>' + esc(d.cq) + '</td><td>' + (g ? (g.mode === 'tmp' ? '규칙 찾기 (임시 일반화)' : g.from ? '일반화 다듬기' : '일반화하기') + '<br><small>예시: ' + esc(g.model) + '</small>' : '') + '</td><td>' + (db ? esc(db.q) : '') + '</td></tr>'; });
      h += '</tbody></table><p class="tiny">모든 차시는 탐구 질문으로 시작해 ‘돌아보기’(처음 예측과 지금 생각 비교)로 끝나요. 9차시 자격시험 앞에서 세 일반화를 이어 큰 질문에 답해요. 학생 글은 ‘학생 글’ 탭에서 볼 수 있어요.</p></div>';
      return h;
    },
    class: function () {
      var h = '<div class="card scroll"><table class="tbl"><thead><tr><th>번호</th><th>이름</th>' + ['01', '02', '03'].map(function (s) { return '<th>' + T.stds[s].short + '<br><small>본·잰·입자</small></th>'; }).join('') + '<th>마일</th><th>등급</th><th>부스</th><th>시험</th></tr></thead><tbody>';
      students().forEach(function (s) {
        var p = s.progress || {}, sp = p.stamps || {};
        h += '<tr><td>' + esc(s.num) + '</td><td>' + esc(s.name) + '</td>' + ['01', '02', '03'].map(function (x) { return '<td class="dots">' + ['see', 'meas', 'part'].map(function (k) { return '<i class="' + (sp[x] && sp[x][k] ? 'on' : '') + '" style="--c:' + T.kinds[k].color + '"></i>'; }).join('') + '</td>'; }).join('') + '<td>' + (p.miles || 0) + '</td><td>' + esc(p.rank || '') + '</td><td>' + ((p.booths || []).length || '') + '</td><td>' + (p.exam ? p.exam.best + '/' + p.exam.total : '') + '</td></tr>';
      });
      return h + '</tbody></table></div>';
    },
    data: function () {
      var h = '<div class="card scroll"><button class="btn sm" data-act="tcsv">CSV로 내려받기</button>';
      ['boyle', 'charles'].forEach(function (k) {
        var seen = {}, K = KIND[k]; h += '<h3>' + (k === 'boyle' ? '압력과 부피' : '온도와 부피') + '</h3><table class="tbl"><thead><tr><th>모둠</th><th>단위</th><th>자료 (' + K.cols[0] + ', ' + K.cols[1] + ')</th></tr></thead><tbody>';
        byKey([k]).forEach(function (r) { var v = r.val, g = v.group || r.num + '번'; if (seen[g] || v.sample) return; seen[g] = 1; h += '<tr><td>' + esc(g) + '</td><td>' + esc(v.unit) + '</td><td>' + v.rows.map(function (x) { return '(' + x[0] + ', ' + x[1] + ')'; }).join(' ') + '</td></tr>'; });
        h += '</tbody></table>';
      });
      return h + '<p class="tiny">예시 자료로 연습한 학생의 값은 빠져 있어요.</p></div>';
    },
    lines: function () {
      var h = '', who = function (s) { return '<b>' + esc(s.num) + ' ' + esc(s.name) + '</b> '; };
      T.dests.forEach(function (d) {
        var gst = d.steps.filter(function (x) { return x.type === 'gen'; })[0], dst = d.steps.filter(function (x) { return x.type === 'debate'; })[0], has = d.steps.some(function (x) { return x.type === 'reflect'; });
        if (!gst && !dst && !has) return;
        h += '<div class="card"><h3>' + d.icon + ' ' + d.period + ' ' + d.place + ' · 개념기반 탐구</h3>';
        if (gst) { h += '<p class="tiny">🧭 ' + esc(gst.q) + '</p><h4>' + (gst.mode === 'tmp' ? '내가 찾은 규칙' : '일반화 문장') + '</h4><ul class="plain">'; var n1 = 0; students().forEach(function (s) { var g = s.think && s.think.gen && s.think.gen[d.id]; if (g && genText(g)) { n1++; h += '<li>' + who(s) + esc(genText(g)) + (g.cmp ? '' : ' <small>(비교 전)</small>') + '</li>'; } }); h += (n1 ? '' : '<li>아직 없어요.</li>') + '</ul>'; }
        if (dst) { var cntp = dst.opts.map(function () { return 0; }), li = ''; students().forEach(function (s) { var v = s.think && s.think.deb && s.think.deb[d.id]; if (v && v.pick != null) { cntp[v.pick]++; li += '<li>' + who(s) + '<em>' + esc(dst.opts[v.pick]) + '</em> ' + esc(v.why || '') + '</li>'; } }); h += '<h4>생각 나누기: ' + esc(dst.q) + '</h4><p class="tiny">' + dst.opts.map(function (o, j) { return esc(o) + ' ' + cntp[j] + '명'; }).join(' · ') + '</p><ul class="plain">' + (li || '<li>아직 없어요.</li>') + '</ul>'; }
        if (has) { var cr = REFL.map(function () { return 0; }), lr = ''; students().forEach(function (s) { var v = s.think && s.think.refl && s.think.refl[d.id]; if (v && v.pick != null) { cr[v.pick]++; lr += '<li>' + who(s) + '<em>' + REFL[v.pick] + '</em> ' + esc(v.tx || '') + '</li>'; } }); h += '<h4>돌아보기</h4><p class="tiny">' + REFL.map(function (o, j) { return o + ' ' + cr[j] + '명'; }).join(' · ') + '</p><ul class="plain">' + (lr || '<li>아직 없어요.</li>') + '</ul>'; }
        h += '</div>';
      });
      var bl = ''; students().forEach(function (s) { var b = s.think && s.think.big; if (b) bl += '<li>' + who(s) + esc(b) + '</li>'; });
      h += '<div class="card"><h3>🎓 큰 생각 잇기 (9차시)</h3><p class="tiny">🧭 ' + esc(T.big.q) + '</p><ul class="plain">' + (bl || '<li>아직 없어요.</li>') + '</ul></div><h3>여행 안내 한 줄</h3>';
      T.dests.forEach(function (d) {
        if (!d.steps.some(function (s) { return s.type === 'line'; })) return;
        h += '<div class="card"><h3>' + d.icon + ' ' + d.place + '</h3><ul class="plain">'; var n = 0;
        students().forEach(function (s) { var t = s.lines && s.lines[d.id]; if (t) { n++; h += '<li><b>' + esc(s.num) + ' ' + esc(s.name) + '</b> ' + esc(t) + '</li>'; } });
        h += (n ? '' : '<li>아직 없어요.</li>') + '</ul></div>';
      }); return h;
    },
    snorkl: function () {
      var h = '<div class="card"><p>스노클에 과제를 만들 때 아래 내용을 붙여 넣어 쓰세요. 과제 주소를 config.js의 SNORKL에 넣으면 학생 화면에 버튼이 생겨요.</p></div>';
      T.snorkl.forEach(function (s) {
        var txt = '[과제] ' + s.task + '\n\n[잘한 설명에 들어 있어야 할 것]\n' + s.must.map(function (m) { return '- ' + m; }).join('\n') + '\n\n[자주 나오는 잘못된 설명]\n' + s.miss.map(function (m) { return '- ' + m; }).join('\n') + '\n\n[피드백 방향] 정답을 알려 주지 말고, 빠진 요소를 스스로 찾도록 질문으로 안내한다. 입자의 수와 크기는 변하지 않는다는 점을 확인한다.';
        h += '<div class="card"><h3>' + DEST[s.dest].icon + ' ' + DEST[s.dest].period + ' · ' + s.title + '</h3><pre class="pre">' + esc(txt) + '</pre><button class="btn sm" data-act="tcopy">복사</button></div>';
      }); return h;
    },
    setup: function () {
      return '<div class="card"><h3>지금 상태</h3><ul class="plain"><li>반 자료 모으기(구글 시트): <b>' + (CFG.API_URL ? '연결됨' : '연결 안 됨') + '</b></li><li>부스 웹앱 주소: ' + esc(CFG.BOOTH_URL || '') + '</li></ul></div>' +
        '<div class="card"><h3>구글 시트 연결하기</h3><ol class="plain num"><li>새 구글 스프레드시트를 만들고 <b>확장 프로그램 → Apps Script</b>를 엽니다.</li><li>저장소의 <b>Code.gs</b> 내용을 붙여 넣고, 맨 위 TEACHER_PIN을 원하는 숫자로 바꿉니다.</li><li><b>배포 → 새 배포 → 웹 앱</b>을 고르고, 실행 계정은 ‘나’, 액세스 권한은 ‘모든 사용자’로 배포합니다.</li><li>나온 웹 앱 주소를 <b>config.js</b>의 API_URL에 넣고, TEACHER_PIN도 같은 숫자로 맞춥니다.</li></ol><p class="tiny">연결하면 학생의 도장, 실험 자료, 안내 한 줄이 시트에 모이고, ‘반 현황’과 ‘우리 반 그래프’를 쓸 수 있어요. 학생의 반, 번호, 이름이 선생님의 구글 시트에 저장됩니다.</p></div>';
    }
  };

  route();
})();
