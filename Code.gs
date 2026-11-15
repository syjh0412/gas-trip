/**
 * 입자 여권 · 기체 안전 여행사 — 구글 시트 연동 (Apps Script)
 * 1) 새 구글 스프레드시트 → 확장 프로그램 → Apps Script → 이 코드를 붙여 넣기
 * 2) 아래 TEACHER_PIN을 바꾸기 (config.js의 TEACHER_PIN과 같게)
 * 3) 배포 → 새 배포 → 웹 앱 → 실행: 나 / 액세스: 모든 사용자
 * 4) 웹 앱 주소를 config.js의 API_URL에 넣기
 * 학생이 여권 암호를 잊으면 users 시트에서 그 학생의 암호 칸을 고치거나 줄을 지우면 됩니다.
 */
var TEACHER_PIN = '0000';
var SHEET = 'data';
var OPEN_KEYS = ['boyle', 'charles']; // 학생도 반 전체를 볼 수 있는 자료

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

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function users_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('users');
  if (!sh) { sh = ss.insertSheet('users'); sh.appendRow(['id', '반', '번호', '이름', '여권 암호', '처음 입장']); sh.setFrozenRows(1); }
  return sh;
}

function find_(sh, id) {
  return sh.getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext();
}

/** 입장: 처음이면 여권 암호를 등록하고, 다음부터는 암호가 맞아야 들어온다. 저장된 진행 상황을 돌려준다. */
function login_(d) {
  var uid = [d.cls, d.num].join('|');
  var us = users_();
  var u = find_(us, uid);
  if (!u) {
    us.appendRow([uid, String(d.cls), String(d.num), String(d.name || ''), String(d.code), new Date()]);
    return { ok: true, first: true };
  }
  var row = us.getRange(u.getRow(), 1, 1, 5).getValues()[0];
  if (String(row[4]) !== String(d.code)) return { error: '여권 암호가 달라요. 잊었다면 선생님께 말씀드리세요.' };
  var st = find_(sheet_(), [d.cls, d.num, 'state'].join('|'));
  var state = null;
  if (st) { try { state = JSON.parse(sheet_().getRange(st.getRow(), 7).getValue()); } catch (x) {} }
  return { ok: true, state: state };
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var d = JSON.parse(e.postData.contents);
    lock.waitLock(10000);
    if (d.action === 'login') {
      if (!d.cls || !d.num || !d.code) return out_({ error: 'bad request' });
      return out_(login_(d));
    }
    if (!d.cls || !d.num || !d.key) return out_({ error: 'bad request' });
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

function doGet(e) {
  var p = e.parameter || {};
  if (!p.cls) return out_({ error: 'cls required' });
  var all = p.all === '1';
  if (all && String(p.pin) !== String(TEACHER_PIN)) return out_({ error: '비밀번호가 다릅니다' });
  if (!all && OPEN_KEYS.indexOf(p.key) < 0) return out_({ error: 'not allowed' });
  var values = sheet_().getDataRange().getValues();
  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var r = values[i];
    if (String(r[2]) !== String(p.cls)) continue;
    if (!all && r[5] !== p.key) continue;
    if (r[5] === 'state') continue; // 이어 하기용 전체 기록은 목록에서 뺀다
    var val = null;
    try { val = JSON.parse(r[6]); } catch (x) {}
    rows.push(all ? { cls: r[2], num: Number(r[3]), name: r[4], key: r[5], val: val } : { num: Number(r[3]), key: r[5], val: val });
  }
  return out_({ rows: rows });
}
