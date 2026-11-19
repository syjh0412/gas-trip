/* 3차시 '주사기 속 입자 모형' 3D 버전
   - app.js가 이 단계를 열 때만 불러옵니다 (Three.js 포함 약 0.7 MB).
   - 3D를 쓸 수 없는 기기에서는 app.js의 2D 모형이 그대로 쓰입니다.
   - 입자끼리의 충돌은 넣지 않은 단순 모형입니다. 온도(입자 속력)와 입자 수는 늘 같습니다. */
import * as THREE from './vendor/three.module.min.js';

var INK = 0x1B1F3B, YEL = 0xFFD43B, BLUE = 0x2F4BD8, BG = 0xF3F5FB;
var N = 50;            // 입자 수
var SPEED = 3.6;       // 입자 속력 (온도 일정 → 늘 같음)
var U = 0.33;          // 1 mL에 해당하는 길이
var RI = 0.95;         // 주사기 안쪽 반지름
var PR = 0.11;         // 입자 반지름
var X0 = -3.4;         // 막힌 끝(안쪽 면)의 위치
var GAP = 0.02;        // 입자 중심이 벽에 닿는 여유 — 작게 두어야 압력이 부피에 정확히 반비례해요
var VMAX = 20, VMIN = 7;

function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

function textSprite(txt, opt) {
  opt = opt || {};
  var fs = opt.size || 44, c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = '700 ' + fs + 'px "Noto Sans KR", sans-serif';
  var w = Math.ceil(g.measureText(txt).width) + 16, h = fs + 18;
  c.width = w; c.height = h;
  g.font = '700 ' + fs + 'px "Noto Sans KR", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = opt.color || '#1B1F3B';
  g.fillText(txt, w / 2, h / 2 + 2);
  var tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  var k = (opt.h || 0.32) / h; sp.scale.set(w * k, h * k, 1);
  return sp;
}

function flashTexture() {
  var s = 64, c = document.createElement('canvas'); c.width = c.height = s;
  var g = c.getContext('2d'), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,212,59,0.85)'); gr.addColorStop(1, 'rgba(255,212,59,0)');
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(c);
}

export function syringe3D(o) {
  var old = o.canvas, box = old.parentNode;
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
  catch (e) { return null; }
  if (!renderer.getContext()) return null;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cv = renderer.domElement;
  cv.className = 'sim3dcv';
  cv.setAttribute('role', 'img');
  cv.setAttribute('aria-label', '끝을 막은 주사기의 입자 모형. 노란 입자들이 주사기 안에서 움직이며 벽과 피스톤에 충돌한다. 화면을 옆으로 끌면 주사기를 돌려 볼 수 있다.');
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setClearColor(BG, 1);
  old.style.display = 'none';
  box.insertBefore(cv, old);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 2, 0.1, 100);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xC9CEE8, 1.1));
  var sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(3, 8, 5);
  scene.add(sun);

  // 돌려 볼 수 있는 주사기 전체
  var rig = new THREE.Group(); scene.add(rig);
  // 바닥에 비치는 부드러운 그림자
  (function () {
    var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d');
    var gr = g.createRadialGradient(64, 64, 2, 64, 64, 64); gr.addColorStop(0, 'rgba(27,31,59,0.22)'); gr.addColorStop(0.6, 'rgba(27,31,59,0.08)'); gr.addColorStop(1, 'rgba(27,31,59,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    var sh = new THREE.Mesh(new THREE.PlaneGeometry(13, 1.8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.set(2.1, -1.75, 0); scene.add(sh);
  })();
  function onX(geo) { geo.rotateZ(Math.PI / 2); return geo; }   // 원기둥을 x축으로 눕히기
  var inkMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.55 });
  var blueMat = new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.45 });

  // 주사기 몸통 (유리)
  var bodyLen = 20.8 * U, bodyMid = X0 + bodyLen / 2;
  var glass = new THREE.Mesh(onX(new THREE.CylinderGeometry(RI + 0.05, RI + 0.05, bodyLen, 48, 1, true)),
    new THREE.MeshStandardMaterial({ color: 0xBFD8FF, transparent: true, opacity: 0.2, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.x = bodyMid; glass.renderOrder = 2; rig.add(glass);
  var rimGeo = new THREE.TorusGeometry(RI + 0.05, 0.035, 8, 48); rimGeo.rotateY(Math.PI / 2);
  [X0, X0 + bodyLen].forEach(function (x) { var r = new THREE.Mesh(rimGeo, inkMat); r.position.x = x; rig.add(r); });
  // 손가락 걸이
  var flange = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.9, 0.5), inkMat);
  flange.position.x = X0 + bodyLen; rig.add(flange);
  // 막힌 끝: 바닥 + 주둥이 + 마개
  var endCap = new THREE.Mesh(onX(new THREE.CylinderGeometry(RI + 0.05, RI + 0.05, 0.14, 48)), inkMat);
  endCap.position.x = X0 - 0.07; rig.add(endCap);
  var tip = new THREE.Mesh(onX(new THREE.CylinderGeometry(0.16, 0.42, 0.5, 24)), new THREE.MeshStandardMaterial({ color: 0x868E96, roughness: 0.6 }));
  tip.position.x = X0 - 0.39; rig.add(tip);
  var plug = new THREE.Mesh(onX(new THREE.CylinderGeometry(0.26, 0.26, 0.3, 24)), inkMat);
  plug.position.x = X0 - 0.78; rig.add(plug);
  var plugLab = textSprite('막음', { h: 0.44 }); plugLab.position.set(X0 - 0.75, 1.2, 0); rig.add(plugLab);

  // 눈금 (몸통 앞쪽 아래에 인쇄된 것처럼)
  var tickMat = new THREE.MeshBasicMaterial({ color: INK });
  for (var m = 0; m <= 20; m++) {
    var major = m % 5 === 0, th = major ? 0.34 : 0.18, yc = -0.45 - th / 2;
    var t = new THREE.Mesh(new THREE.BoxGeometry(0.025, th, 0.01), tickMat);
    t.position.set(X0 + m * U, yc, Math.sqrt((RI + 0.05) * (RI + 0.05) - yc * yc) + 0.004);
    t.rotation.x = -Math.asin(yc / (RI + 0.05));
    rig.add(t);
    if (major) { var nl = textSprite(String(m), { h: 0.42 }); nl.position.set(X0 + m * U, -RI - 0.42, 0.75); rig.add(nl); }
  }
  var mlLab = textSprite('mL', { h: 0.42 }); mlLab.position.set(X0 + 20 * U + 0.6, -RI - 0.42, 0.75); rig.add(mlLab);

  // 피스톤 (고무 마개 + 막대 + 누르개)
  var piston = new THREE.Group(); rig.add(piston);
  var gasket = new THREE.Mesh(onX(new THREE.CylinderGeometry(RI, RI, 0.32, 48)), inkMat);
  gasket.position.x = 0.16; piston.add(gasket);
  var rodLen = 13.9 * U + 0.25;   // 7 mL까지 밀어도 누르개가 몸통 밖에 있도록
  var rod = new THREE.Mesh(new THREE.BoxGeometry(rodLen, 0.18, 0.6), blueMat);
  rod.position.x = 0.32 + rodLen / 2; piston.add(rod);
  var rod2 = new THREE.Mesh(new THREE.BoxGeometry(rodLen, 0.6, 0.18), blueMat);
  rod2.position.x = rod.position.x; piston.add(rod2);
  var thumb = new THREE.Mesh(onX(new THREE.CylinderGeometry(1.0, 1.0, 0.14, 40)), blueMat);
  thumb.position.x = 0.32 + rodLen; piston.add(thumb);
  var push = textSprite('◀ 미는 힘', { h: 0.44, color: '#A61E6E' });
  push.position.set(0.32 + rodLen - 0.3, 1.75, 0); push.visible = false; piston.add(push);

  // 입자 (노란 공 + 남색 테두리)
  var fill = new THREE.InstancedMesh(new THREE.SphereGeometry(PR, 16, 12), new THREE.MeshStandardMaterial({ color: YEL, emissive: YEL, emissiveIntensity: 0.28, roughness: 0.45 }), N);
  var edge = new THREE.InstancedMesh(new THREE.SphereGeometry(PR * 1.22, 12, 10), new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }), N);
  rig.add(fill); rig.add(edge);

  // 충돌 반짝임
  var ftex = flashTexture(), flashes = [], fi = 0;
  for (var k = 0; k < 40; k++) {
    var fs = new THREE.Sprite(new THREE.SpriteMaterial({ map: ftex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    fs.visible = false; fs.renderOrder = 3; rig.add(fs); flashes.push({ s: fs, t0: 0, on: false });
  }
  function flash(x, y, z, now) {
    if (reduce) return;
    var f = flashes[fi]; fi = (fi + 1) % flashes.length;
    f.s.position.set(x, y, z); f.t0 = now; f.on = true; f.s.visible = true;
  }

  // 입자 초기화
  var P = [];
  for (var i = 0; i < N; i++) {
    var a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * (RI - PR);
    var d = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    while (d.lengthSq() > 1 || d.lengthSq() < 0.01) d.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1);
    d.normalize().multiplyScalar(SPEED);
    P.push({ x: X0 + PR + Math.random() * (VMAX * U - 2 * PR), y: rr * Math.cos(a), z: rr * Math.sin(a), vx: d.x, vy: d.y, vz: d.z, hit: -1e9 });
  }
  // 이 입자들이 20 mL에서 양 끝 벽에 1초 동안 충돌할 기대 횟수 → 1기압으로 맞추는 기준
  var sumVx = P.reduce(function (t, p) { return t + Math.abs(p.vx); }, 0);
  function expRate(v) { return sumVx / (v * U - 2 * GAP); }
  var R20 = expRate(VMAX);

  // 소리
  var actx = null, soundOn = true, lastSnd = 0, rateNow = 0;
  function audio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { soundOn = false; } } if (actx && actx.state === 'suspended') actx.resume(); }
  function pop(now) {
    if (!soundOn || !actx || actx.state !== 'running') return;
    var r = Math.min(rateNow / R20, 3);           // 20 mL일 때 1, 7 mL 근처에서 약 3
    var gap = Math.max(22, 95 - r * 24);           // 충돌이 잦을수록 더 촘촘하게
    if (now - lastSnd < gap) return; lastSnd = now;
    var t0 = actx.currentTime, osc = actx.createOscillator(), gn = actx.createGain();
    var f0 = 330 + r * 150;                        // 330Hz(여유) ~ 780Hz(빽빽)
    osc.type = 'sine'; osc.frequency.setValueAtTime(f0, t0); osc.frequency.exponentialRampToValueAtTime(f0 * 0.35, t0 + 0.05);
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(0.06 + r * 0.03, t0 + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    osc.connect(gn).connect(actx.destination); osc.start(t0); osc.stop(t0 + 0.1);
  }
  var sb = o.sound;
  function paintSound() { if (sb) { sb.textContent = soundOn ? '🔊 충돌 소리 켜짐' : '🔇 충돌 소리 꺼짐'; sb.setAttribute('aria-pressed', soundOn ? 'true' : 'false'); } }
  function onSound() { soundOn = !soundOn; if (soundOn) audio(); paintSound(); }
  if (sb) { sb.hidden = false; sb.addEventListener('click', onSound); paintSound(); }
  function firstTouch() { if (soundOn) audio(); }
  box.addEventListener('pointerdown', firstTouch);

  // 부피 조절
  var vT = +o.slider.value || VMAX, vNow = vT, settleAt = performance.now();
  function onSlide() { vT = +o.slider.value; o.out.textContent = vT + ' mL'; settleAt = 1e15; firstTouch(); }
  o.slider.addEventListener('input', onSlide);
  vT = +o.slider.value || VMAX; vNow = vT; settleAt = 0;

  // 끌어서 돌려 보기
  var drag = null, yaw = -0.18, pitch = 0.12, yawT = yaw, pitchT = pitch;
  cv.style.touchAction = 'pan-y';
  cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, yaw: yawT, pitch: pitchT }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', function (e) { if (!drag) return; yawT = Math.max(-1.1, Math.min(1.1, drag.yaw + (e.clientX - drag.x) * 0.008)); pitchT = Math.max(-0.2, Math.min(0.55, drag.pitch + (e.clientY - drag.y) * 0.004)); });
  function endDrag() { drag = null; }
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('dblclick', function () { yawT = -0.18; pitchT = 0.12; });

  // 크기 맞추기
  function fit() {
    var w = box.clientWidth || 600, h = Math.round(Math.max(190, Math.min(400, w * (w < 560 ? 0.56 : 0.46))));
    renderer.setSize(w, h, false); cv.style.width = '100%'; cv.style.height = h + 'px';
    camera.aspect = w / h;
    // 주사기 전체(막음 ~ 누르개, 약 13칸)가 가로에 꼭 맞도록 거리 계산
    var halfW = 7.0, tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    var z = Math.max(halfW / (tanV * camera.aspect), 2.6 / tanV) + 1.2;
    camera.position.set(2.05, z * 0.2, z); camera.lookAt(2.05, -0.15, 0);
    camera.updateProjectionMatrix();
  }
  var ro = window.ResizeObserver ? new ResizeObserver(fit) : null;
  if (ro) ro.observe(box); else window.addEventListener('resize', fit);
  fit();

  // 측정: 넓이가 변하지 않는 양 끝 벽(막힌 끝 + 피스톤)에 부딪힌 순간들
  var hits = [], model = {}, cmp = o.extra, data = o.data;

  function bar(name, val, txt) { return '<div class="g"><span>' + name + '</span><div class="gb"><i style="width:' + Math.max(4, Math.min(100, val)) + '%"></i></div><b>' + txt + '</b></div>'; }

  function graph(liveV, liveP) {
    if (!cmp) return;
    var W = 560, H = 290, L = 56, Rr = 18, T = 34, B = 46, xa = 6, xb = 21, ya = 0, yb = 3.2;
    function X(v) { return L + (v - xa) / (xb - xa) * (W - L - Rr); }
    function Y(p) { return H - B - (p - ya) / (yb - ya) * (H - T - B); }
    var s = '<svg class="graph cmpg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="부피와 압력 그래프. 내 실험값과 입자 모형의 값을 비교한다.">';
    for (var p = 0; p <= 3; p += 0.5) s += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + Y(p) + '" y2="' + Y(p) + '" stroke="#E2E6F3" stroke-width="1"/><text x="' + (L - 8) + '" y="' + (Y(p) + 5) + '" text-anchor="end" font-size="13" fill="#555B80">' + p.toFixed(1) + '</text>';
    for (var v = 6; v <= 21; v++) if (v % 2 === 0) s += '<line x1="' + X(v) + '" x2="' + X(v) + '" y1="' + Y(0) + '" y2="' + (Y(0) + 6) + '" stroke="#1B1F3B" stroke-width="1.5"/><text x="' + X(v) + '" y="' + (Y(0) + 22) + '" text-anchor="middle" font-size="13" fill="#555B80">' + v + '</text>';
    s += '<line x1="' + L + '" x2="' + (W - Rr) + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="#1B1F3B" stroke-width="2"/><line x1="' + L + '" x2="' + L + '" y1="' + T + '" y2="' + Y(0) + '" stroke="#1B1F3B" stroke-width="2"/>';
    s += '<text x="' + ((L + W - Rr) / 2) + '" y="' + (H - 6) + '" text-anchor="middle" font-size="14" font-weight="700" fill="#1B1F3B">부피 (mL)</text><text x="14" y="' + (T - 14) + '" font-size="14" font-weight="700" fill="#1B1F3B">압력 (기압)</text>';
    // 반비례 곡선 (안내선)
    var pts = []; for (var q = 6.5; q <= 21; q += 0.25) pts.push(X(q).toFixed(1) + ',' + Y(20 / q).toFixed(1));
    s += '<polyline fill="none" stroke="#9AA0BF" stroke-width="2" stroke-dasharray="6 5" points="' + pts.join(' ') + '"/>';
    // 내 실험값
    if (data && data.rows.length) data.rows.forEach(function (r) {
      if (r[0] < xa || r[0] > xb || r[1] > yb) return;
      s += '<circle cx="' + X(r[0]) + '" cy="' + Y(r[1]) + '" r="7" fill="#FFD43B" stroke="#1B1F3B" stroke-width="2.5"><title>' + (data.sample ? '예시 자료' : '내 실험값') + ' ' + r[0] + ' mL, ' + r[1].toFixed(2) + '기압</title></circle>';
    });
    // 입자 모형 값
    Object.keys(model).forEach(function (kv) {
      var v = +kv, p = model[kv]; if (p > yb) return; var cx = X(v), cy = Y(p);
      s += '<rect x="' + (cx - 6) + '" y="' + (cy - 6) + '" width="12" height="12" transform="rotate(45 ' + cx + ' ' + cy + ')" fill="#2F4BD8" stroke="#fff" stroke-width="2"><title>입자 모형 ' + v + ' mL, 약 ' + p.toFixed(2) + '기압</title></rect>';
    });
    // 지금 재는 중인 값
    if (liveP != null && liveP <= yb) s += '<rect x="' + (X(liveV) - 7) + '" y="' + (Y(liveP) - 7) + '" width="14" height="14" transform="rotate(45 ' + X(liveV) + ' ' + Y(liveP) + ')" fill="none" stroke="#2F4BD8" stroke-width="2" stroke-dasharray="3 3"/>';
    s += '</svg>';
    var lg = '<div class="cmplg"><span><i class="dy"></i>' + (data ? (data.sample ? '예시 자료' : '내 실험값 (센서)') : '내 실험값') + '</span><span><i class="db"></i>입자 모형</span><span><i class="dl"></i>반비례 곡선</span></div>';
    var note = data ? (data.sample ? '<p class="tiny">노란 점은 <b>예시 자료</b>예요. 앞 단계 표에 우리 모둠 값을 넣으면 내 값으로 바뀌어요.</p>' : '')
      : '<p class="tiny">앞 단계 ‘자료 입력과 그래프’에 값을 넣으면 <b>내 실험값</b>이 노란 점으로 함께 나와요.</p>';
    var n = Object.keys(model).length;
    cmp.innerHTML = '<div class="cmp"><h4>🔍 내가 잰 값 vs 입자 모형</h4>' + lg + s +
      '<p class="tiny">파란 마름모는 모형 속 입자가 <b>양 끝 벽(막힌 끝과 피스톤)</b>에 부딪힌 횟수로 계산한 압력이에요. 20 mL일 때를 1기압으로 맞췄어요. ' +
      (n < 3 ? '슬라이더를 여러 부피에 놓고 <b>잠깐 기다리면</b> 점이 찍혀요. (지금 ' + n + '개)' : '모형의 점도 반비례 곡선을 따라가나요?') + '</p>' + note + '</div>';
  }

  var simT = 0, lastSig = '', run = true, last = performance.now(), frame = 0, mtx = new THREE.Matrix4(), q0 = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  graph();

  function loop(now) {
    if (!run) return;
    if (!document.body.contains(cv)) { stop(); return; }
    requestAnimationFrame(loop);
    var dt = Math.min(0.034, (now - last) / 1000); last = now; frame++; simT += dt * 1000;   // 느린 기기에서도 압력이 맞게: 모형 속 시간으로 재요

    // 피스톤이 목표 부피를 향해 부드럽게 이동
    var moving = Math.abs(vT - vNow) > 0.02;
    if (moving) vNow += (vT - vNow) * (1 - Math.exp(-dt * 3.2)); else { vNow = vT; if (settleAt > simT) settleAt = simT; }
    var xr = X0 + vNow * U;
    piston.position.x = xr; push.visible = vT < VMAX - 0.5;

    var lo = X0 + GAP, hi = xr - GAP, lim = RI - PR;
    for (var i = 0; i < N; i++) {
      var p = P[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      var r2 = p.y * p.y + p.z * p.z;
      if (r2 > lim * lim) {
        var r = Math.sqrt(r2), nx = p.y / r, nz = p.z / r, dn = p.vy * nx + p.vz * nz;
        if (dn > 0) { p.vy -= 2 * dn * nx; p.vz -= 2 * dn * nz; p.hit = now; flash(p.x, nx * RI, nz * RI, now); pop(now); }
        p.y = nx * lim; p.z = nz * lim;
      }
      if (p.x < lo) { p.x = lo; if (p.vx < 0) { p.vx = -p.vx; p.hit = now; hits.push(simT); flash(X0, p.y, p.z, now); pop(now); } }
      if (p.x > hi) { p.x = hi; if (p.vx > 0) { p.vx = -p.vx; p.hit = now; hits.push(simT); flash(xr, p.y, p.z, now); pop(now); } }
      var e = now - p.hit, k2 = 1;
      if (!reduce && e < 170) { var t = e / 170; k2 = 1 + 0.55 * Math.sin(t * Math.PI) * (1 - t); }
      pv.set(p.x, p.y, p.z); sv.set(k2, k2, k2);
      mtx.compose(pv, q0, sv); fill.setMatrixAt(i, mtx); edge.setMatrixAt(i, mtx);
    }
    fill.instanceMatrix.needsUpdate = true; edge.instanceMatrix.needsUpdate = true;
    while (hits.length && hits[0] < simT - 6000) hits.shift();

    for (var j = 0; j < flashes.length; j++) {
      var f = flashes[j]; if (!f.on) continue;
      var u = (now - f.t0) / 230;
      if (u >= 1) { f.on = false; f.s.visible = false; continue; }
      var sz = 0.12 + u * 0.55; f.s.scale.set(sz, sz, 1); f.s.material.opacity = 1 - u;
    }

    yaw += (yawT - yaw) * 0.15; pitch += (pitchT - pitch) * 0.15;
    rig.rotation.y = yaw; rig.rotation.x = pitch;
    renderer.render(scene, camera);

    // 최근 1.5초 충돌 빈도 → 소리
    var c15 = 0; for (var h = hits.length - 1; h >= 0 && hits[h] > simT - 1500; h--) c15++;
    rateNow = c15 / 1.5;

    if (frame % 12 === 0) {
      var c3 = 0; for (var h3 = hits.length - 1; h3 >= 0 && hits[h3] > simT - 3000; h3--) c3++;
      var pTheory = VMAX / vNow, top = expRate(VMIN) * 3;
      o.gauges.innerHTML = bar('주사기 속 부피', vNow / VMAX * 100, vNow.toFixed(0) + ' mL') +
        bar('양 끝 벽에 충돌한 횟수 (3초)', c3 / top * 100, c3 + '번') +
        bar('기체의 압력', pTheory / 3 * 100, '약 ' + pTheory.toFixed(1) + '기압') +
        bar('입자 수 · 크기 · 빠르기', 47, '그대로');
      o.status.textContent = moving ? '피스톤이 움직이는 중…' : vT === VMAX ? '처음 상태예요. 피스톤을 밀어 부피를 줄여 보세요.' : '공간이 좁아져 같은 수의 입자가 벽에 더 자주 부딪혀요 → 압력이 커져요';

      // 멈춘 뒤 2.5초가 지나면, 멈춘 뒤 쌓인 충돌(최대 6초)로 모형의 압력을 계산해 점으로 찍어요
      var live = null;
      if (!moving && simT - settleAt > 600) {
        var win = Math.min(6000, simT - settleAt), cnt = 0;
        for (var h6 = hits.length - 1; h6 >= 0 && hits[h6] > simT - win; h6--) cnt++;
        live = (cnt / (win / 1000)) / R20;
        if (simT - settleAt > 2500) model[vT] = live;
      }
      var sig = Object.keys(model).map(function (kv) { return kv + ':' + model[kv].toFixed(2); }).join('|') + '#' + vNow.toFixed(1) + '#' + (live == null ? '' : live.toFixed(2));
      if (frame % 24 === 0 && sig !== lastSig) { lastSig = sig; graph(vNow, live); }
    }
  }
  requestAnimationFrame(loop);

  function stop() {
    if (!run) return; run = false;
    if (ro) ro.disconnect(); else window.removeEventListener('resize', fit);
    o.slider.removeEventListener('input', onSlide);
    if (sb) sb.removeEventListener('click', onSound);
    box.removeEventListener('pointerdown', firstTouch);
    if (actx) { try { actx.close(); } catch (e) { } }
    scene.traverse(function (ob) { if (ob.geometry) ob.geometry.dispose(); if (ob.material) { if (ob.material.map) ob.material.map.dispose(); ob.material.dispose(); } });
    renderer.dispose();
  }
  return { stop: stop };
}


/* ================= 2·4·6차시 입자 모형 (상자 / 세운 실린더) ================= */
var PINK = 0xA61E6E, COLD = new THREE.Color(0x7FB3E6), WARM = new THREE.Color(0xFF5A1F);

function label(txt, opt) {
  opt = opt || {};
  var c = document.createElement('canvas'), g = c.getContext('2d'), fs = opt.size || 44;
  c.width = opt.w || 320; c.height = fs + 22;
  var tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  var k = (opt.h || 0.42) / c.height; sp.scale.set(c.width * k, c.height * k, 1); sp.renderOrder = 4;
  sp.set = function (t) {
    if (t === sp._t) return; sp._t = t;
    g.clearRect(0, 0, c.width, c.height);
    g.font = '700 ' + fs + 'px "Noto Sans KR", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (opt.pill) { var w = Math.min(c.width - 4, g.measureText(t).width + 30); g.fillStyle = '#fff'; g.strokeStyle = '#1B1F3B'; g.lineWidth = 4; var x0 = (c.width - w) / 2, h = c.height - 6; g.beginPath(); g.roundRect ? g.roundRect(x0, 3, w, h, h / 2) : g.rect(x0, 3, w, h); g.fill(); g.stroke(); }
    g.fillStyle = opt.color || '#1B1F3B'; g.fillText(t, c.width / 2, c.height / 2 + 2);
    tex.needsUpdate = true;
  };
  sp.set(txt);
  return sp;
}

// 공통 무대: 렌더러·카메라·조명·입자·반짝임·소리·돌려 보기·크기 맞추기
function stage(o, cfg) {
  var old = o.canvas, box = old.parentNode, renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { return null; }
  if (!renderer.getContext()) return null;
  var S = { reduce: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches, offs: [] };
  var cv = renderer.domElement; cv.className = 'sim3dcv'; cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', cfg.aria);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setClearColor(BG, 1);
  old.style.display = 'none'; box.insertBefore(cv, old);
  var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 2, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xC9CEE8, 1.1));
  var sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3, 8, 5); scene.add(sun);
  var rig = new THREE.Group(); scene.add(rig);
  (function () {
    var c = document.createElement('canvas'); c.width = c.height = 128; var g = c.getContext('2d');
    var gr = g.createRadialGradient(64, 64, 2, 64, 64, 64); gr.addColorStop(0, 'rgba(27,31,59,0.24)'); gr.addColorStop(0.6, 'rgba(27,31,59,0.08)'); gr.addColorStop(1, 'rgba(27,31,59,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    var sh = new THREE.Mesh(new THREE.PlaneGeometry(cfg.shadow[0], cfg.shadow[1]), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.set(cfg.target[0], cfg.floorY, 0); scene.add(sh);
  })();

  // 입자 (최대 개수만큼 만들어 두고 count로 조절)
  var NM = cfg.nmax;
  S.fill = new THREE.InstancedMesh(new THREE.SphereGeometry(PR * cfg.pscale, 16, 12), new THREE.MeshStandardMaterial({ color: YEL, emissive: YEL, emissiveIntensity: 0.28, roughness: 0.45 }), NM);
  S.edge = new THREE.InstancedMesh(new THREE.SphereGeometry(PR * cfg.pscale * 1.22, 12, 10), new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }), NM);
  rig.add(S.fill); rig.add(S.edge);
  var mtx = new THREE.Matrix4(), q0 = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  S.draw = function (P, now) {
    for (var i = 0; i < P.length; i++) {
      var p = P[i], e = now - p.hit, k = 1;
      if (!S.reduce && e < 170) { var t = e / 170; k = 1 + 0.55 * Math.sin(t * Math.PI) * (1 - t); }
      pv.set(p.x, p.y, p.z); sv.set(k, k, k); mtx.compose(pv, q0, sv); S.fill.setMatrixAt(i, mtx); S.edge.setMatrixAt(i, mtx);
    }
    S.fill.count = S.edge.count = P.length;
    S.fill.instanceMatrix.needsUpdate = true; S.edge.instanceMatrix.needsUpdate = true;
  };

  // 충돌 반짝임
  var ftex = flashTexture(), flashes = [], fi = 0;
  for (var k = 0; k < 48; k++) { var fs = new THREE.Sprite(new THREE.SpriteMaterial({ map: ftex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); fs.visible = false; fs.renderOrder = 3; rig.add(fs); flashes.push({ s: fs, t0: 0, on: false, m: 1 }); }
  S.flash = function (x, y, z, now, m) { if (S.reduce) return; var f = flashes[fi]; fi = (fi + 1) % flashes.length; f.s.position.set(x, y, z); f.t0 = now; f.on = true; f.m = m || 1; f.s.visible = true; };
  function flashTick(now) { for (var j = 0; j < flashes.length; j++) { var f = flashes[j]; if (!f.on) continue; var u = (now - f.t0) / 230; if (u >= 1) { f.on = false; f.s.visible = false; continue; } var sz = (0.12 + u * 0.55) * f.m; f.s.scale.set(sz, sz, 1); f.s.material.opacity = 1 - u; } }

  // 소리: r(충돌 빈도, 기준 1)과 pitch(음 높이, 기준 1)
  var actx = null, soundOn = true, lastSnd = 0, sb = o.sound;
  function audio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { soundOn = false; } } if (actx && actx.state === 'suspended') actx.resume(); }
  S.pop = function (now, r, pitch) {
    if (!soundOn || !actx || actx.state !== 'running') return;
    r = Math.max(0.2, Math.min(r, 3)); pitch = pitch == null ? r : pitch;
    if (now - lastSnd < Math.max(22, 95 - r * 24)) return; lastSnd = now;
    var t0 = actx.currentTime, osc = actx.createOscillator(), gn = actx.createGain(), f0 = 330 + Math.max(0, Math.min(pitch, 3)) * 150;
    osc.type = 'sine'; osc.frequency.setValueAtTime(f0, t0); osc.frequency.exponentialRampToValueAtTime(f0 * 0.35, t0 + 0.05);
    gn.gain.setValueAtTime(0.0001, t0); gn.gain.exponentialRampToValueAtTime(0.06 + Math.min(r, 3) * 0.03, t0 + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    osc.connect(gn).connect(actx.destination); osc.start(t0); osc.stop(t0 + 0.1);
  };
  function paintSound() { if (sb) { sb.textContent = soundOn ? '🔊 충돌 소리 켜짐' : '🔇 충돌 소리 꺼짐'; sb.setAttribute('aria-pressed', soundOn ? 'true' : 'false'); } }
  function onSound() { soundOn = !soundOn; if (soundOn) audio(); paintSound(); }
  if (sb) { sb.hidden = false; sb.addEventListener('click', onSound); paintSound(); }
  function firstTouch() { if (soundOn) audio(); }
  box.addEventListener('pointerdown', firstTouch);
  S.touch = firstTouch;

  // 끌어서 돌려 보기 (두 번 누르면 처음 방향)
  var drag = null, yaw = cfg.yaw, pitch = cfg.pitch, yawT = yaw, pitchT = pitch;
  cv.style.touchAction = 'pan-y';
  cv.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, y: e.clientY, yaw: yawT, pitch: pitchT }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', function (e) { if (!drag) return; yawT = Math.max(-1.2, Math.min(1.2, drag.yaw + (e.clientX - drag.x) * 0.008)); pitchT = Math.max(-0.25, Math.min(0.6, drag.pitch + (e.clientY - drag.y) * 0.004)); });
  function endDrag() { drag = null; } cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('dblclick', function () { yawT = cfg.yaw; pitchT = cfg.pitch; });

  function fit() {
    var w = box.clientWidth || 600, h = Math.round(Math.max(200, Math.min(cfg.hmax, w * (w < 560 ? cfg.ratio[1] : cfg.ratio[0]))));
    renderer.setSize(w, h, false); cv.style.width = '100%'; cv.style.height = h + 'px';
    camera.aspect = w / h;
    var tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), z = Math.max(cfg.half[0] / (tanV * camera.aspect), cfg.half[1] / tanV) + cfg.depth;
    camera.position.set(cfg.target[0], cfg.target[1] + z * 0.22, z); camera.lookAt(cfg.target[0], cfg.target[1], 0);
    camera.updateProjectionMatrix();
  }
  var ro = window.ResizeObserver ? new ResizeObserver(fit) : null;
  if (ro) ro.observe(box); else window.addEventListener('resize', fit);
  fit();

  S.scene = scene; S.rig = rig; S.box = box;
  S.bar = function (name, val, txt) { return '<div class="g"><span>' + name + '</span><div class="gb"><i style="width:' + Math.max(4, Math.min(100, val)) + '%"></i></div><b>' + txt + '</b></div>'; };
  var run = true, last = performance.now();
  S.simT = 0; S.frame = 0;
  S.start = function (step) {
    function loop(now) {
      if (!run) return;
      if (!document.body.contains(cv)) { S.stop(); return; }
      requestAnimationFrame(loop);
      var dt = Math.min(0.034, (now - last) / 1000); last = now; S.frame++; S.simT += dt * 1000;
      step(dt, now);
      flashTick(now);
      yaw += (yawT - yaw) * 0.15; pitch += (pitchT - pitch) * 0.15; rig.rotation.y = yaw; rig.rotation.x = pitch;
      renderer.render(scene, camera);
    }
    requestAnimationFrame(loop);
  };
  S.stop = function () {
    if (!run) return; run = false;
    if (ro) ro.disconnect(); else window.removeEventListener('resize', fit);
    S.offs.forEach(function (f) { f(); });
    if (sb) sb.removeEventListener('click', onSound);
    box.removeEventListener('pointerdown', firstTouch);
    if (actx) { try { actx.close(); } catch (e) { } }
    scene.traverse(function (ob) { if (ob.geometry) ob.geometry.dispose(); if (ob.material) { if (ob.material.map) ob.material.map.dispose(); ob.material.dispose(); } });
    renderer.dispose();
  };
  return S;
}

function randDir(speed) {
  var d = new THREE.Vector3(1, 1, 1);
  do d.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1); while (d.lengthSq() > 1 || d.lengthSq() < 0.01);
  return d.normalize().multiplyScalar(speed);
}
function lv(x) { return x < 0.8 ? '작음' : x > 1.25 ? '큼' : '보통'; }

/* 2차시: 풍선 속을 확대한 상자 — 입자 수를 바꾸면 네 벽의 충돌 횟수가 어떻게 될까 */
function box3D(o) {
  var HB = 2;                    // 상자 반쪽 길이 (정육면체)
  var NMX = 60, SP = 3.0;
  var S = stage(o, { aria: '풍선 속을 확대한 상자 모형. 노란 입자들이 모든 방향으로 움직이며 여섯 벽에 충돌한다. 위·아래·왼쪽·오른쪽 벽에 3초 동안 충돌한 횟수가 표시된다.', nmax: NMX, pscale: 1.25, shadow: [7, 3], floorY: -2.6, target: [0, 0.1], half: [3.9, 3.1], depth: 2.2, ratio: [0.62, 0.86], hmax: 430, yaw: -0.42, pitch: 0.28 });
  if (!S) return null;
  var THREEg = THREE, rig = S.rig;
  var glass = new THREEg.Mesh(new THREEg.BoxGeometry(HB * 2 + 0.1, HB * 2 + 0.1, HB * 2 + 0.1), new THREEg.MeshStandardMaterial({ color: 0xBFD8FF, transparent: true, opacity: 0.16, roughness: 0.1, side: THREEg.DoubleSide, depthWrite: false }));
  glass.renderOrder = 2; rig.add(glass);
  var edges = new THREEg.LineSegments(new THREEg.EdgesGeometry(new THREEg.BoxGeometry(HB * 2 + 0.1, HB * 2 + 0.1, HB * 2 + 0.1)), new THREEg.LineBasicMaterial({ color: INK }));
  rig.add(edges);
  // 이름표가 붙은 네 벽은 살짝 색을 입혀 구분
  var wallMat = new THREEg.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.07, side: THREEg.DoubleSide, depthWrite: false });
  [[0, HB, 0, -Math.PI / 2, 0], [0, -HB, 0, Math.PI / 2, 0], [-HB, 0, 0, 0, Math.PI / 2], [HB, 0, 0, 0, -Math.PI / 2]].forEach(function (w) {
    var m = new THREEg.Mesh(new THREEg.PlaneGeometry(HB * 2, HB * 2), wallMat); m.position.set(w[0], w[1], w[2]); m.rotation.set(w[3], w[4], 0); m.renderOrder = 1; rig.add(m);
  });
  var L = { top: label('위 0번', { pill: 1, h: 0.58 }), bot: label('아래 0번', { pill: 1, h: 0.58 }), left: label('왼쪽 0번', { pill: 1, h: 0.58 }), right: label('오른쪽 0번', { pill: 1, h: 0.58 }) };
  L.top.position.set(0, HB + 0.62, 0); L.bot.position.set(0, -HB - 0.62, 0); L.left.position.set(-HB - 1.25, 0, 0); L.right.position.set(HB + 1.35, 0, 0);
  Object.keys(L).forEach(function (k) { rig.add(L[k]); });

  var P = [], W = { top: [], bot: [], left: [], right: [], other: [] };
  function setN(n) {
    while (P.length < n) { var d = randDir(SP); P.push({ x: (Math.random() * 2 - 1) * (HB - PR * 2), y: (Math.random() * 2 - 1) * (HB - PR * 2), z: (Math.random() * 2 - 1) * (HB - PR * 2), vx: d.x, vy: d.y, vz: d.z, hit: -1e9 }); }
    P.length = n;
  }
  function onSlide() { var n = +o.slider.value; setN(n); o.out.textContent = n + '개'; S.touch(); }
  o.slider.addEventListener('input', onSlide); S.offs.push(function () { o.slider.removeEventListener('input', onSlide); });
  setN(+o.slider.value || 25);
  var lim = HB - PR * 1.25, ref = 25 * SP / 2 / (2 * HB) * 6;  // 입자 25개일 때 여섯 벽 전체 충돌 빈도(대략) = 소리 기준

  S.start(function (dt, now) {
    var T = S.simT;
    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.x < -lim) { p.x = -lim; if (p.vx < 0) { p.vx = -p.vx; p.hit = now; W.left.push(T); S.flash(-HB, p.y, p.z, now); S.pop(now, rate / ref); } }
      if (p.x > lim) { p.x = lim; if (p.vx > 0) { p.vx = -p.vx; p.hit = now; W.right.push(T); S.flash(HB, p.y, p.z, now); S.pop(now, rate / ref); } }
      if (p.y < -lim) { p.y = -lim; if (p.vy < 0) { p.vy = -p.vy; p.hit = now; W.bot.push(T); S.flash(p.x, -HB, p.z, now); S.pop(now, rate / ref); } }
      if (p.y > lim) { p.y = lim; if (p.vy > 0) { p.vy = -p.vy; p.hit = now; W.top.push(T); S.flash(p.x, HB, p.z, now); S.pop(now, rate / ref); } }
      if (p.z < -lim) { p.z = -lim; if (p.vz < 0) { p.vz = -p.vz; p.hit = now; W.other.push(T); S.flash(p.x, p.y, -HB, now); S.pop(now, rate / ref); } }
      if (p.z > lim) { p.z = lim; if (p.vz > 0) { p.vz = -p.vz; p.hit = now; W.other.push(T); S.flash(p.x, p.y, HB, now); S.pop(now, rate / ref); } }
    }
    S.draw(P, now);
    var c = {}; Object.keys(W).forEach(function (k) { var a = W[k]; while (a.length && a[0] < T - 3000) a.shift(); c[k] = a.length; });
    var all = c.top + c.bot + c.left + c.right + c.other; rate = all / 3;
    if (S.frame % 12 === 0) {
      L.top.set('위 ' + c.top + '번'); L.bot.set('아래 ' + c.bot + '번'); L.left.set('왼쪽 ' + c.left + '번'); L.right.set('오른쪽 ' + c.right + '번');
      var four = c.top + c.bot + c.left + c.right, top = NMX * SP / 2 / (2 * HB) * 4 * 3;
      o.gauges.innerHTML = S.bar('입자 수', P.length / NMX * 100, P.length + '개') + S.bar('네 벽 충돌 횟수 (3초)', four / top * 100, four + '번');
      o.status.textContent = '네 벽의 숫자를 비교해 보세요.';
    }
  });
  var rate = 0;
  return { stop: S.stop };
}

/* 4차시(바깥 압력)·6차시(온도): 교과서 그림처럼 세운 실린더와 위에서 누르는 피스톤 */
function cyl3D(o, mode) {
  var RC = 1.45, YB = -2.3, HW = 5.3, NP = 40, V0 = 2.7;
  var L1 = mode === 'boyle' ? 2.4 : 2.9;     // 1기압·20 ℃일 때 기체 기둥 높이
  var GAPc = 0.02;
  var S = stage(o, { aria: mode === 'boyle' ? '세운 실린더 속 입자 모형. 위에서 바깥 압력이 피스톤을 누르고, 노란 입자들이 피스톤과 벽에 충돌한다. 바깥 압력을 바꾸면 피스톤이 움직이다가 멈춘다.' : '세운 실린더 속 입자 모형. 아래 가열판의 온도를 바꾸면 노란 입자의 빠르기가 달라지고, 피스톤이 움직이다가 멈춘다.', nmax: NP, pscale: 1.25, shadow: [5, 3.2], floorY: YB - 0.75, target: [0.35, 0.65], half: [3.3, 3.8], depth: 2.4, ratio: [0.66, 0.95], hmax: 470, yaw: -0.3, pitch: 0.16 });
  if (!S) return null;
  var rig = S.rig;
  var inkMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.55 }), pinkMat = new THREE.MeshStandardMaterial({ color: PINK, roughness: 0.5 });
  var glass = new THREE.Mesh(new THREE.CylinderGeometry(RC + 0.05, RC + 0.05, HW, 48, 1, true), new THREE.MeshStandardMaterial({ color: 0xBFD8FF, transparent: true, opacity: 0.18, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false }));
  glass.position.y = YB + HW / 2; glass.renderOrder = 2; rig.add(glass);
  var rimGeo = new THREE.TorusGeometry(RC + 0.05, 0.035, 8, 48); rimGeo.rotateX(Math.PI / 2);
  var rim = new THREE.Mesh(rimGeo, inkMat); rim.position.y = YB + HW; rig.add(rim);
  var base = new THREE.Mesh(new THREE.CylinderGeometry(RC + 0.12, RC + 0.12, 0.18, 48), inkMat); base.position.y = YB - 0.09; rig.add(base);
  var heat = null, heatMat = null, tLab = null;
  if (mode === 'charles') {
    heatMat = new THREE.MeshStandardMaterial({ color: 0xFF7A3D, emissive: 0xFF5A1F, emissiveIntensity: 0.3, roughness: 0.6 });
    heat = new THREE.Mesh(new THREE.CylinderGeometry(RC + 0.35, RC + 0.45, 0.32, 48), heatMat); heat.position.y = YB - 0.36; rig.add(heat);
    tLab = label('온도 20 ℃', { pill: 1, w: 360, h: 0.56 }); tLab.position.set(RC + 1.9, YB - 0.3, 0); rig.add(tLab);
  }
  // 피스톤 (위아래로 움직임)
  var piston = new THREE.Group(); rig.add(piston);
  var disc = new THREE.Mesh(new THREE.CylinderGeometry(RC - 0.01, RC - 0.01, 0.3, 48), inkMat); disc.position.y = 0.15; piston.add(disc);
  var knob = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.35, 16), inkMat); knob.position.y = 0.45; piston.add(knob);
  var arrows = new THREE.Group(); piston.add(arrows);
  var pLab = label(mode === 'boyle' ? '바깥 압력' : '바깥 압력 (일정)', { color: '#A61E6E', w: 440, pill: 1, h: 0.5 }); piston.add(pLab);
  var shaftG = new THREE.CylinderGeometry(0.07, 0.07, 0.7, 12), headG = new THREE.ConeGeometry(0.2, 0.32, 16); headG.rotateX(Math.PI);
  var nArrow = -1;
  function setArrows(n) {
    if (n === nArrow) return; nArrow = n;
    while (arrows.children.length) arrows.remove(arrows.children[0]);
    for (var i = 0; i < n; i++) {
      var a = new THREE.Group(), sh = new THREE.Mesh(shaftG, pinkMat), hd = new THREE.Mesh(headG, pinkMat);
      sh.position.y = 0.66; hd.position.y = 0.16; a.add(sh); a.add(hd);
      var ang = n === 1 ? 0 : (i / n) * Math.PI * 2, rr = n === 1 ? 0 : (n <= 3 ? 0.75 : 0.85);
      a.position.set(Math.sin(ang) * rr, 0.62, Math.cos(ang) * rr); arrows.add(a);
    }
    pLab.position.set(0, 1.62, 0);
  }

  var P = [], sp = 1, tL = L1, L = L1, Pex = 1, Tc = 20;
  for (var i = 0; i < NP; i++) {
    var a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * (RC - PR * 1.5), d = randDir(V0);
    P.push({ x: rr * Math.cos(a), z: rr * Math.sin(a), y: YB + PR + Math.random() * (L1 - 2 * PR), vx: d.x, vy: d.y, vz: d.z, hit: -1e9 });
  }
  var sumVy = P.reduce(function (t, p) { return t + Math.abs(p.vy); }, 0), ref = sumVy / L1;  // 처음(1기압·20 ℃) 위아래 벽 충돌 빈도
  function onSlide(ev) {
    var v = parseFloat(o.slider.value);
    if (mode === 'boyle') { Pex = v; tL = L1 / v; o.out.textContent = v.toFixed(1) + '기압'; setArrows(Math.max(1, Math.round(v * 3))); }
    else {
      var nsp = Math.sqrt((273 + v) / 293), k = nsp / sp; sp = nsp; Tc = v;
      P.forEach(function (p) { p.vx *= k; p.vy *= k; p.vz *= k; });
      tL = L1 * (273 + v) / 293; o.out.textContent = v + ' ℃'; setArrows(3);
      tLab.set('온도 ' + v + ' ℃');
      var h = v / 80; heatMat.color.lerpColors(COLD, WARM, h); heatMat.emissive.lerpColors(COLD, WARM, h); heatMat.emissiveIntensity = 0.12 + h * 0.8;
    }
    if (ev) S.touch();
  }
  o.slider.addEventListener('input', onSlide); S.offs.push(function () { o.slider.removeEventListener('input', onSlide); });
  onSlide(); L = tL;
  var hits = [], lim = RC - PR * 1.25, rate = 0;

  S.start(function (dt, now) {
    var T = S.simT, moving = Math.abs(tL - L) > 0.01;
    if (moving) L += (tL - L) * (1 - Math.exp(-dt * 1.8)); else L = tL;
    var top = YB + L; piston.position.y = top;
    var strong = sp * sp, fm = mode === 'charles' ? 0.6 + 0.5 * strong : 1;
    var r = rate / ref, pitch = mode === 'charles' ? 0.4 + (strong - 0.93) * 4 : r;
    for (var i = 0; i < P.length; i++) {
      var p = P[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      var r2 = p.x * p.x + p.z * p.z;
      if (r2 > lim * lim) { var rr = Math.sqrt(r2), nx = p.x / rr, nz = p.z / rr, dn = p.vx * nx + p.vz * nz; if (dn > 0) { p.vx -= 2 * dn * nx; p.vz -= 2 * dn * nz; p.hit = now; S.flash(nx * RC, p.y, nz * RC, now, fm); S.pop(now, r, pitch); } p.x = nx * lim; p.z = nz * lim; }
      if (p.y < YB + GAPc) { p.y = YB + GAPc; if (p.vy < 0) { p.vy = -p.vy; p.hit = now; hits.push(T); S.flash(p.x, YB, p.z, now, fm); S.pop(now, r, pitch); } }
      if (p.y > top - GAPc) { p.y = top - GAPc; if (p.vy > 0) { p.vy = -p.vy; p.hit = now; hits.push(T); S.flash(p.x, top, p.z, now, fm); S.pop(now, r, pitch); } }
    }
    S.draw(P, now);
    while (hits.length && hits[0] < T - 3000) hits.shift();
    var c15 = 0; for (var h = hits.length - 1; h >= 0 && hits[h] > T - 1500; h--) c15++; rate = c15 / 1.5;
    if (S.frame % 12 === 0) {
      var vol = L / L1, c3 = hits.length, g;
      if (mode === 'boyle') {
        g = S.bar('기체의 부피', vol * 50, lv(vol)) + S.bar('피스톤·바닥에 충돌한 횟수 (3초)', c3 / (ref * 2 * 3) * 100, c3 + '번') + S.bar('입자의 운동 빠르기', 50, '그대로') + S.bar('입자 수', 47, NP + '개 그대로');
        o.status.textContent = moving ? (tL < L ? '바깥 압력이 더 커요 → 피스톤이 안으로 밀려요' : '기체의 압력이 더 커요 → 피스톤이 밖으로 밀려요') : '바깥 압력 = 기체의 압력 → 피스톤이 멈췄어요';
      } else {
        g = S.bar('입자의 운동 빠르기', strong * 50, lv(strong)) + S.bar('충돌 세기', strong * 50, lv(strong)) + S.bar('기체의 부피', vol * 50, lv(vol)) + S.bar('입자 수', 47, NP + '개 그대로');
        o.status.textContent = moving ? (tL > L ? '입자가 벽을 더 세게 밀어요 → 피스톤이 밖으로 밀려요' : '입자가 벽을 약하게 밀어요 → 피스톤이 안으로 밀려요') : '바깥 압력 = 기체의 압력 → 피스톤이 멈췄어요';
      }
      o.gauges.innerHTML = g;
    }
  });
  return { stop: S.stop };
}

export function particles3D(o) {
  if (o.mode === 'syringe') return syringe3D(o);
  if (o.mode === 'box') return box3D(o);
  if (o.mode === 'boyle' || o.mode === 'charles') return cyl3D(o, o.mode);
  return null;
}

// app.js가 <script type="module">로 불러온 뒤 찾을 수 있게
window.GasSim3D = { syringe3D: syringe3D, particles3D: particles3D };
