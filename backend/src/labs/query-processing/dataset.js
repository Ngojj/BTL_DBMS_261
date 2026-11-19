// Bộ dữ liệu thử xác định (không ngẫu nhiên) cho thí nghiệm Q_DT: doanh thu theo khu vực của MỘT sự kiện.
// Cả PostgreSQL lẫn Firestore nạp đúng bộ này, và đáp án đúng được tính ở đây bằng JavaScript để đối chiếu cả hai.
export const EVENT_ID = 1;
export const ZONES = [
  { id: 1, name: 'VIP', price: 2000000 },
  { id: 2, name: 'CAT 1', price: 1200000 },
  { id: 3, name: 'CAT 2', price: 800000 },
  { id: 4, name: 'CAT 3', price: 500000 },
];
// Tỉ lệ ghế theo khu: VIP 10%, CAT 1 20%, CAT 2 30%, CAT 3 40% (khu rẻ đông hơn, giống thực tế)
const ZONE_BY_SLOT = [0, 1, 1, 2, 2, 2, 3, 3, 3, 3];
const CANCEL_EVERY = 12; // ~8% vé đã hủy, để điều kiện loại vé hủy có tác dụng

export function buildDataset(n) {
  const seats = [];
  const tickets = [];
  for (let i = 1; i <= n; i++) {
    const zone = ZONES[ZONE_BY_SLOT[(i - 1) % 10]];
    seats.push({ seatId: i, zoneId: zone.id });
    tickets.push({ ticketId: i, seatId: i, zoneId: zone.id, zone: zone.name, price: zone.price, active: i % CANCEL_EVERY !== 0 });
  }
  return { zones: ZONES, seats, tickets };
}

// Đáp án: { [tên khu]: { tickets, revenue } } chỉ tính vé còn hiệu lực
export function expectedRevenue(ds) {
  const out = Object.fromEntries(ds.zones.map((z) => [z.name, { tickets: 0, revenue: 0 }]));
  for (const t of ds.tickets) {
    if (!t.active) continue;
    out[t.zone].tickets += 1;
    out[t.zone].revenue += t.price;
  }
  return out;
}

// So sánh kết quả của một DBMS với đáp án (bỏ qua khu không có vé)
export function sameAsExpected(got, expected) {
  const a = Object.keys(got).sort();
  const b = Object.keys(expected).filter((k) => expected[k].tickets > 0).sort();
  return a.length === b.length && a.every((k, i) => k === b[i] && got[k].tickets === expected[k].tickets && got[k].revenue === expected[k].revenue);
}
