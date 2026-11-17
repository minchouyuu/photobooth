/* ================= CẤU HÌNH ================= */
const SHOTS = 6;            // số tấm chụp tối đa
const ROOT = 'files/';      // thư mục chứa frame/ và decor/
const PAD = 3;              // lấn viền nhẹ 3px để lấp kín khung

const SLOTS_4 = [[69, 51, 423, 538], [537, 51, 412, 538], [69, 626, 423, 538], [525, 616, 435, 558]];
const SLOTS_2 = [[85, 50, 538, 412], [83, 544, 540, 413], [98, 1058, 508, 374]];
const SLOTS_3 = [[85, 50, 538, 412], [85, 544, 538, 413], [100, 1040, 520, 410]];

const FRAMES = [
  { name: 'Frame 1',   src: 'frame/frame 1.png',   slots: SLOTS_4 },
  { name: 'Frame 1.1', src: 'frame/frame 1.1.png', slots: SLOTS_4 },
  { name: 'Frame 1.2', src: 'frame/frame 1.2.png', slots: SLOTS_4 },
  { name: 'Frame 2',   src: 'frame/frame 2.png',   slots: SLOTS_2 },
  { name: 'Frame 2.1', src: 'frame/frame 2.1.png', slots: SLOTS_2 },
  { name: 'Frame 2.2', src: 'frame/frame 2.2.png', slots: SLOTS_2 },
  { name: 'Frame 3',   src: 'frame/frame 3.png',   slots: SLOTS_3 },
  { name: 'Frame 3.1', src: 'frame/frame 3.1.png', slots: SLOTS_3 },
  { name: 'Frame 3.2', src: 'frame/frame 3.2.png', slots: SLOTS_3 },
];

const FILTERS = [
  { name: 'Gốc', dot: '#fefaf6' },
  { name: 'Kem', on: 1, b: 1.08, lift: .08, c: 1.03, s: .94, wb: [1.05, 1.02, .94], dot: '#f6e3c8' },
  { name: 'Hồng phấn', on: 1, b: 1.10, lift: .10, c: 1.02, s: 1.04, wb: [1.07, .98, 1.03], dot: '#f2bcd3' },
  { name: 'Xanh sương', on: 1, b: 1.09, lift: .09, c: 1.04, s: .92, wb: [.95, 1.01, 1.08], dot: '#a9cbf3' },
  { name: 'Mơ màng', on: 1, b: 1.14, lift: .14, c: .93, s: .96, wb: [1.04, .99, 1.06], fade: 10, dot: '#e4d4f4' },
  { name: 'Film', on: 1, b: 1.0, lift: 0, c: 1.12, s: .78, wb: [1.05, 1.0, .92], fade: 14, dot: '#d9b99b' },
  { name: 'Đen trắng', on: 1, b: 1.02, lift: .03, c: 1.15, s: 0, wb: [1, 1, 1], dot: '#6b6b6b' },
];

/* ================= KHỞI TẠO ================= */
const $ = id => document.getElementById(id);
const asset = p => encodeURI(ROOT + p);
const wait = ms => new Promise(r => setTimeout(r, ms));
const cv = $('cv'), ctx = cv.getContext('2d'), vid = $('vid'), cd = $('cd');
const camOverlay = $('camOverlay'), octx = camOverlay.getContext('2d');

let stream = null, running = false, cancel = false;
let waitSec = 5;
let targetCount = 4;
let activeSlotIdx = 0;
let photos = [], thumbs = [], picked = [];
let step = 1, fi = 0, filt = 0;
const cache = new Map();

// nạp decor + nền + ren
document.querySelectorAll('[data-d]').forEach(e => { e.src = asset('decor/' + e.dataset.d); e.onerror = () => e.remove(); });
document.body.style.setProperty('--bg', `url("${asset('decor/nền.png')}")`);
document.body.style.setProperty('--ren', `url("${asset('decor/ren.png')}")`);

// nạp frame
const imgs = FRAMES.map((f, idx) => {
  const i = new Image();
  i.onload = () => {
    if (step === 1 && idx === fi) drawCamOverlay();
    if (step > 1) draw();
  };
  i.onerror = () => toast(`Không tìm thấy "${ROOT + f.src}". Kiểm tra lại thư mục files/frame/.`);
  i.src = asset(f.src);
  return i;
});

let tt;
function toast(t) {
  const el = $('toast');
  el.textContent = t; el.classList.add('show');
  clearTimeout(tt); tt = setTimeout(() => el.classList.remove('show'), 4000);
}
const say = t => { $('msg').textContent = t; };

// Chọn thời gian đếm ngược (3s / 5s / 8s)
document.querySelectorAll('.t-btn').forEach(btn => {
  btn.onclick = () => {
    if (running) return;
    waitSec = Number(btn.dataset.sec);
    document.querySelectorAll('.t-btn').forEach(b => b.setAttribute('aria-pressed', b === btn));
  };
});

// Đồng bộ giao diện camera dọc (4 ảnh) hoặc ngang (3 ảnh)
function syncOrientation() {
  targetCount = FRAMES[fi].slots.length;
  const isPortrait = targetCount === 4;
  $('s1').classList.toggle('portrait-mode', isPortrait);
  $('editor').classList.toggle('portrait-mode', isPortrait);
  drawCamOverlay();
}

// Vẽ lớp phủ frame lên màn hình camera
function drawCamOverlay() {
  const show = $('showFrameCam').checked;
  const totalSlots = FRAMES[fi].slots.length;
  camOverlay.hidden = !show;
  $('slotBadge').hidden = !show;

  if (!show) return;
  $('slotBadge').textContent = `Ô ${(activeSlotIdx % totalSlots) + 1}/${totalSlots}`;

  const im = imgs[fi];
  const slot = FRAMES[fi].slots[activeSlotIdx % totalSlots];
  if (!slot) return;

  const [sx, sy, sw, sh] = slot;
  camOverlay.width = sw;
  camOverlay.height = sh;
  octx.clearRect(0, 0, sw, sh);

  if (im && im.naturalWidth) {
    octx.drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh);
  }

  octx.save();
  octx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  octx.lineWidth = 2;
  octx.setLineDash([8, 6]);
  octx.strokeRect(4, 4, sw - 8, sh - 8);
  octx.restore();
}

// Dựng danh sách chọn nhanh Frame ngay tại Bước 1
function buildPreFrames() {
  const box = $('preFrames');
  box.innerHTML = '';
  FRAMES.forEach((f, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pre-frame-btn';
    b.setAttribute('aria-pressed', i === fi);
    b.innerHTML = `<img src="${asset(f.src)}" alt="${f.name}"><span>${f.name}</span><small>${f.slots.length} ảnh</small>`;
    b.onclick = () => {
      if (running) return;
      fi = i;
      activeSlotIdx = 0;
      buildPreFrames();
      syncOrientation();
    };
    box.appendChild(b);
  });
}

/* ================= BƯỚC 1: CHỤP & TẢI ẢNH ================= */
function buildRolls() {
  $('rolls').innerHTML = '';
  for (let i = 0; i < SHOTS; i++) {
    const li = document.createElement('li');
    li.textContent = i + 1;
    $('rolls').appendChild(li);
  }
}

function ui1() {
  $('go').textContent = !stream ? 'Bật camera' : running ? 'Đang chụp…' : 'Bắt đầu chụp';
  $('go').disabled = running;
  $('stop').hidden = !running;
  document.querySelectorAll('.pre-frame-btn, .t-btn').forEach(b => { b.disabled = running; });
}

async function startCam() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false
    });
    vid.srcObject = stream;
    await vid.play();
    $('camEmpty').hidden = true;
    say(`Sẵn sàng rồi! Web sẽ chụp ${SHOTS} tấm, mỗi tấm đếm ngược ${waitSec} giây.`);
    drawCamOverlay();
  } catch (e) {
    say('Không mở được camera. Hãy cho phép quyền camera hoặc dùng nút “Tải ảnh lên”.');
  }
  ui1();
}

function cropToSlotRatio(source, w, h, mirror = false) {
  const targetRatio = targetCount === 4 ? (3 / 4) : (4 / 3);
  const srcRatio = w / h;
  let sw = w, sh = h, sx = 0, sy = 0;

  if (srcRatio > targetRatio) {
    sw = Math.round(h * targetRatio);
    sx = Math.round((w - sw) / 2);
  } else {
    sh = Math.round(w / targetRatio);
    sy = Math.round((h - sh) / 2);
  }

  const c = document.createElement('canvas');
  c.width = sw;
  c.height = sh;
  const x = c.getContext('2d');
  if (mirror) {
    x.translate(c.width, 0);
    x.scale(-1, 1);
  }
  x.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return c;
}

function snap() {
  return cropToSlotRatio(vid, vid.videoWidth, vid.videoHeight, $('mirror').checked);
}

async function shoot() {
  running = true; cancel = false;
  photos = []; thumbs = []; picked = []; cache.clear();
  buildRolls(); ui1();

  const totalSlots = FRAMES[fi].slots.length;

  for (let i = 0; i < SHOTS && !cancel; i++) {
    activeSlotIdx = i % totalSlots;
    drawCamOverlay();

    say(`Tấm ${i + 1}/${SHOTS} (căn theo ô ${activeSlotIdx + 1}/${totalSlots}) — tạo dáng nhé!`);
    for (let t = waitSec; t > 0 && !cancel; t--) {
      cd.textContent = t;
      cd.classList.remove('pop'); void cd.offsetWidth; cd.classList.add('pop');
      await wait(1000);
    }
    cd.textContent = '';
    if (cancel) break;

    photos.push(snap());
    thumbs.push(photos[i].toDataURL('image/jpeg', .8));
    $('flash').classList.remove('on'); void $('flash').offsetWidth; $('flash').classList.add('on');
    $('rolls').children[i].innerHTML = `<img src="${thumbs[i]}" alt="Ảnh ${i + 1}">`;
    await wait(500);
  }

  running = false;
  activeSlotIdx = 0;
  drawCamOverlay();
  ui1();

  if (cancel) {
    photos = []; thumbs = []; buildRolls();
    say('Đã dừng. Bấm “Bắt đầu chụp” khi bạn sẵn sàng.');
    return;
  }
  buildPicks();
  setStep(2);
}

// Tính năng tải ảnh có sẵn từ máy lên
$('uploadInput').onchange = async e => {
  const files = [...e.target.files].slice(0, SHOTS);
  if (!files.length) return;
  if (files.length < targetCount) {
    toast(`Frame này cần ít nhất ${targetCount} ảnh nhé.`);
    e.target.value = '';
    return;
  }

  photos = []; thumbs = []; picked = []; cache.clear();
  for (const file of files) {
    const url = URL.createObjectURL(file);
    const img = await new Promise(res => {
      const i = new Image();
      i.onload = () => res(i);
      i.src = url;
    });
    const canvas = cropToSlotRatio(img, img.naturalWidth, img.naturalHeight, false);
    photos.push(canvas);
    thumbs.push(canvas.toDataURL('image/jpeg', .8));
    URL.revokeObjectURL(url);
  }

  // Tự động chọn sẵn đúng số ảnh đầu tiên cho tiện
  picked = photos.slice(0, targetCount).map((_, idx) => idx);
  e.target.value = '';
  buildPicks();
  setStep(2);
};

$('go').onclick = () => (stream ? shoot() : startCam());
$('stop').onclick = () => { cancel = true; };
$('mirror').onchange = () => vid.classList.toggle('flip', $('mirror').checked);
$('showFrameCam').onchange = drawCamOverlay;

/* ================= BƯỚC 2: CHỌN ẢNH ================= */
function buildPicks() {
  const g = $('picks');
  g.innerHTML = '';
  thumbs.forEach((src, i) => {
    const b = document.createElement('button');
    b.className = 'pick';
    b.innerHTML = `<img src="${src}" alt="Ảnh ${i + 1}"><span></span>`;
    b.onclick = () => togglePick(i);
    g.appendChild(b);
  });
  refreshPicks();
}
function togglePick(i) {
  const k = picked.indexOf(i);
  if (k >= 0) picked.splice(k, 1);
  else if (picked.length < targetCount) picked.push(i);
  else return toast(`Frame bạn chọn cần ${targetCount} ảnh.`);
  refreshPicks(); draw();
}
function refreshPicks() {
  [...$('picks').children].forEach((b, i) => {
    const k = picked.indexOf(i);
    b.setAttribute('aria-pressed', k >= 0);
    b.lastChild.textContent = k >= 0 ? k + 1 : '';
  });
  $('hint2').textContent = `Đã chọn ${picked.length}/${targetCount} ảnh cho ${FRAMES[fi].name}. Số trên góc là thứ tự vào khung.`;
}

$('autoPick').onclick = () => {
  picked = photos.slice(0, targetCount).map((_, i) => i);
  refreshPicks(); draw();
};
$('clearPick').onclick = () => {
  picked = [];
  refreshPicks(); draw();
};

/* ================= BƯỚC 3: CHỌN FRAME ================= */
function buildFrames() {
  const box = $('frames');
  box.innerHTML = '';
  FRAMES.forEach((f, i) => {
    if (f.slots.length !== targetCount) return;
    const b = document.createElement('button');
    b.className = 'frame-opt';
    b.setAttribute('aria-pressed', i === fi);
    b.innerHTML = `<img src="${asset(f.src)}" alt="${f.name}"><small>${f.name}</small>`;
    b.onclick = () => { fi = i; buildFrames(); draw(); };
    box.appendChild(b);
  });
  $('hint3').textContent = `Đang hiển thị các mẫu Frame ${targetCount} ảnh.`;
}

/* ================= BƯỚC 4: FILTER ================= */
function buildChips() {
  const box = $('chips');
  box.innerHTML = '';
  FILTERS.forEach((f, i) => {
    const b = document.createElement('button');
    b.className = 'chip';
    b.setAttribute('aria-pressed', i === filt);
    b.innerHTML = `<i style="background:${f.dot}"></i>${f.name}`;
    b.onclick = () => { filt = i; buildChips(); draw(); };
    box.appendChild(b);
  });
}

function applyFilter(src, f) {
  const c = document.createElement('canvas');
  c.width = src.width; c.height = src.height;
  const x = c.getContext('2d');
  x.drawImage(src, 0, 0);
  if (!f.on) return c;

  const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
  const { b = 1, lift = 0, c: ct = 1, s = 1, wb = [1, 1, 1], fade = 0 } = f;
  const k = 1 - fade / 255;

  for (let i = 0; i < p.length; i += 4) {
    let r = p[i] / 255, g = p[i + 1] / 255, bl = p[i + 2] / 255;

    if (lift > 0) {
      r = r + lift * r * (1 - r);
      g = g + lift * g * (1 - g);
      bl = bl + lift * bl * (1 - bl);
    }
    r *= b * wb[0];
    g *= b * wb[1];
    bl *= b * wb[2];

    r = (r - 0.5) * ct + 0.5;
    g = (g - 0.5) * ct + 0.5;
    bl = (bl - 0.5) * ct + 0.5;

    const l = 0.299 * r + 0.587 * g + 0.114 * bl;
    r = l + (r - l) * s;
    g = l + (g - l) * s;
    bl = l + (bl - l) * s;

    p[i]     = Math.max(0, Math.min(255, r * 255 * k + fade));
    p[i + 1] = Math.max(0, Math.min(255, g * 255 * k + fade));
    p[i + 2] = Math.max(0, Math.min(255, bl * 255 * k + fade));
  }
  x.putImageData(d, 0, 0);
  return c;
}

function filtered(idx) {
  const key = idx + '|' + filt;
  if (!cache.has(key)) cache.set(key, applyFilter(photos[idx], FILTERS[filt]));
  return cache.get(key);
}

/* ================= VẼ DẢI ẢNH ================= */
function coverSlot(c, src, [x, y, w, h]) {
  const r = Math.max(w / src.width, h / src.height);
  const cw = w / r;
  const ch = h / r;
  const sx = (src.width - cw) / 2;
  const sy = (src.height - ch) / 2;
  c.drawImage(src, sx, sy, cw, ch, x, y, w, h);
}

function draw() {
  const im = imgs[fi];
  if (!im.naturalWidth) return;
  cv.width = im.naturalWidth; cv.height = im.naturalHeight;
  cv.style.setProperty('--ar', cv.height / cv.width);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cv.width, cv.height);

  FRAMES[fi].slots.forEach(([x, y, w, h], i) => {
    const r = [x - PAD, y - PAD, w + PAD * 2, h + PAD * 2];
    if (picked[i] === undefined) {
      ctx.fillStyle = '#fbe8f1';
      ctx.fillRect(...r);
    } else {
      coverSlot(ctx, filtered(picked[i]), r);
    }
  });
  ctx.drawImage(im, 0, 0);
}

/* ================= ĐIỀU HƯỚNG ================= */
const LABELS = { 2: ['Chụp lại', 'Tiếp tục'], 3: ['Quay lại', 'Tiếp tục'], 4: ['Quay lại', 'Lưu ảnh'] };

// Cho phép bấm trực tiếp vào các bước đã hoàn thành trên thanh tiến trình
[...$('steps').children].forEach((li, i) => {
  li.onclick = () => {
    const targetStep = i + 1;
    if (targetStep === 1 && step > 1) restart();
    else if (targetStep > 1 && targetStep < step) setStep(targetStep);
  };
});

function setStep(s) {
  step = s;
  $('s1').hidden = s !== 1;
  $('editor').hidden = s === 1;
  [2, 3, 4].forEach(k => { $('p' + k).hidden = s !== k; });
  [...$('steps').children].forEach((li, i) => { li.className = i + 1 < s ? 'done' : i + 1 === s ? 'on' : ''; });

  if (s === 1) {
    buildPreFrames();
    syncOrientation();
  }
  if (s === 3) buildFrames();
  if (s === 4) buildChips();
  if (s > 1) {
    $('back').textContent = LABELS[s][0];
    $('next').textContent = LABELS[s][1];
    $('again').hidden = s < 3;
    draw();
  }
  window.scrollTo(0, 0);
}

function restart() {
  photos = []; thumbs = []; picked = []; cache.clear();
  activeSlotIdx = 0;
  filt = 0;
  buildRolls();
  say('Chọn mẫu frame rồi bấm “Bắt đầu chụp” khi bạn sẵn sàng.');
  setStep(1); ui1();
}

$('back').onclick = () => (step === 2 ? restart() : setStep(step - 1));
$('again').onclick = restart;
$('next').onclick = () => {
  if (step === 2) {
    if (picked.length < targetCount) return toast(`Hãy chọn đủ ${targetCount} ảnh nhé.`);
    setStep(3);
  } else if (step === 3) setStep(4);
  else save();
};

function save() {
  draw();
  try {
    cv.toBlob(b => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `photobooth-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
  } catch (e) {
    toast('Không lưu được. Hãy mở trang qua localhost hoặc GitHub Pages.');
  }
}

buildPreFrames();
syncOrientation();
buildRolls();
ui1();
