// Mục 3.5 – Concurrency control trên Cloud Firestore THẬT (project ticketrush-5a616), dùng Admin SDK như backend.
// Mọi dữ liệu thử nằm dưới một document riêng ccLab/run và bị xóa sạch trước và sau mỗi thí nghiệm,
// không đụng tới events, queues, validTickets… của ứng dụng.
//   node fs.mjs tn1 [--n=500 --seats=50 --think=5 --conc=50]   Giờ G: không transaction / runTransaction / runTransaction chọn ghế ngẫu nhiên
//   node fs.mjs tn2 [--k=100 --trials=10]                      Lost update trên bộ đếm; write skew giới hạn 4 vé
//   node fs.mjs tn3 [--trials=5]                               Hai transaction đọc–ghi hai document ngược thứ tự
//   node fs.mjs tn4 [--n=100]                                  Điểm nóng: một document chung (như queues/{eventId}.next)
//   node fs.mjs all | clean
//   Thêm --emulator để chạy thử trên Firestore Emulator (127.0.0.1:8085) thay vì Firestore thật.
import path from 'node:path';
import { args, cmd, ROOT, sleep, now, pct, median, barrier, table, readEnvVar } from './common.mjs';

const PROJECT_ID = 'ticketrush-5a616';
if (args.emulator) process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8085';
else {
  delete process.env.FIRESTORE_EMULATOR_HOST;
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Dùng lại khóa dịch vụ mà backend đã cấu hình trong backend/.env.cloud (chỉ đọc biến đường dẫn)
    const p = readEnvVar(path.join(ROOT, 'backend', '.env.cloud'), 'GOOGLE_APPLICATION_CREDENTIALS');
    if (p) process.env.GOOGLE_APPLICATION_CREDENTIALS = path.isAbsolute(p) ? p : path.resolve(ROOT, 'backend', p);
  }
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Chưa có khóa dịch vụ Firebase. Đặt $env:GOOGLE_APPLICATION_CREDENTIALS = "đường\\dẫn\\serviceAccount.json" rồi chạy lại.');
    process.exit(1);
  }
}
const { initializeApp, applicationDefault } = await import('firebase-admin/app');
const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
initializeApp(args.emulator ? { projectId: PROJECT_ID } : { projectId: PROJECT_ID, credential: applicationDefault() });
const db = getFirestore();
const ROOT_DOC = db.collection('ccLab').doc('run');
const C = (name) => ROOT_DOC.collection(name);
const THINK = args.think ?? 5;
console.log(`Firestore ${args.emulator ? 'Emulator ' + process.env.FIRESTORE_EMULATOR_HOST : 'THẬT'} – project ${PROJECT_ID}, dữ liệu thử dưới ccLab/run\n`);

const clean = async () => { await db.recursiveDelete(ROOT_DOC); };
// Giới hạn số thao tác chạy cùng lúc (giống pool 50 kết nối bên PostgreSQL)
function limiter(n) {
  let active = 0; const q = [];
  const next = () => { if (active >= n || !q.length) return; active++; const { fn, res, rej } = q.shift(); fn().then(res, rej).finally(() => { active--; next(); }); };
  return (fn) => new Promise((res, rej) => { q.push({ fn, res, rej }); next(); });
}
const errName = (e) => (e?.code !== undefined ? `${e.code}` : 'app');
const errText = (o) => Object.entries(o).map(([k, v]) => `${k}×${v}`).join(', ') || '–';
const sid = (i) => `s${String(i).padStart(3, '0')}`;
async function writeAll(items) { const w = db.bulkWriter(); for (const [ref, data] of items) w.set(ref, data); await w.close(); }

// ======================= TN1. Giờ G =======================
async function tn1() {
  const N = args.n ?? 500, M = args.seats ?? 50, run = limiter(args.conc ?? 50);
  console.log(`===== TN1. Giờ G: ${N} người cùng mua, ${M} ghế, tối đa ${args.conc ?? 50} yêu cầu cùng lúc, "suy nghĩ" ${THINK} ms =====`);
  const seats = C('seats'), sales = C('sales');
  const available = () => seats.where('status', '==', 'AVAILABLE'); // thứ tự mặc định theo id: mọi người nhắm cùng ghế s001
  const variants = {
    F0: ['Không transaction: đọc ghế trống rồi ghi', async (uid) => {
      const q = await available().limit(1).get();
      if (q.empty) return 'soldout';
      await sleep(THINK);
      const ref = q.docs[0].ref;
      await ref.update({ status: 'SOLD', holder: uid });
      await sales.add({ seat: ref.id, user: uid });
      return 'ok';
    }],
    F1: ['runTransaction: đọc ghế trống đầu tiên rồi ghi', (uid, st) => db.runTransaction(async (tx) => {
      st.attempts++;
      const q = await tx.get(available().limit(1));
      if (q.empty) return 'soldout';
      await sleep(THINK);
      tx.update(q.docs[0].ref, { status: 'SOLD', holder: uid });
      tx.create(sales.doc(), { seat: q.docs[0].id, user: uid });
      return 'ok';
    })],
    F2: ['runTransaction: chọn ngẫu nhiên 1 trong 20 ghế trống', (uid, st) => db.runTransaction(async (tx) => {
      st.attempts++;
      const q = await tx.get(available().limit(20));
      if (q.empty) return 'soldout';
      const d = q.docs[Math.floor(Math.random() * q.docs.length)];
      await sleep(THINK);
      tx.update(d.ref, { status: 'SOLD', holder: uid });
      tx.create(sales.doc(), { seat: d.id, user: uid });
      return 'ok';
    })],
  };
  const rows = [];
  for (const [key, [label, fn]] of Object.entries(variants)) {
    if (args.only && !String(args.only).includes(key)) continue;
    await clean();
    await writeAll(Array.from({ length: M }, (_, i) => [seats.doc(sid(i + 1)), { status: 'AVAILABLE', holder: null }]));
    const st = { attempts: 0, errors: {} }; const out = { ok: 0, soldout: 0, error: 0 }; const lat = [];
    const t0 = now();
    await Promise.all(Array.from({ length: N }, (_, i) => run(async () => {
      const s = now();
      try { out[await fn(`u${i + 1}`, st)]++; } catch (e) { out.error++; st.errors[errName(e)] = (st.errors[errName(e)] ?? 0) + 1; }
      lat.push(now() - s);
    })));
    const ms = now() - t0;
    const [saleSnap, seatSnap] = await Promise.all([sales.get(), seats.get()]);
    const holder = Object.fromEntries(seatSnap.docs.map((d) => [d.id, d.get('holder')]));
    const sold = new Set(saleSnap.docs.map((d) => d.get('seat')));
    rows.push({
      'Cách làm': `${key}. ${label}`, 'Người mua được': out.ok, 'Vé bán ra': saleSnap.size, 'Ghế đã bán': sold.size,
      'Bán trùng': saleSnap.size - sold.size, 'Mất cập nhật': saleSnap.docs.filter((d) => holder[d.get('seat')] !== d.get('user')).length,
      'Báo hết vé': out.soldout, 'Ghế còn trống': seatSnap.docs.filter((d) => d.get('status') === 'AVAILABLE').length,
      'Lỗi (hết lượt thử)': out.error, 'Số lần chạy callback': key === 'F0' ? '–' : st.attempts, 'Mã lỗi': errText(st.errors),
      'Tổng (ms)': Math.round(ms), 'P95 1 người (ms)': Math.round(pct(lat, 95)),
    });
    console.log(`  xong ${key}`);
  }
  await clean();
  table('Kết quả TN1 Firestore (đúng: Vé bán ra = Ghế đã bán = số ghế; Bán trùng = Mất cập nhật = 0; Ghế còn trống = 0)', rows);
  return rows;
}

// ======================= TN2. Lost update, write skew =======================
async function tn2() {
  const K = args.k ?? 100, T = args.trials ?? 10, run = limiter(50);
  const counter = C('counters').doc('left');
  console.log(`===== TN2a. Lost update: ${K} thao tác cùng trừ 1 vào bộ đếm (bắt đầu 1.000, đúng phải còn ${1000 - K}) =====`);
  const va = [
    ['Không transaction: get rồi set', async () => { const v = (await counter.get()).get('value'); await sleep(THINK); await counter.set({ value: v - 1 }); }],
    ['runTransaction: get rồi set', (st) => db.runTransaction(async (tx) => { st.attempts++; const v = (await tx.get(counter)).get('value'); await sleep(THINK); tx.set(counter, { value: v - 1 }); })],
    ['FieldValue.increment(-1), không cần đọc', async () => { await counter.update({ value: FieldValue.increment(-1) }); }],
  ];
  const a = [];
  for (const [label, fn] of va) {
    await clean(); await counter.set({ value: 1000 });
    const st = { attempts: 0, errors: {} }; let failed = 0; const t0 = now();
    await Promise.all(Array.from({ length: K }, () => run(() => fn(st).catch((e) => { failed++; st.errors[errName(e)] = (st.errors[errName(e)] ?? 0) + 1; }))));
    const v = (await counter.get()).get('value');
    a.push({ 'Cách làm': label, 'Giá trị cuối': v, 'Đúng': 1000 - K, 'Thao tác thất bại': failed, 'Cập nhật bị mất': (K - failed) - (1000 - v),
      'Số lần chạy callback': st.attempts || '–', 'Mã lỗi': errText(st.errors), 'Tổng (ms)': Math.round(now() - t0) });
  }
  table('Kết quả TN2a Firestore', a);

  console.log(`\n===== TN2b. Write skew – giới hạn 4 vé/người: đã có 3 vé, 2 yêu cầu mua cùng lúc, mỗi bên đếm rồi thêm 1 (lặp ${T} lần) =====`);
  const tickets = C('tickets');
  const mine = () => tickets.where('userId', '==', 'u1');
  const b = [];
  for (const [label, useTx] of [['Không transaction: query đếm rồi thêm', false], ['runTransaction: query đếm trong transaction rồi thêm', true]]) {
    let violated = 0, failed = 0; const st = { attempts: 0, errors: {} }; const times = [];
    for (let t = 0; t < T; t++) {
      await clean();
      await writeAll([1, 2, 3].map((i) => [tickets.doc(`old${i}`), { userId: 'u1', status: 'VALID' }]));
      const meet = barrier(2, 1500);
      const buy = async () => {
        let first = true;
        const body = async (tx) => {
          st.attempts++;
          const n = (await (tx ? tx.get(mine()) : mine().get())).size;
          if (first) { first = false; await meet(); } // chỉ chờ nhau ở lần chạy đầu; lần thử lại thì đi thẳng
          if (n + 1 > 4) return 'refused';
          tx ? tx.create(tickets.doc(), { userId: 'u1', status: 'VALID' }) : await tickets.add({ userId: 'u1', status: 'VALID' });
          return 'bought';
        };
        return useTx ? db.runTransaction(body) : body(null);
      };
      const s = now();
      const res = await Promise.allSettled([buy(), buy()]);
      times.push(now() - s);
      res.filter((r) => r.status === 'rejected').forEach((r) => { failed++; st.errors[errName(r.reason)] = (st.errors[errName(r.reason)] ?? 0) + 1; });
      if ((await mine().get()).size > 4) violated++;
    }
    b.push({ 'Cách làm': label, 'Số lần thử': T, 'Lần vượt 4 vé': violated, 'Yêu cầu thất bại': failed,
      'Số lần chạy callback': useTx ? st.attempts : '–', 'Mã lỗi': errText(st.errors), 'Thời gian 1 lượt – trung vị (ms)': Math.round(median(times)) });
  }
  await clean();
  table('Kết quả TN2b Firestore (đúng: Lần vượt 4 vé = 0; callback > 2×số lần thử nghĩa là có transaction bị chạy lại)', b);
  return { a, b };
}

// ======================= TN3. Hai transaction ngược thứ tự =======================
async function tn3() {
  const T = args.trials ?? 5;
  console.log(`===== TN3. Transaction A đọc ghế 1 rồi 2, transaction B đọc ghế 2 rồi 1, rồi cả hai ghi cả hai ghế (lặp ${T} lần) =====`);
  const s1 = C('seats').doc('s001'), s2 = C('seats').doc('s002');
  let ok = 0, failed = 0; const st = { attempts: 0, errors: {} }; const times = [];
  for (let t = 0; t < T; t++) {
    await clean(); await writeAll([[s1, { v: 0 }], [s2, { v: 0 }]]);
    const meet = barrier(2, 1500);
    const tx = (order) => { let first = true; return db.runTransaction(async (x) => {
      st.attempts++;
      const d1 = await x.get(order[0]);
      if (first) { first = false; await meet(); }
      const d2 = await x.get(order[1]);
      x.update(order[0], { v: d1.get('v') + 1 }); x.update(order[1], { v: d2.get('v') + 1 });
    }); };
    const s = now();
    const res = await Promise.allSettled([tx([s1, s2]), tx([s2, s1])]);
    times.push(now() - s);
    ok += res.filter((r) => r.status === 'fulfilled').length;
    res.filter((r) => r.status === 'rejected').forEach((r) => { failed++; st.errors[errName(r.reason)] = (st.errors[errName(r.reason)] ?? 0) + 1; });
  }
  const [a1, a2] = await Promise.all([s1.get(), s2.get()]);
  await clean();
  const rows = [{ 'Số lần thử': T, 'Transaction thành công': ok, 'Thất bại': failed, 'Số lần chạy callback': st.attempts,
    'Lần chạy lại': st.attempts - 2 * T, 'Mã lỗi': errText(st.errors), 'Giá trị cuối lượt cuối (ghế 1, ghế 2)': `${a1.get('v')}, ${a2.get('v')}`,
    'Thời gian 1 lượt – trung vị (ms)': Math.round(median(times)) }];
  table('Kết quả TN3 Firestore (không có lỗi "deadlock" cho ứng dụng: Firestore hủy một bên và SDK tự chạy lại callback)', rows);
  return rows;
}

// ======================= TN4. Điểm nóng =======================
async function tn4() {
  const N = args.n ?? 100, run = limiter(50);
  console.log(`===== TN4. ${N} người cùng "vào hàng chờ": mỗi người cần một số thứ tự (như queues/{eventId}.next trong ứng dụng) =====`);
  const meta = C('queues').doc('e1');
  const variants = [
    ['Mỗi người ghi document riêng (không điểm nóng)', (i, st) => db.runTransaction(async (tx) => {
      st.attempts++; const r = C('own').doc(`u${i}`); await tx.get(r); tx.set(r, { at: Date.now() }); })],
    ['runTransaction trên MỘT document chung: next = next + 1', (i, st) => db.runTransaction(async (tx) => {
      st.attempts++; const n = ((await tx.get(meta)).get('next') ?? 0) + 1;
      tx.set(meta, { next: n }, { merge: true }); tx.set(C('entries').doc(`u${i}`), { seq: n }); return n; })],
    ['Chia 10 shard, mỗi người tăng 1 shard ngẫu nhiên', (i, st) => db.runTransaction(async (tx) => {
      st.attempts++; const r = C('shards').doc(`k${Math.floor(Math.random() * 10)}`);
      const n = ((await tx.get(r)).get('next') ?? 0) + 1; tx.set(r, { next: n }); })],
    ['FieldValue.increment(1) trên document chung (không transaction)', async () => { await meta.set({ next: FieldValue.increment(1) }, { merge: true }); }],
  ];
  const rows = [];
  for (const [label, fn] of variants) {
    await clean();
    const st = { attempts: 0, errors: {} }; let failed = 0; const lat = []; const t0 = now();
    await Promise.all(Array.from({ length: N }, (_, i) => run(async () => {
      const s = now();
      try { await fn(i + 1, st); } catch (e) { failed++; st.errors[errName(e)] = (st.errors[errName(e)] ?? 0) + 1; }
      lat.push(now() - s);
    })));
    const ms = now() - t0;
    let check = '–';
    if (label.includes('MỘT document')) {
      const seqs = (await C('entries').get()).docs.map((d) => d.get('seq'));
      check = `${new Set(seqs).size}/${seqs.length} số khác nhau, next = ${(await meta.get()).get('next')}`;
    }
    rows.push({ 'Cách làm': label, 'Thành công': N - failed, 'Thất bại': failed, 'Số lần chạy callback': st.attempts || '–',
      'Mã lỗi': errText(st.errors), 'Kiểm tra số thứ tự': check, 'Tổng (ms)': Math.round(ms), 'Thao tác/giây': Math.round((N - failed) / (ms / 1000)),
      'P95 1 người (ms)': Math.round(pct(lat, 95)) });
    console.log(`  xong: ${label}`);
  }
  await clean();
  table('Kết quả TN4 Firestore (Firestore khuyến nghị ~1 lần ghi/giây cho mỗi document; vượt nhiều sẽ tranh chấp và chậm)', rows);
  return rows;
}

const cmds = { tn1, tn2, tn3, tn4, clean: async () => { await clean(); console.log('Đã xóa ccLab/run.'); },
  all: async () => { await tn1(); await tn2(); await tn3(); await tn4(); } };
if (!cmds[cmd]) console.log('Dùng: node fs.mjs tn1 | tn2 | tn3 | tn4 | all | clean   (thêm --emulator để chạy trên emulator)');
else {
  try { await cmds[cmd](); }
  catch (e) {
    if (String(e.message).includes('Could not load the default credentials') || e.code === 16 || e.code === 7) {
      console.error(`Firestore từ chối xác thực (${e.message.split('\n')[0]}). Kiểm tra GOOGLE_APPLICATION_CREDENTIALS trỏ đúng file khóa của ${PROJECT_ID}.`);
    } else if (e.code === 14) console.error('Không kết nối được Firestore (UNAVAILABLE). Kiểm tra mạng, hoặc emulator nếu dùng --emulator.');
    else throw e;
    process.exitCode = 1;
  }
}
process.exit();
