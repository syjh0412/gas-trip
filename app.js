(function () {
  'use strict';
  var T = window.TRIP, CFG = window.TRIP_CONFIG || {};
  var KEY = 'gastrip.v1';
  var app = document.getElementById('app');
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var DEST = {}; T.dests.forEach(function (d) { DEST[d.id] = d; });

  /* ---------- 상태 ---------- */
  var S = { profile: null, miles: 0, mi: {}, combo: 0, flags: {}, wear: {}, badges: {}, pos: {}, seen: {}, done: {}, stamps: {}, ans: {}, data: {}, lines: {}, lab: {}, chain: {}, booths: [], exam: null };
  try { var raw = localStorage.getItem(KEY); if (raw) { var o = JSON.parse(raw); for (var k in o) S[k] = o[k]; } } catch (e) { }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }

  /* ---------- 서버 연동 (선택) ---------- */
  var timers = {};
  function sync(key, val) {
    if (!CFG.API_URL || !S.profile) return;
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
  function isT() { return !!sessionStorage.getItem('gastrip.pin'); }
  function rankIdx() { var n = stampCount(), ix = 0; for (var j = 1; j < T.ranks.length; j++) { if (S.miles >= T.ranks[j].min && n >= (T.ranks[j].st || 0)) ix = j; else break; } return ix; }
  function rank() { return T.ranks[rankIdx()]; }
  /* ---------- 마일 · 배지 ---------- */
  function mile(key, n) {
    if (isT() || !n) return; var had = S.mi[key] || 0; if (n <= had) return;
    var before = rankIdx(); S.mi[key] = n; S.miles += n - had; save(); chip('+' + (n - had) + ' 마일');
    var after = rankIdx(); if (after > before) { var it = T.items.filter(function (x) { return x.at > before && x.at <= after; }); setTimeout(function () { toast('<div class="rkup">🎖️</div><p><b>승급!</b> ' + T.ranks[after].name + (it.length ? '<br>새 꾸미기: ' + it.map(function (x) { return x.name; }).join(', ') : '') + '</p>'); }, 900); }
    badges(); var m = $('#mcount'); if (m) m.textContent = S.miles;
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
    S.stamps[std][kind] = Date.now(); save(); mile('st.' + std + kind, 10);
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
    MCQ = {};
    var h = location.hash.replace(/^#/, '').split('/');
    if (!S.profile && h[0] !== 'teacher') return viewRegister();
    if (h[0] === 'd' && DEST[h[1]]) return viewDest(DEST[h[1]], h[2] == null ? -1 : Math.max(0, parseInt(h[2], 10) || 0));
    cur = { dest: null };
    if (h[0] === 'teacher') return viewTeacher();
    viewHome();
  }
  window.addEventListener('hashchange', function () { route(); window.scrollTo(0, 0); });

  /* ---------- 등록 ---------- */
  function viewRegister() {
    app.innerHTML = '<main class="reg"><div class="cover"><div class="emblem">' + mascot(96, 1) + '</div><p class="cv1">GAS SAFE TRAVEL</p><h1>입자 여권</h1><p class="cv2">기체 안전 여행사</p></div>' +
      '<form class="card regform" id="regform"><h2>여권 발급</h2><p class="sub">기체 안전 여행사의 가이드가 되어 여행지를 돌며 도장을 모아요.</p>' +
      '<div class="row3"><label>반<input name="cls" inputmode="numeric" required maxlength="2" autocomplete="off"></label><label>번호<input name="num" inputmode="numeric" required maxlength="2" autocomplete="off"></label><label>이름<input name="name" required maxlength="10" autocomplete="off"></label></div>' +
      '<button class="btn pri wide" type="submit">여권 발급받기</button><p class="tiny">입력한 정보와 활동 기록은 이 기기에 저장돼요.' + (CFG.API_URL ? ' 선생님 화면에도 전달돼요.' : '') + '</p></form>' +
      '<p class="tlink"><a href="#teacher">선생님 화면</a></p></main>';
    $('#regform').addEventListener('submit', function (e) {
      e.preventDefault(); var f = e.target;
      S.profile = { cls: f.cls.value.trim(), num: f.num.value.trim(), name: f.name.value.trim() }; save(); syncProgress(); route();
    });
  }
  var WEAR = {
    scarf: '<path d="M22 74q28 14 56 0l-2 9q-26 12-52 0z" fill="#C2410C" stroke="#1B1F3B" stroke-width="3"/><path d="M62 83l4 13 8-3-3-12z" fill="#C2410C" stroke="#1B1F3B" stroke-width="3"/>',
    headset: '<path d="M17 52a33 33 0 0 1 66 0" fill="none" stroke="#1B1F3B" stroke-width="5"/><rect x="10" y="48" width="11" height="18" rx="4" fill="#A61E6E" stroke="#1B1F3B" stroke-width="3"/><rect x="79" y="48" width="11" height="18" rx="4" fill="#A61E6E" stroke="#1B1F3B" stroke-width="3"/>',
    glasses: '<rect x="27" y="40" width="21" height="14" rx="4" fill="#1B1F3B"/><rect x="52" y="40" width="21" height="14" rx="4" fill="#1B1F3B"/><path d="M47 45h6" stroke="#1B1F3B" stroke-width="4"/>',
    hat: '<path d="M24 30q26-26 52 0z" fill="#2F4BD8" stroke="#1B1F3B" stroke-width="4" stroke-linejoin="round"/><path d="M16 31h62" stroke="#1B1F3B" stroke-width="6" stroke-linecap="round"/>',
    crown: '<path d="M30 25l5-17 15 12 15-12 5 17z" fill="#FFD43B" stroke="#1B1F3B" stroke-width="4" stroke-linejoin="round"/>',
    flag: '<path d="M8 70V26" stroke="#1B1F3B" stroke-width="4" stroke-linecap="round"/><path d="M8 26l20 7-20 7z" fill="#0B7A4B" stroke="#1B1F3B" stroke-width="3" stroke-linejoin="round"/>'
  };
  function mascot(sz, plain) {
    var w = plain ? {} : (S.wear || {}), ex = ''; ['scarf', 'headset', 'glasses', 'hat', 'crown', 'flag'].forEach(function (k) { if (w[k]) ex += WEAR[k]; });
    return '<svg width="' + sz + '" height="' + sz + '" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="52" r="34" fill="#FFD43B" stroke="#1B1F3B" stroke-width="5"/><circle cx="39" cy="47" r="5" fill="#1B1F3B"/><circle cx="61" cy="47" r="5" fill="#1B1F3B"/><path d="M38 62q12 11 24 0" fill="none" stroke="#1B1F3B" stroke-width="5" stroke-linecap="round"/>' + (w.headset ? '' : '<path d="M88 44l10-2M86 30l8-6" stroke="#1B1F3B" stroke-width="4" stroke-linecap="round"/>') + ex + '</svg>';
  }

  /* ---------- 홈 ---------- */
  function destProgress(d) { var n = 0; d.steps.forEach(function (s, i) { if (S.done[d.id] && S.done[d.id][i]) n++; }); return n; }
  function viewHome() {
    badges();
    var ri = rankIdx(), r = T.ranks[ri], n = stampCount(), next = T.ranks[ri + 1], nx = '';
    if (next) { var needM = Math.max(0, next.min - S.miles), needS = Math.max(0, (next.st || 0) - n); nx = '<b>' + next.name + '</b>까지 ' + [needM ? needM + ' 마일' : '', needS ? '도장 ' + needS + '개' : ''].filter(Boolean).join(', ') + ' 남았어요'; } else nx = '가장 높은 등급이에요!';
    var lo = r.min, hi = next ? next.min : r.min + 1, pc = next ? Math.min(100, (S.miles - lo) / (hi - lo) * 100) : 100;
    var h = '<header class="top"><div class="who">' + mascot(72) + '<div><p class="rk">Lv.' + (ri + 1) + ' ' + r.name + '</p><h1>' + esc(S.profile.name) + ' <small>' + esc(S.profile.cls) + '반 ' + esc(S.profile.num) + '번</small></h1></div><div class="mbox"><b>' + S.miles + '</b><span>마일</span></div></div>' +
      '<div class="mbar" role="img" aria-label="다음 등급까지 진행"><i style="width:' + pc.toFixed(0) + '%"></i></div><p class="nx">' + nx + '</p></header><main class="home">';
    h += '<section class="card passport"><h2>내 입자 여권 <span class="cnt">도장 ' + n + ' / 9</span></h2><div class="pgrid">';
    ['01', '02', '03'].forEach(function (s) {
      h += '<div class="prow"><div class="pstd"><b>' + T.stds[s].short + '</b><span>' + T.stds[s].code + '</span></div>' + stampHTML(s, 'see') + stampHTML(s, 'meas') + stampHTML(s, 'part') + '</div>';
    });
    h += '</div><p class="tiny">본 것 → 잰 것 → 입자 순서로, 눈에 보이는 현상에서 보이지 않는 입자까지 설명하면 여권이 완성돼요.</p></section>';
    h += '<h2 class="sec">여행 일정</h2><ol class="route">';
    T.dests.forEach(function (d) {
      var p = destProgress(d), tot = d.steps.length, fin = p >= tot;
      h += '<li><a class="dcard' + (fin ? ' fin' : '') + '" href="#d/' + d.id + '" style="--c:' + d.color + '"><span class="dic">' + d.icon + '</span><span class="dtx"><small>' + d.period + ' · ' + d.page + '</small><b>' + d.place + '</b><em>' + d.title + '</em></span><span class="dpg">' + (fin ? '완료' : p + '/' + tot) + '</span></a></li>';
    });
    h += '</ol>';
    var got = BADGES.filter(function (b) { return S.badges[b.id]; }).length;
    h += '<section class="card"><h2>여행 가방 <span class="cnt">' + got + ' / ' + BADGES.length + '</span></h2><p class="tiny" style="margin:0 0 10px">여행지를 마치면 스티커를, 특별한 일을 해내면 배지를 얻어요. 눌러서 조건을 볼 수 있어요.</p><div class="bgrid">' +
      BADGES.map(function (b) { var on = S.badges[b.id]; return '<button class="bdg' + (on ? ' on' : '') + '" data-act="bdg" data-n="' + esc(b.n) + '" data-d="' + esc(b.d) + '" aria-label="' + esc(b.n) + (on ? ' 획득' : ' 아직') + '"><span>' + (on ? b.ic : '❔') + '</span><small>' + b.n + '</small></button>'; }).join('') + '</div><p class="tiny" id="bdgmsg" aria-live="polite"></p></section>';
    h += '<section class="card"><h2>내 입자 꾸미기</h2><div class="wearbox"><div class="wearme">' + mascot(120) + '</div><div class="wearlist">' +
      T.items.map(function (it) { var open = ri >= it.at; return '<button class="wr' + (S.wear[it.id] ? ' on' : '') + '" data-act="wear" data-id="' + it.id + '"' + (open ? '' : ' disabled') + ' aria-pressed="' + !!S.wear[it.id] + '">' + (open ? '' : '🔒 ') + it.name + (open ? '' : '<small>Lv.' + (it.at + 1) + '</small>') + '</button>'; }).join('') + '</div></div></section>';
    h += '<section class="card"><h2>등급 경로</h2><ol class="rklist">' + T.ranks.map(function (x, j) { return '<li class="' + (j === ri ? 'cur' : j < ri ? 'past' : '') + '"><span class="lv">Lv.' + (j + 1) + '</span><b>' + x.name + '</b><span class="rq">' + x.min + ' 마일' + (x.st ? ' · 도장 ' + x.st + '개' : '') + '</span></li>'; }).join('') + '</ol><p class="tiny">마일은 빈칸 열기, 예측, 문제 풀이, 실험 활동, 도장으로 모아요. 높은 등급은 도장도 필요해요.</p></section>';
    if (CFG.COUPONS !== false) h += '<section class="card"><h2>선생님 쿠폰</h2><ul class="cpn">' + T.coupons.map(function (c) { var ok = couponOK(c.id); return '<li class="' + (ok ? 'on' : '') + '"><span>' + (ok ? '🎟️' : '🔒') + '</span><div><b>' + c.name + '</b><small>' + c.cond + '</small></div><em>' + (ok ? '선생님께 보여 주세요' : '아직') + '</em></li>'; }).join('') + '</ul></section>';
    if (S.exam) h += '<section class="card"><h2>자격시험 기록</h2><p>최고 점수 <b>' + S.exam.best + ' / ' + S.exam.total + '</b>' + (S.exam.best >= 14 ? ' · 입자 가이드 자격 취득' : '') + '</p></section>';
    h += '<p class="tlink"><a href="#teacher">선생님 화면</a> · <button class="linkbtn" data-act="reset">여권 다시 발급</button></p></main>';
    app.innerHTML = h;
  }

  /* ---------- 여행지 ---------- */
  function markDone(d, i) {
    S.done[d.id] = S.done[d.id] || {};
    if (S.done[d.id][i]) return;
    S.done[d.id][i] = Date.now(); save();
    var st = d.steps[i]; mile('s.' + d.id + '.' + i, { presslab: 6, sim: 6, data: 10, chain: 8, line: 6, booth: 6 }[st.type] || 0);
    if (st.stamp && d.std) award(d.std, st.stamp);
    syncProgress();
  }
  function isDone(d, i) { return !!(S.done[d.id] && S.done[d.id][i]); }
  function buildSlides(d) {
    var a = [{ k: 'hero' }];
    d.steps.forEach(function (st, si) {
      if (st.type === 'predict') st.items.forEach(function (it, j) { a.push({ k: 'q', si: si, j: j, n: st.items.length }); });
      else if (st.type === 'cards') { st.cards.forEach(function (c, j) { a.push({ k: 'card', si: si, j: j, n: st.cards.length }); }); if (st.examples) a.push({ k: 'ex', si: si }); if (st.labs) a.push({ k: 'labs', si: si }); }
      else if (st.type === 'quiz') st.ids.forEach(function (id, j) { a.push({ k: 'pq', si: si, j: j, id: id, n: st.ids.length }); });
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
    if (sl.k === 'hero') body = '<div class="hero"><div class="hic">' + d.icon + '</div><p class="s-kicker">' + d.period + ' · ' + d.page + '</p><h1 class="s-title">' + d.place + '</h1><p class="hsub">' + d.title + '</p><p class="hintro">' + d.intro + '</p>' + (d.std ? '<p class="hstd"><b>' + T.stds[d.std].code + '</b> ' + T.stds[d.std].text + '</p>' : '') + '</div>';
    else if (sl.k === 'q') body = '<p class="s-kicker">' + kick + '</p>' + (st.note ? '<p class="note">' + st.note + '</p>' : '') + mcq(pfx(d, sl.si) + sl.j, st.items[sl.j], 'free', 0);
    else if (sl.k === 'pq') body = '<p class="s-kicker">' + kick + '</p>' + mcq('p.' + sl.id, T.pool[sl.id], 'quiz', 0);
    else if (sl.k === 'card') {
      var c = st.cards[sl.j], seen = S.seen[pfx(d, sl.si) + sl.j];
      body = '<p class="s-kicker">' + kick + '</p><article class="bigcard"><h2 class="s-title">' + c.h + '</h2><p class="s-body">' + (seen ? c.b : c.b.replace(/<b>/g, '<b class="blank" data-act="blank" role="button" tabindex="0">')) + '</p></article>';
    }
    else if (sl.k === 'ex') body = '<p class="s-kicker">' + st.title + ' · 생활 속 예</p>' + exHTML(st);
    else if (sl.k === 'labs') body = '<p class="s-kicker">' + st.title + ' · 오늘 수업에서 하는 실험</p>' + labsHTML(st);
    else if (sl.k === 'clear') {
      var got = d.std ? ['see', 'meas', 'part'].map(function (x) { return stampHTML(d.std, x); }).join('') : '', ni = T.dests.indexOf(d) + 1, nd = T.dests[ni];
      body = '<div class="hero"><div class="hic">🏁</div><h1 class="s-title">' + d.place + ' 여행 끝!</h1>' + (d.std ? '<p class="hsub">' + T.stds[d.std].short + ' 도장</p><div class="clr">' + got + '</div>' : '') + '<div class="btns ctr">' + (nd ? '<a class="btn yel" href="#d/' + nd.id + '/0">다음 여행지: ' + nd.icon + ' ' + nd.place + '</a>' : '') + '<a class="btn" href="#home">내 여권 보기</a></div></div>';
    }
    else body = '<p class="s-kicker">' + kick + '</p>' + (st.stamp && d.std ? '<p class="goal" style="--c:' + T.kinds[st.stamp].color + '">이 활동을 마치면 <b>‘' + T.kinds[st.stamp].name + '’ 도장</b>을 받아요.</p>' : '') + (st.note ? '<p class="note">' + st.note + '</p>' : '') + '<div id="stepbody">' + STEP[st.type](d, st, sl.si) + '</div>';
    app.innerHTML = '<div class="stage" style="--c:' + d.color + '" data-kind="' + sl.k + '" data-type="' + (st ? st.type : '') + '" data-si="' + (sl.si == null ? '' : sl.si) + '" data-j="' + (sl.j == null ? '' : sl.j) + '" data-id="' + (sl.id || '') + '">' +
      '<div class="stg-top"><a class="btn sm exit" href="#home">✕ 나가기</a><span class="ttl">' + d.icon + ' ' + d.period + ' · ' + d.place + '</span><span class="mtop" aria-label="모은 마일">🧳 <b id="mcount">' + S.miles + '</b></span><span class="num">' + (k + 1) + ' / ' + slides.length + '</span></div>' +
      '<div class="pbar"><i style="width:' + ((k + 1) / slides.length * 100).toFixed(1) + '%"></i></div>' +
      '<div class="stg-body" id="stgbody"><div class="slide t-' + sl.k + (st ? ' y-' + st.type : '') + '">' + body + '</div></div>' +
      '<div class="stg-nav"><button class="btn prev" data-act="go" data-d="-1"' + (k === 0 ? ' disabled' : '') + '>◀ 이전</button><span class="hintkey" id="hintkey"></span><button class="btn pri next" data-act="go" data-d="1" id="next">' + (k === slides.length - 1 ? '여권으로 🏁' : '다음 ▶') + '</button></div></div>';
    if (sl.k === 'whole' && AFTER[st.type]) AFTER[st.type](d, st, sl.si);
    var be = $('#stgbody'), tx = null, ty = null;
    be.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
    be.addEventListener('touchend', function (e) { if (tx === null) return; var dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty; if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && !e.target.closest('textarea,input,select,canvas,svg,.tbl')) go(dx < 0 ? 1 : -1); tx = null; }, { passive: true });
    check();
  }
  function go(dir) {
    var d = cur.dest; if (!d) return;
    if (dir > 0 && cur.locked) { toast('<p>🔒 ' + cur.why + '</p>'); return; }
    var ni = cur.slide + dir; if (ni < 0) return;
    if (ni >= cur.slides.length) { location.hash = '#home'; return; }
    location.replace('#d/' + d.id + '/' + ni);
  }
  document.addEventListener('keydown', function (e) {
    if (!cur.dest) return;
    if (e.target.classList && e.target.classList.contains('blank') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.target.click(); return; }
    if (e.target.closest && e.target.closest('input,textarea,select,button,a')) return;
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1); } else if (e.key === 'ArrowLeft') go(-1);
  });
  function check() {
    var d = cur.dest; if (!d) return; var sl = cur.sl, st = sl.si != null ? d.steps[sl.si] : null;
    if (st && DONE[st.type](d, st, sl.si)) markDone(d, sl.si);
    var ok = slideDone(d, sl), hk = $('#hintkey'), nx = $('#next'); if (!hk) return;
    cur.locked = !ok && !isT();
    cur.why = sl.k === 'card' ? '노란 빈칸을 모두 눌러 확인하세요' : (sl.k === 'q' || sl.k === 'pq') ? '질문에 답하면 넘어갈 수 있어요' : (st ? TODO[st.type] : '');
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
  function exHTML(st) { return '<ul class="exs">' + st.examples.map(function (e) { return '<li><b>' + e[0] + '</b>' + e[1] + '</li>'; }).join('') + '</ul>'; }
  function labsHTML(st) { return '<ul class="labs">' + st.labs.map(function (l) { return '<li><div><b>' + l.name + '</b><span>' + l.note + '</span></div><a class="btn sm" target="_blank" rel="noopener" href="' + boothURL('#slides/' + l.booth) + '">실험 안내 열기</a></li>'; }).join('') + '</ul>'; }
  STEP.cards = function () { return ''; };
  DONE.cards = function () { return true; };
  function boothURL(hash) { return (CFG.BOOTH_URL || 'https://syjh0412.github.io/gas-booth/').split('#')[0] + (hash || ''); }

  // 점토 실험실
  var LABC = { fw: ['가득', '넓은 바닥', 1, '(가)'], fn: ['가득', '좁은 뚜껑', 4, '(나)'], hn: ['반', '좁은 뚜껑', 2, '(다)'], hw: ['반', '넓은 바닥', 0.5, ''] };
  STEP.presslab = function (d, st, i) {
    var L = S.lab.press = S.lab.press || { f: 'f', a: 'w', tried: {} };
    return '<div class="lab card"><div class="labctl"><div><span class="lb">물의 양 (누르는 힘)</span><div class="seg"><button data-act="lab" data-k="f" data-v="f">가득</button><button data-act="lab" data-k="f" data-v="h">반</button></div></div><div><span class="lb">세우는 방향 (닿는 넓이)</span><div class="seg"><button data-act="lab" data-k="a" data-v="w">넓은 바닥</button><button data-act="lab" data-k="a" data-v="n">좁은 뚜껑</button></div></div></div><div id="labview"></div></div><div id="labq"></div>';
  };
  AFTER.presslab = function (d, st, i) { drawLab(d, st, i); };
  function drawLab(d, st, i) {
    var L = S.lab.press, c = LABC[L.f + L.a]; L.tried[L.f + L.a] = 1; save();
    document.querySelectorAll('.seg button').forEach(function (b) { b.classList.toggle('on', L[b.dataset.k] === b.dataset.v); });
    var dep = c[2] * 7, wide = L.a === 'w', full = L.f === 'f';
    var bw = 70, bx = 160 - bw / 2, foot = wide ? 96 : 26, top = 40 + dep, bodyH = 120;
    var svg = '<svg viewBox="0 0 320 250" class="labsvg" role="img" aria-label="점토 위의 페트병. 눌린 깊이 ' + c[2] + '칸"><rect x="30" y="180" width="260" height="56" rx="6" fill="#E9B48A" stroke="#1B1F3B" stroke-width="3"/>' +
      '<rect x="' + (160 - foot / 2) + '" y="180" width="' + foot + '" height="' + dep + '" fill="#F3F5FB" stroke="#1B1F3B" stroke-width="2"/>' +
      '<g transform="translate(0,' + dep + ')">' + (wide
        ? '<rect x="112" y="170" width="96" height="10" fill="#fff" stroke="#1B1F3B" stroke-width="3"/><rect x="' + bx + '" y="50" width="' + bw + '" height="' + bodyH + '" rx="10" fill="#fff" stroke="#1B1F3B" stroke-width="3"/><rect x="' + (bx + 3) + '" y="' + (full ? 58 : 110) + '" width="' + (bw - 6) + '" height="' + (full ? 109 : 57) + '" rx="6" fill="#8EC5FF"/><rect x="147" y="34" width="26" height="18" rx="3" fill="#1B1F3B"/>'
        : '<rect x="147" y="162" width="26" height="18" rx="3" fill="#1B1F3B"/><rect x="' + bx + '" y="42" width="' + bw + '" height="' + bodyH + '" rx="10" fill="#fff" stroke="#1B1F3B" stroke-width="3"/><rect x="' + (bx + 3) + '" y="' + (full ? 50 : 102) + '" width="' + (bw - 6) + '" height="' + (full ? 109 : 57) + '" rx="6" fill="#8EC5FF"/><rect x="112" y="32" width="96" height="10" fill="#fff" stroke="#1B1F3B" stroke-width="3"/>') + '</g>' +
      '<text x="306" y="26" font-size="15" text-anchor="end">눌린 깊이 ' + c[2] + '칸</text></svg>';
    var rows = Object.keys(L.tried).map(function (k) { var x = LABC[k]; return '<tr><td>' + (x[3] || '') + '</td><td>' + x[0] + '</td><td>' + x[1] + '</td><td><b>' + x[2] + '칸</b></td></tr>'; }).join('');
    $('#labview').innerHTML = '<div class="labgrid">' + svg + '<table class="tbl"><caption>내 실험 기록</caption><thead><tr><th></th><th>물의 양</th><th>닿는 면</th><th>눌린 깊이</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    var n = Object.keys(L.tried).length;
    $('#labq').innerHTML = n >= 3 ? itemsHTML(d, st, i, 'retry') : '<p class="hint">조건을 바꿔 ' + (3 - n) + '가지를 더 해 보면 질문이 나와요.</p>';
  }
  DONE.presslab = function (d, st, i) { return Object.keys((S.lab.press || { tried: {} }).tried).length >= 3 && allRight(pfx(d, i), st.items); };
  TODO.presslab = '세 가지 이상 실험하고 질문에 답해요';

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

  // 자료 입력과 그래프
  var KIND = {
    boyle: { cols: ['부피', '압력'], unitA: 'mL', units: ['기압', 'kPa', 'hPa'], x: 1, y: 0, n: 7, sample: [[60, 0.5], [50, 0.6], [40, 0.75], [30, 1.0], [25, 1.2], [20, 1.5], [15, 2.0]], sampleUnit: '기압' },
    charles: { cols: ['온도', '부피'], unitA: '℃', units: null, x: 0, y: 1, n: 6, sample: [[60, 6.14], [50, 5.95], [40, 5.77], [30, 5.58], [20, 5.40], [10, 5.21]], sampleUnit: 'mL' }
  };
  function getData(kind) {
    var K = KIND[kind];
    S.data[kind] = S.data[kind] || { group: '', unit: K.units ? K.units[0] : (CFG.CHARLES_UNIT || 'mL'), rows: [], locked: false, placed: 0, fails: 0, sample: false };
    var D = S.data[kind]; while (D.rows.length < K.n) D.rows.push(['', '']); return D;
  }
  function validRows(D) { return D.rows.filter(function (r) { return r[0] !== '' && r[1] !== '' && isFinite(+r[0]) && isFinite(+r[1]); }).map(function (r) { return [+r[0], +r[1]]; }); }
  function units(kind, D) { return kind === 'boyle' ? ['mL', D.unit] : ['℃', D.unit]; }
  STEP.data = function (d, st, i) { return '<div id="databox"></div>'; };
  AFTER.data = function (d, st, i) { drawData(d, st, i); };
  function drawData(d, st, i) {
    var kind = st.kind, K = KIND[kind], D = getData(kind), u = units(kind, D), h = '';
    if (!D.locked) {
      h += '<div class="card"><h3>① 측정값 입력</h3><div class="row3"><label>모둠<input id="dgroup" inputmode="numeric" maxlength="2" value="' + esc(D.group) + '" placeholder="예: 3"></label>' +
        (K.units ? '<label>압력 단위<select id="dunit">' + K.units.map(function (x) { return '<option' + (x === D.unit ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' : '<label>부피 단위<input id="dunit" maxlength="8" value="' + esc(D.unit) + '"></label>') + '</div>' +
        '<table class="tbl in"><thead><tr><th>번호</th><th>' + K.cols[0] + ' (' + u[0] + ')</th><th>' + K.cols[1] + ' (' + u[1] + ')</th></tr></thead><tbody>' +
        D.rows.map(function (r, j) { return '<tr><td>' + (j + 1) + '</td><td><input inputmode="decimal" data-r="' + j + '" data-c="0" value="' + esc(r[0]) + '" aria-label="' + (j + 1) + '번 ' + K.cols[0] + '"></td><td><input inputmode="decimal" data-r="' + j + '" data-c="1" value="' + esc(r[1]) + '" aria-label="' + (j + 1) + '번 ' + K.cols[1] + '"></td></tr>'; }).join('') +
        '</tbody></table><div class="btns"><button class="btn sm" data-act="addrow">줄 추가</button><button class="btn sm" data-act="sample">예시 자료로 연습</button><button class="btn pri" data-act="lock">표 완성 → 그래프 그리기</button></div><p class="tiny" id="dmsg">측정값을 4개 이상 입력해요. 실험을 못 했다면 예시 자료로 연습할 수 있어요.</p></div>';
      $('#databox').innerHTML = h; return;
    }
    var rows = validRows(D), xi = K.x, yi = K.y;
    h += '<div class="card"><h3>① 우리 모둠 자료' + (D.sample ? ' <span class="tag">예시 자료</span>' : '') + ' <button class="linkbtn" data-act="unlock">고치기</button></h3><table class="tbl"><thead><tr><th>번호</th><th>' + K.cols[0] + ' (' + u[0] + ')</th><th>' + K.cols[1] + ' (' + u[1] + ')</th>' + (kind === 'boyle' ? '<th>압력 × 부피</th>' : '') + '</tr></thead><tbody>' +
      rows.map(function (r, j) { return '<tr class="' + (j === D.placed ? 'cur' : '') + '"><td>' + (j + 1) + (j < D.placed ? ' ✓' : '') + '</td><td>' + r[0] + '</td><td>' + r[1] + '</td>' + (kind === 'boyle' ? '<td>' + (+(r[0] * r[1]).toPrecision(3)) + '</td>' : '') + '</tr>'; }).join('') + '</tbody></table></div>';
    var ax = axes(rows, xi, yi, kind), done = D.placed >= rows.length;
    h += '<div class="card"><h3>② 그래프에 점 찍기</h3><p id="gmsg" class="gmsg" aria-live="polite">' + (done ? '점을 모두 찍었어요. 점들이 어떤 모양으로 놓였는지 살펴보세요.' : '<b>' + (D.placed + 1) + '번</b> 자료 (' + K.cols[xi] + ' ' + rows[D.placed][xi] + ', ' + K.cols[yi] + ' ' + rows[D.placed][yi] + ')의 자리를 그래프에서 눌러 보세요.') + '</p>' +
      '<div class="gwrap">' + graphSVG(ax, rows, xi, yi, D.placed, kind, K, u, done, null) + '</div>' +
      (!done && D.fails >= 2 ? '<button class="btn sm" data-act="autoplace">이 점은 도움 받기</button>' : '') +
      (done ? '<div class="btns"><button class="btn sm" data-act="classdata">우리 반 그래프 보기</button></div><p class="tiny" id="cmsg">' + (kind === 'charles' ? '세로축은 0부터 시작하지 않아요. 눈금의 숫자를 잘 보세요.' : '') + '</p>' : '') + '</div>';
    if (done) h += '<h3 class="sub3">③ 그래프 해석</h3>' + itemsHTML(d, st, i, 'retry');
    $('#databox').innerHTML = h;
    var svg = $('#gsvg');
    if (svg && !done) svg.addEventListener('click', function (e) {
      var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY; var q = pt.matrixTransform(svg.getScreenCTM().inverse());
      var vx = ax.x0 + (q.x - ax.L) / ax.pw * (ax.x1 - ax.x0), vy = ax.y0 + (ax.T + ax.ph - q.y) / ax.ph * (ax.y1 - ax.y0), r = rows[D.placed];
      if (Math.abs(vx - r[xi]) <= (ax.x1 - ax.x0) * 0.045 && Math.abs(vy - r[yi]) <= (ax.y1 - ax.y0) * 0.06) { D.placed++; D.fails = 0; if (D.placed >= rows.length && !D.missed && !D.sample) S.flags.sharp = 1; save(); if (D.placed >= rows.length) sync(kind, { group: D.group, unit: D.unit, rows: rows, sample: D.sample }); drawData(d, st, i); check(); }
      else { D.fails++; D.missed = 1; save(); drawData(d, st, i); $('#gmsg').innerHTML = '조금 달라요. 가로축에서 <b>' + r[xi] + '</b>을(를) 먼저 찾고, 그 위로 올라가 세로축 <b>' + r[yi] + '</b> 높이를 눌러요.'; }
    });
  }
  function nice(lo, hi, n) { var raw = (hi - lo) / n, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p, s = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; return s; }
  function axes(rows, xi, yi, kind) {
    var xs = rows.map(function (r) { return r[xi]; }), ys = rows.map(function (r) { return r[yi]; });
    var xmax = Math.max.apply(null, xs), ymax = Math.max.apply(null, ys), ymin = Math.min.apply(null, ys);
    var a = { L: 62, T: 16, pw: 540, ph: 320 };
    a.xs = nice(0, xmax * 1.05, 5); a.x0 = 0; a.x1 = Math.ceil(xmax * 1.02 / a.xs) * a.xs;
    if (kind === 'boyle') { a.ys = nice(0, ymax * 1.05, 6); a.y0 = 0; a.y1 = Math.ceil(ymax * 1.02 / a.ys) * a.ys; }
    else { var pad = Math.max((ymax - ymin) * 0.6, ymax * 0.02); a.ys = nice(ymin - pad, ymax + pad * 0.4, 6); a.y0 = Math.max(0, Math.floor((ymin - pad) / a.ys) * a.ys); a.y1 = Math.ceil((ymax + pad * 0.3) / a.ys) * a.ys; }
    a.X = function (v) { return a.L + (v - a.x0) / (a.x1 - a.x0) * a.pw; }; a.Y = function (v) { return a.T + a.ph - (v - a.y0) / (a.y1 - a.y0) * a.ph; };
    return a;
  }
  function fmt(v) { return +v.toFixed(3); }
  function graphSVG(a, rows, xi, yi, placed, kind, K, u, done, cls) {
    var s = '<svg id="gsvg" viewBox="0 0 620 390" class="graph' + (done ? '' : ' live') + '" role="img" aria-label="' + K.cols[xi] + '과 ' + K.cols[yi] + '의 그래프">', v;
    for (v = a.x0; v <= a.x1 + 1e-9; v += a.xs) s += '<line x1="' + a.X(v) + '" x2="' + a.X(v) + '" y1="' + a.T + '" y2="' + (a.T + a.ph) + '" class="gl"/><text x="' + a.X(v) + '" y="' + (a.T + a.ph + 20) + '" text-anchor="middle" class="gt">' + fmt(v) + '</text>';
    for (v = a.y0; v <= a.y1 + 1e-9; v += a.ys) s += '<line x1="' + a.L + '" x2="' + (a.L + a.pw) + '" y1="' + a.Y(v) + '" y2="' + a.Y(v) + '" class="gl"/><text x="' + (a.L - 8) + '" y="' + (a.Y(v) + 5) + '" text-anchor="end" class="gt">' + fmt(v) + '</text>';
    s += '<path d="M' + a.L + ' ' + a.T + 'V' + (a.T + a.ph) + 'H' + (a.L + a.pw) + '" class="gax"/><text x="' + (a.L + a.pw / 2) + '" y="384" text-anchor="middle" class="gn">' + K.cols[xi] + ' (' + u[xi] + ')</text><text x="16" y="' + (a.T + a.ph / 2) + '" text-anchor="middle" class="gn" transform="rotate(-90 16 ' + (a.T + a.ph / 2) + ')">' + K.cols[yi] + ' (' + u[yi] + ')</text>';
    if (cls) cls.forEach(function (g) { g.rows.forEach(function (r) { if (r[xi] >= a.x0 && r[xi] <= a.x1 && r[yi] >= a.y0 && r[yi] <= a.y1) s += '<circle cx="' + a.X(r[xi]) + '" cy="' + a.Y(r[yi]) + '" r="5" class="gc"/>'; }); });
    if (done) {
      var d = '', j, x;
      if (kind === 'boyle') { var k = rows.reduce(function (t, r) { return t + r[0] * r[1]; }, 0) / rows.length; for (j = 0; j <= 60; j++) { x = a.x1 * (0.12 + 0.88 * j / 60); var y = k / x; if (y <= a.y1) d += (d ? 'L' : 'M') + a.X(x).toFixed(1) + ' ' + a.Y(y).toFixed(1); } }
      else { var n = rows.length, sx = 0, sy = 0, sxx = 0, sxy = 0; rows.forEach(function (r) { sx += r[xi]; sy += r[yi]; sxx += r[xi] * r[xi]; sxy += r[xi] * r[yi]; }); var m = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1), b = (sy - m * sx) / n; d = 'M' + a.X(a.x0) + ' ' + a.Y(Math.max(a.y0, b + m * a.x0)) + 'L' + a.X(a.x1) + ' ' + a.Y(Math.min(a.y1, b + m * a.x1)); }
      s += '<path d="' + d + '" class="gfit"/>';
    }
    rows.forEach(function (r, j) { if (j < placed) s += '<circle cx="' + a.X(r[xi]) + '" cy="' + a.Y(r[yi]) + '" r="7" class="gp"/>'; });
    return s + '</svg>';
  }
  DONE.data = function (d, st, i) { var D = S.data[st.kind]; return !!(D && D.locked && D.placed >= validRows(D).length && allRight(pfx(d, i), st.items)); };
  TODO.data = '표를 채우고, 점을 찍고, 질문에 답해요';

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
  function drawExam() {
    var el = $('#exam'); if (!el) return; var h = '';
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
    else if (act === 'bdg') { $('#bdgmsg').innerHTML = '<b>' + b.dataset.n + '</b> — ' + b.dataset.d; }
    else if (act === 'wear') { S.wear[b.dataset.id] = !S.wear[b.dataset.id]; save(); var y = window.scrollY; viewHome(); window.scrollTo(0, y); }
    else if (act === 'blank') { b.classList.add('on'); b.removeAttribute('data-act'); if (!document.querySelector('.blank:not(.on)')) { S.seen[pfx(d, i) + cur.sl.j] = 1; save(); mile('c.' + pfx(d, i) + cur.sl.j, 2); } check(); }
    else if (act === 'lab') { S.lab.press[b.dataset.k] = b.dataset.v; drawLab(d, st, i); check(); }
    else if (act === 'addrow') { readRows(st.kind); S.data[st.kind].rows.push(['', '']); save(); drawData(d, st, i); }
    else if (act === 'sample') { var K = KIND[st.kind], D = getData(st.kind); D.rows = K.sample.map(function (r) { return [String(r[0]), String(r[1])]; }); D.unit = K.sampleUnit; D.sample = true; save(); drawData(d, st, i); }
    else if (act === 'lock') {
      readRows(st.kind); var D2 = S.data[st.kind], rows = validRows(D2);
      if (rows.length < 4) { $('#dmsg').innerHTML = '<b class="warn">숫자로 된 측정값이 4개 이상 필요해요.</b> 지금은 ' + rows.length + '개예요.'; return; }
      D2.locked = true; D2.placed = 0; D2.fails = 0; D2.missed = 0; save(); drawData(d, st, i); check();
    }
    else if (act === 'unlock') { var D3 = S.data[st.kind]; D3.locked = false; D3.placed = 0; D3.sample = false; save(); drawData(d, st, i); check(); }
    else if (act === 'autoplace') { var D4 = S.data[st.kind]; D4.placed++; D4.fails = 0; D4.missed = 1; save(); drawData(d, st, i); check(); }
    else if (act === 'classdata') { classData(st.kind); }
    else if (act === 'chain') { var C = S.chain[d.id]; C.sel[+b.dataset.j] = +b.dataset.k; C.checked = false; save(); $('#stepbody').innerHTML = STEP.chain(d, st, i); }
    else if (act === 'chaincheck') {
      var C2 = S.chain[d.id];
      if (st.slots.some(function (s, j) { return C2.sel[j] == null; })) { toast('<p>네 칸을 모두 골라요.</p>'); return; }
      C2.checked = true; C2.ok = st.slots.every(function (s, j) { return C2.sel[j] === s.a; }); save();
      $('#stepbody').innerHTML = STEP.chain(d, st, i); if (C2.ok) sync('chain', S.chain); check();
    }
    else if (act === 'saveline') { var v = $('#line').value.trim(); S.lines[d.id] = v; save(); sync('lines', S.lines); $('#linemsg').textContent = v.length >= 15 ? '저장했어요.' : '조금 더 자세히 써 보세요. (15자 이상)'; check(); }
    else if (act === 'booth') { var c2 = b.dataset.c, ix = S.booths.indexOf(c2); if (ix >= 0) S.booths.splice(ix, 1); else S.booths.push(c2); save(); $('#stepbody').innerHTML = STEP.booth(); syncProgress(); check(); }
    else if (act === 'exstart') examStart(T.exam, false);
    else if (act === 'exwrong') examStart((EX && EX.i >= EX.ids.length ? EX.wrong : S.exam.wrong), true);
    else if (act === 'exnext') { EX.i++; if (EX.i >= EX.ids.length) examFinish(); drawExam(); window.scrollTo(0, 0); }
    else if (act === 'reset') { if (confirmBox(b, '지금까지의 기록이 이 기기에서 모두 지워져요. 한 번 더 누르면 지워요.')) { localStorage.removeItem(KEY); location.hash = ''; location.reload(); } }
    else if (TEACH[act]) TEACH[act](b);
  });
  function confirmBox(b, msg) { if (b.dataset.sure) return true; b.dataset.sure = '1'; b.textContent = msg; return false; }
  function readRows(kind) { var D = S.data[kind]; document.querySelectorAll('.tbl.in input').forEach(function (inp) { D.rows[+inp.dataset.r][+inp.dataset.c] = inp.value.trim().replace(',', '.'); }); var g = $('#dgroup'), u = $('#dunit'); if (g) D.group = g.value.trim(); if (u) D.unit = u.value.trim() || D.unit; D.sample = false; save(); }
  function quizScores() { var o = {}; Object.keys(S.ans).forEach(function (k) { if (k.indexOf('p.') === 0) o[k.slice(2)] = S.ans[k].first === T.pool[k.slice(2)].a ? 1 : 0; }); return o; }
  function classData(kind) {
    var msg = $('#cmsg');
    if (!CFG.API_URL) { msg.textContent = '선생님이 ‘반 자료 모으기’를 켜면 다른 모둠의 점도 함께 볼 수 있어요.'; return; }
    msg.textContent = '우리 반 자료를 불러오는 중…';
    apiGet({ cls: S.profile.cls, key: kind }).then(function (res) {
      var by = {}; (res.rows || []).forEach(function (r) { var v = r.val; if (v && v.rows && !v.sample) by[v.group || (r.num + '번')] = v; });
      var D = S.data[kind], K = KIND[kind], rows = validRows(D), groups = Object.keys(by).filter(function (g) { return by[g].unit === D.unit; }).map(function (g) { return by[g]; });
      $('.gwrap').innerHTML = graphSVG(axes(rows, K.x, K.y, kind), rows, K.x, K.y, rows.length, kind, K, units(kind, D), true, groups);
      msg.textContent = groups.length + '개 모둠의 자료를 회색 점으로 겹쳐 그렸어요. 우리 모둠의 점(파란색)과 비교해 보세요.';
    }).catch(function () { msg.textContent = '자료를 불러오지 못했어요. 잠시 뒤에 다시 눌러 보세요.'; });
  }

  /* ---------- 선생님 화면 ---------- */
  var TEACH = {}, TS = { tab: 'guide', rows: null, cls: '', msg: '' };
  function viewTeacher() {
    cur = { dest: null, step: 0 };
    var okPin = sessionStorage.getItem('gastrip.pin');
    var h = '<header class="dtop" style="--c:#1B1F3B"><a class="back" href="#home">← 학생 화면</a><div class="dhead"><span class="dic">🧑‍🏫</span><div><h1>선생님 화면</h1><p>기체 안전 여행사 · 입자 여권</p></div></div></header><main class="dmain teacher">';
    if (!okPin) { app.innerHTML = h + '<div class="card"><h3>비밀번호</h3><div class="row3"><label>교사 비밀번호<input id="tpin" type="password" inputmode="numeric" autocomplete="off"></label></div><button class="btn pri" data-act="tlogin">들어가기</button><p class="tiny" id="tmsg">config.js의 TEACHER_PIN 값이에요. 처음 값은 0000입니다.</p></div></main>'; return; }
    var tabs = [['guide', '수업 안내'], ['class', '반 현황'], ['data', '실험 자료'], ['lines', '안내 한 줄'], ['snorkl', '스노클 과제'], ['setup', '설정 방법']];
    h += '<nav class="ttabs">' + tabs.map(function (t) { return '<button data-act="ttab" data-t="' + t[0] + '" class="' + (TS.tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>'; }).join('') + '</nav>';
    if (['class', 'data', 'lines'].indexOf(TS.tab) >= 0) {
      h += '<div class="card"><div class="row3"><label>반<input id="tcls" inputmode="numeric" maxlength="2" value="' + esc(TS.cls) + '"></label></div><button class="btn pri" data-act="tload"' + (CFG.API_URL ? '' : ' disabled') + '>불러오기</button><p class="tiny">' + (CFG.API_URL ? esc(TS.msg) : '반 자료를 모으려면 ‘설정 방법’ 탭의 구글 시트 연결이 필요해요. 연결 전에는 학생 기기에만 저장됩니다.') + '</p></div>';
      if (TS.rows) h += TVIEW[TS.tab]();
    } else h += TVIEW[TS.tab]();
    app.innerHTML = h + '</main>';
  }
  TEACH.tlogin = function () { var v = $('#tpin').value.trim(); if (v === String(CFG.TEACHER_PIN || '0000')) { sessionStorage.setItem('gastrip.pin', v); viewTeacher(); } else $('#tmsg').innerHTML = '<b class="warn">비밀번호가 달라요.</b>'; };
  TEACH.ttab = function (b) { TS.tab = b.dataset.t; viewTeacher(); };
  TEACH.tload = function () {
    TS.cls = $('#tcls').value.trim(); if (!TS.cls) return; TS.msg = '불러오는 중…'; viewTeacher();
    apiGet({ cls: TS.cls, all: 1, pin: sessionStorage.getItem('gastrip.pin') }).then(function (res) { if (res.error) throw new Error(res.error); TS.rows = res.rows || []; TS.msg = TS.rows.length + '건을 불러왔어요.'; viewTeacher(); }).catch(function (e) { TS.msg = '불러오지 못했어요. (' + e.message + ')'; viewTeacher(); });
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
      var h = ''; T.dests.forEach(function (d) {
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
