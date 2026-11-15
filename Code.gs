/**
 * 입자 여권 · 기체 안전 여행사 — 구글 시트 연동 (Apps Script)
 * 1) 새 구글 스프레드시트 → 확장 프로그램 → Apps Script → 이 코드를 붙여 넣기
 * 2) 아래 TEACHER_PIN을 바꾸기 (config.js의 TEACHER_PIN과 같게)
 * 3) 배포 → 새 배포 → 웹 앱 → 실행: 나 / 액세스: 모든 사용자
 * 4) 웹 앱 주소를 config.js의 API_URL에 넣기
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

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var d = JSON.parse(e.postData.contents);
    if (!d.cls || !d.num || !d.key) return out_({ error: 'bad request' });
    var id = [d.cls, d.num, d.key].join('|');
    var row = [id, new Date(), String(d.cls), String(d.num), String(d.name || ''), String(d.key), JSON.stringify(d.val)];
    lock.waitLock(10000);
    var sh = sheet_();
    var found = sh.getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext();
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
    var val = null;
    try { val = JSON.parse(r[6]); } catch (x) {}
    rows.push(all ? { cls: r[2], num: Number(r[3]), name: r[4], key: r[5], val: val } : { num: Number(r[3]), key: r[5], val: val });
  }
  return out_({ rows: rows });
}
