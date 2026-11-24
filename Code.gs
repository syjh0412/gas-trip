/**
 * 통통 입자 여행 · 기체 안전 여행사 — 구글 시트 연동 (Apps Script)
 * 1) 새 구글 스프레드시트 → 확장 프로그램 → Apps Script → 이 코드를 붙여 넣기
 * 2) 아래 TEACHER_PIN을 바꾸기 (config.js의 TEACHER_PIN과 같게)
 * 3) 배포 → 새 배포 → 웹 앱 → 실행: 나 / 액세스: 모든 사용자
 * 4) 웹 앱 주소를 config.js의 API_URL에 넣기
 * 학생이 여권 암호를 잊으면 users 시트에서 그 학생의 암호 칸을 고치거나 줄을 지우면 됩니다.
 */
var TEACHER_PIN = '0000';
var SHEET = 'data';
var OPEN_KEYS = ['boyle', 'charles', 'vac']; // 학생도 반 전체를 볼 수 있는 자료

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(['id', '시간', '반', '번호', '이름', '종류', '내용']);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** 수업 공개 참관 신청: 학생 자료(data)와 섞이지 않게 '참관신청' 탭에 따로 모읍니다. */
var APPLY_CLS = '참관';
function applySheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('참관신청');
  if (!sh) { sh = ss.insertSheet('참관신청'); sh.appendRow(['신청 시각', '소속 학교', '성명', '담당 교과', '연락처', '7교시 수업 나눔', '보고 싶은 점', 'id']); sh.setFrozenRows(1); }
  return sh;
}
function applySave_(d) {
  var sh = applySheet_(), v = d.val || {}, id = String(d.num), vals = sh.getDataRange().getValues();
  var row = [new Date(), String(v.school || ''), String(d.name || ''), String(v.subject || ''), String(v.contact || ''), v.share === 'Y' ? '참석' : v.share === 'N' ? '참관만' : '', String(v.memo || ''), id];
  row = row.map(function (x) { return typeof x === 'string' && /^[=+\-@]/.test(x) ? "'" + x : x; }); // 수식으로 읽히지 않게
  for (var i = 1; i < vals.length; i++) if (String(vals[i][7]) === id) { sh.getRange(i + 1, 1, 1, row.length).setValues([row]); return; }
  sh.appendRow(row);
}
function applyRows_() {
  var vals = applySheet_().getDataRange().getValues(), rows = [];
  for (var i = 1; i < vals.length; i++) { var r = vals[i]; if (r[1] === '' && r[2] === '') continue; rows.push({ cls: APPLY_CLS, num: r[7], name: r[2], key: 'apply', val: { school: r[1], subject: r[3], contact: r[4], share: r[5] === '참석' ? 'Y' : r[5] === '참관만' ? 'N' : '', memo: r[6], at: r[0] instanceof Date ? r[0].toISOString() : String(r[0]) } }); }
  return rows;
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function users_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('users');
  if (!sh) { sh = ss.insertSheet('users'); sh.appendRow(['id', '반', '번호', '이름', '여권 암호', '처음 입장']); sh.setFrozenRows(1); }
  return sh;
}

/** 명단: 'roster' 탭에 반, 번호, 이름을 적어 두면 입장 화면에서 반과 번호를 고를 때 이름이 나옵니다. 비워 두면 학생이 이름을 직접 씁니다. */
function rosterSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('roster');
  if (!sh) { sh = ss.insertSheet('roster'); sh.appendRow(['반', '번호', '이름']); sh.setFrozenRows(1); }
  return sh;
}

function rosterRows_() {
  var v = rosterSheet_().getDataRange().getValues(), out = [];
  for (var i = 1; i < v.length; i++) if (v[i][0] !== '' && v[i][1] !== '' && v[i][2] !== '') out.push({ cls: String(v[i][0]).trim(), num: String(v[i][1]).trim(), name: String(v[i][2]).trim() });
  return out;
}

function find_(sh, id) {
  return sh.getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext();
}

/** 입장: 처음이면 여권 암호를 등록하고, 다음부터는 암호가 맞아야 들어온다. 저장된 진행 상황을 돌려준다. */
function login_(d) {
  var uid = [d.cls, d.num].join('|');
  var rr = rosterRows_();
  if (rr.length) {
    var hit = null;
    for (var i = 0; i < rr.length; i++) if (rr[i].cls === String(d.cls) && rr[i].num === String(d.num)) hit = rr[i];
    if (!hit) return { error: '명단에 없는 반·번호예요. 선생님께 말씀드리세요.' };
    d.name = hit.name;
  }
  var us = users_();
  var u = find_(us, uid);
  if (!u) {
    us.appendRow([uid, String(d.cls), String(d.num), String(d.name || ''), String(d.code), new Date()]);
    return { ok: true, first: true, name: String(d.name || '') };
  }
  var row = us.getRange(u.getRow(), 1, 1, 5).getValues()[0];
  if (String(row[4]) !== String(d.code)) return { error: '여권 암호가 달라요. 잊었다면 선생님께 말씀드리세요.' };
  var st = find_(sheet_(), [d.cls, d.num, 'state'].join('|'));
  var state = null;
  if (st) { try { state = JSON.parse(sheet_().getRange(st.getRow(), 7).getValue()); } catch (x) {} }
  return { ok: true, state: state, name: String(d.name || row[3] || '') };
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var d = JSON.parse(e.postData.contents);
    lock.waitLock(10000);
    if (d.action === 'rows') { // 교사용: 비밀번호가 맞아야 반 전체 기록을 돌려준다
      if (String(d.pin) !== String(TEACHER_PIN)) return out_({ error: '비밀번호가 다릅니다' });
      if (String(d.cls) === APPLY_CLS) return out_({ rows: applyRows_().concat(rows_(APPLY_CLS, null, true)) }); // 예전 방식으로 data 탭에 들어온 신청도 함께
      return out_({ rows: d.cls ? rows_(d.cls, null, true) : [] });
    }
    if (d.action === 'login') {
      if (!d.cls || !d.num || !d.code) return out_({ error: 'bad request' });
      return out_(login_(d));
    }
    if (!d.cls || !d.num || !d.key) return out_({ error: 'bad request' });
    if (String(d.cls) === APPLY_CLS && d.key === 'apply') { applySave_(d); return out_({ ok: true }); }
    var id = [d.cls, d.num, d.key].join('|');
    var row = [id, new Date(), String(d.cls), String(d.num), String(d.name || ''), String(d.key), JSON.stringify(d.val)];
    var sh = sheet_();
    var found = find_(sh, id);
    if (found) sh.getRange(found.getRow(), 1, 1, row.length).setValues([row]);
    else sh.appendRow(row);
    return out_({ ok: true });
  } catch (err) {
    return out_({ error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function rows_(cls, key, all) {
  var values = sheet_().getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (cls !== 'all' && String(r[2]) !== String(cls)) continue;
    if (!all && r[5] !== key) continue;
    if (r[5] === 'state') continue; // 이어 하기용 전체 기록은 목록에서 뺀다
    var val = null;
    try { val = JSON.parse(r[6]); } catch (x) {}
    rows.push(all ? { cls: r[2], num: Number(r[3]), name: r[4], key: r[5], val: val } : { cls: r[2], num: Number(r[3]), key: r[5], val: val });
  }
  return rows;
}

/** 학생용: 반 전체(cls=반 번호) 또는 1학년 전체(cls=all) 실험 자료를 이름 없이 돌려준다. */
function doGet(e) {
  var p = e.parameter || {};
  if (p.roster === '1') { // 입장 화면용 명단: 이름은 가운데를 가려서 보낸다
    var rr = rosterRows_(), set = {}, uv = users_().getDataRange().getValues(), ro = {};
    for (var u = 1; u < uv.length; u++) set[uv[u][0]] = true;
    for (var i = 0; i < rr.length; i++) {
      var n = rr[i].name, m = n.length <= 1 ? n : n.length === 2 ? n.charAt(0) + '*' : n.charAt(0) + new Array(n.length - 1).join('*') + n.charAt(n.length - 1);
      (ro[rr[i].cls] = ro[rr[i].cls] || []).push({ num: rr[i].num, name: m, set: !!set[rr[i].cls + '|' + rr[i].num] });
    }
    return out_({ roster: ro });
  }
  if (!p.cls) return out_({ error: 'cls required' });
  if (OPEN_KEYS.indexOf(p.key) < 0) return out_({ error: 'not allowed' });
  return out_({ rows: rows_(p.cls, p.key, false) });
}
