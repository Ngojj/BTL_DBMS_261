// Định dạng tiền VND và ngày giờ theo múi giờ Việt Nam
const TZ = 'Asia/Ho_Chi_Minh';

export const money = (n) => Number(n ?? 0).toLocaleString('vi-VN') + ' ₫';

function parts(iso, opts) {
  const p = new Intl.DateTimeFormat('vi-VN', { timeZone: TZ, hourCycle: 'h23', ...opts }).formatToParts(new Date(iso));
  return Object.fromEntries(p.map((x) => [x.type, x.value]));
}

// { month: 'Th 11', day: '15', time: '19:30' } – khối ngày trên thẻ sự kiện
export function dayParts(iso) {
  const p = parts(iso, { month: 'numeric', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  return { month: 'Th ' + p.month, day: p.day, time: p.hour + ':' + p.minute };
}

export function timeStr(iso) {
  const p = parts(iso, { hour: '2-digit', minute: '2-digit' });
  return p.hour + ':' + p.minute;
}

export function dateStr(iso) {
  const p = parts(iso, { day: '2-digit', month: '2-digit', year: 'numeric' });
  return p.day + '/' + p.month + '/' + p.year;
}

// "Chủ nhật 22/11/2026"
export function fullDate(iso) {
  const w = parts(iso, { weekday: 'long' }).weekday.toLowerCase();
  return w.charAt(0).toUpperCase() + w.slice(1) + ' ' + dateStr(iso);
}

// "CN 22/11/2026"
export function shortDate(iso) {
  return parts(iso, { weekday: 'short' }).weekday + ' ' + dateStr(iso);
}

// "1/11 · 10:00"
export function dayMonthTime(iso) {
  const p = parts(iso, { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  return p.day + '/' + p.month + ' · ' + p.hour + ':' + p.minute;
}

// datetime-local ("2026-11-22T19:00") → ISO, coi là giờ Việt Nam (UTC+7)
export const localToIso = (v) => (v ? new Date(v + ':00+07:00').toISOString() : null);

export const mmss = (sec) =>
  String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');

// ISO → giá trị cho <input type="datetime-local"> theo giờ Việt Nam ("2026-11-22T19:00")
export function isoToLocal(iso) {
  if (!iso) return '';
  const p = parts(iso, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute;
}

// "22/11/2026 19:00"
export const dateTime = (iso) => dateStr(iso) + ' ' + timeStr(iso);
