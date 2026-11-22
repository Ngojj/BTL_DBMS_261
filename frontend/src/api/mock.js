// Dữ liệu mẫu để xem giao diện khi backend chưa làm xong (chỉ dùng khi VITE_USE_MOCK=true).
// Hình dạng dữ liệu ở đây CHÍNH LÀ hợp đồng API mà backend cần trả về (xem docs/api.md).

const iso = (s) => new Date(s + "+07:00").toISOString();

export const venues = [
  { venueId: 1, name: 'Nhà thi đấu Phú Thọ', city: 'TP. HCM', address: '1 Lý Thường Kiệt, Q.11' },
  { venueId: 2, name: 'SVĐ Quân khu 7', city: 'TP. HCM', address: '202 Hoàng Văn Thụ, Q.Phú Nhuận' },
  { venueId: 3, name: 'Công viên bờ sông', city: 'Đà Nẵng', address: 'Đường Trần Hưng Đạo, Q.Sơn Trà' },
];

export const genres = [
  { genreId: 1, name: "Pop" },
  { genreId: 2, name: "Rock" },
  { genreId: 3, name: "EDM" },
  { genreId: 4, name: "Indie" },
  { genreId: 5, name: "Acoustic" },
];

const events = [
  {
    eventId: 1,
    title: "Concert Pop Mùa Thu",
    genre: "Pop",
    genreId: 1,
    venueName: "Nhà thi đấu Phú Thọ",
    city: "TP. HCM",
    eventDate: iso("2026-11-15T19:30:00"),
    saleOpenAt: iso("2026-11-01T10:00:00"),
    minPrice: 800000,
  },
  {
    eventId: 2,
    title: "Đêm nhạc Rock Quân khu 7",
    genre: "Rock",
    genreId: 2,
    venueName: "SVĐ Quân khu 7",
    city: "TP. HCM",
    eventDate: iso("2026-11-22T19:00:00"),
    saleOpenAt: iso("2026-09-15T10:00:00"),
    minPrice: 650000,
  },
  {
    eventId: 3,
    title: "Lễ hội EDM Bên Sông",
    genre: "EDM",
    genreId: 3,
    venueName: "Công viên bờ sông",
    city: "Đà Nẵng",
    eventDate: iso("2026-11-29T17:00:00"),
    saleOpenAt: iso("2026-09-20T10:00:00"),
    minPrice: 1200000,
  },
  {
    eventId: 4,
    title: "Show Indie Hòa Bình",
    genre: "Indie",
    genreId: 4,
    venueName: "Nhà hát Hòa Bình",
    city: "TP. HCM",
    eventDate: iso("2026-12-06T20:00:00"),
    saleOpenAt: iso("2026-11-01T10:00:00"),
    minPrice: 450000,
  },
  {
    eventId: 5,
    title: "Concert Cuối Năm",
    genre: "Pop",
    genreId: 1,
    venueName: "SVĐ Mỹ Đình",
    city: "Hà Nội",
    eventDate: iso("2026-12-20T19:00:00"),
    saleOpenAt: iso("2026-11-01T10:00:00"),
    minPrice: 1500000,
  },
  {
    eventId: 6,
    title: "Đêm Acoustic Nhà Hát Lớn",
    genre: "Acoustic",
    genreId: 5,
    venueName: "Nhà hát Lớn",
    city: "Hà Nội",
    eventDate: iso("2026-12-27T20:00:00"),
    saleOpenAt: iso("2026-09-25T10:00:00"),
    minPrice: 500000,
  },
].map((e, i) => ({ ...e, venueId: [1, 2, 3, 4, 5, 6][i], status: "ON_SALE" }));

const findEvent = (id) => events.find((e) => e.eventId === Number(id));

export function listEvents(q = {}) {
  return events.filter(
    (e) =>
      (!q.genreId || e.genreId === Number(q.genreId)) &&
      (!q.city || e.city === q.city) &&
      (!q.dateFrom || new Date(e.eventDate) >= new Date(q.dateFrom)) &&
      (!q.dateTo ||
        new Date(e.eventDate) <= new Date(q.dateTo + "T23:59:59+07:00")) &&
      (!q.priceMin || e.minPrice >= Number(q.priceMin)) &&
      (!q.priceMax || e.minPrice <= Number(q.priceMax)),
  );
}

export function getEvent(id) {
  const e = findEvent(id);
  if (!e) {
    const err = new Error("Không tìm thấy sự kiện");
    err.status = 404;
    throw err;
  }
  const vip = Math.round((e.minPrice * 2.3) / 50000) * 50000;
  return {
    ...e,
    maxTicketsPerUser: 4,
    zones: [
      { zoneId: e.eventId * 10 + 1, name: "VIP", price: vip, capacity: 48 },
      {
        zoneId: e.eventId * 10 + 2,
        name: "CAT 1",
        price: e.minPrice,
        capacity: 100,
      },
    ],
  };
}

// ---------- Ghế ----------
function rng(seed) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

export function mockSeats(eventId) {
  const r = rng(Number(eventId) * 7919);
  const layout = [
    ["VIP", ["A", "B", "C"], 16],
    ["CAT 1", ["D", "E", "F", "G", "H"], 20],
  ];
  const out = [];
  let id = Number(eventId) * 1000;
  for (const [zone, rows, count] of layout) {
    for (const row of rows) {
      for (let number = 1; number <= count; number++) {
        const x = r();
        const status = x < 0.2 ? "SOLD" : x < 0.28 ? "HELD" : "AVAILABLE";
        out.push({
          seatId: String(++id),
          zone,
          row,
          number,
          status,
          heldBy: status === "HELD" ? "other" : null,
        });
      }
    }
  }
  return out;
}

// ---------- Đơn hàng & vé (lưu ở trình duyệt để demo luồng mua vé) ----------
const load = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d;
  } catch {
    return d;
  }
};
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uuid = () => crypto.randomUUID();

// seatInfo: [{ seatId, row, number, zone, price }] do trang chọn ghế truyền vào (mã ghế lấy từ Firestore/PostgreSQL,
// không trùng với mã ghế trong dữ liệu mẫu nên không thể tự tra lại ở đây)
export function createOrder({ eventId, seatIds }, user, seatInfo) {
  const ev = getEvent(eventId);
  const mockSeatList = mockSeats(eventId);
  const items = seatIds.map((sid) => {
    const s =
      seatInfo?.find((x) => String(x.seatId) === String(sid)) ??
      mockSeatList.find((x) => x.seatId === String(sid));
    return {
      seatId: String(sid),
      seatLabel: s.row + s.number,
      zone: s.zone,
      price: s.price ?? ev.zones.find((z) => z.name === s.zone).price,
    };
  });
  const order = {
    orderId: "m" + Date.now(),
    eventId: ev.eventId,
    eventTitle: ev.title,
    eventDate: ev.eventDate,
    venueName: ev.venueName,
    city: ev.city,
    status: "PENDING",
    total: items.reduce((a, i) => a + i.price, 0),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    holderName: user?.fullName,
    items,
  };
  save("mock_orders", { ...load("mock_orders", {}), [order.orderId]: order });
  return order;
}

export function getOrder(orderId) {
  const o = load("mock_orders", {})[orderId];
  if (!o) {
    const err = new Error("Không tìm thấy đơn hàng");
    err.status = 404;
    throw err;
  }
  return o;
}

export function payOrder(orderId) {
  const orders = load("mock_orders", {});
  const o = orders[orderId];
  o.status = "PAID";
  save("mock_orders", orders);
  const tickets = ticketStore();
  o.items.forEach((i) =>
    tickets.push({
      ticketId: uuid(),
      orderId,
      qrCode: uuid(),
      status: "VALID",
      eventId: o.eventId,
      eventTitle: o.eventTitle,
      eventDate: o.eventDate,
      venueName: o.venueName,
      city: o.city,
      zone: i.zone,
      seatLabel: i.seatLabel,
      holderName: o.holderName ?? "Khách",
      gate: "1",
      price: i.price,
    }),
  );
  save("mock_tickets", tickets);
  return { orderId, status: "PAID" };
}

export function cancelOrder(orderId) {
  const orders = load("mock_orders", {});
  if (orders[orderId]) orders[orderId].status = "CANCELLED";
  save("mock_orders", orders);
  save(
    "mock_tickets",
    ticketStore().map((t) =>
      t.orderId === orderId ? { ...t, status: "CANCELLED" } : t,
    ),
  );
  return { orderId, status: "CANCELLED" };
}

// Vé mẫu ban đầu: 2 vé Rock (B7, B8) như trong mockup
function ticketStore() {
  const cur = load("mock_tickets", null);
  if (cur) return cur;
  const ev = findEvent(2);
  const seed = ["B7", "B8"].map((seatLabel, i) => ({
    ticketId: "seed" + i,
    orderId: "seed",
    qrCode: uuid(),
    status: "VALID",
    eventId: 2,
    eventTitle: ev.title,
    eventDate: ev.eventDate,
    venueName: ev.venueName,
    city: ev.city,
    zone: "VIP",
    seatLabel,
    holderName: "Nguyễn Văn A",
    gate: "3",
    price: 1500000,
  }));
  save("mock_tickets", seed);
  return seed;
}

export const myTickets = () => ticketStore();

// Soát vé (dùng bởi lib/checkin.js khi không có Firestore)
export function mockCheckin(qr, eventId) {
  const tickets = ticketStore();
  const t = tickets.find((x) => x.qrCode === qr);
  if (!t || String(t.eventId) !== String(eventId) || t.status === "CANCELLED")
    return { status: "invalid" };
  const info = {
    seatLabel: t.zone + " · Ghế " + t.seatLabel,
    holderName: t.holderName,
  };
  if (t.status === "CHECKED_IN") return { status: "used", info };
  t.status = "CHECKED_IN";
  save("mock_tickets", tickets);
  return { status: "valid", info };
}

// ---------- Báo cáo ----------
const revRows = [
  { eventId: '2', eventTitle: 'Đêm nhạc Rock Quân khu 7', zone: 'VIP', ticketsSold: 38, revenue: 57000000 },
  { eventId: '2', eventTitle: 'Đêm nhạc Rock Quân khu 7', zone: 'CAT 1', ticketsSold: 71, revenue: 46150000 },
  { eventId: '3', eventTitle: 'Lễ hội EDM Bên Sông', zone: 'VIP', ticketsSold: 30, revenue: 82800000 },
  { eventId: '3', eventTitle: 'Lễ hội EDM Bên Sông', zone: 'CAT 1', ticketsSold: 64, revenue: 76800000 },
];
const occRows = [
  { eventId: '2', eventTitle: 'Đêm nhạc Rock Quân khu 7', zone: 'VIP', capacity: 48, sold: 38, held: 2 },
  { eventId: '2', eventTitle: 'Đêm nhạc Rock Quân khu 7', zone: 'CAT 1', capacity: 100, sold: 71, held: 4 },
  { eventId: '3', eventTitle: 'Lễ hội EDM Bên Sông', zone: 'VIP', capacity: 48, sold: 30, held: 0 },
  { eventId: '3', eventTitle: 'Lễ hội EDM Bên Sông', zone: 'CAT 1', capacity: 100, sold: 64, held: 1 },
].map((o) => ({ ...o, rate: Math.round((o.sold / o.capacity) * 1000) / 10 }));
const byEventId = (q) => (r) => !q?.eventId || String(r.eventId) === String(q.eventId);
export const revenue = (q) => revRows.filter(byEventId(q));
export const occupancy = (q) => occRows.filter(byEventId(q));
export function revenueDaily(q = {}) {
  const to = q.to ? new Date(q.to + 'T00:00:00Z') : new Date();
  const from = q.from ? new Date(q.from + 'T00:00:00Z') : new Date(to.getTime() - 29 * 86400e3);
  const r = rng(5);
  const out = [];
  for (let d = new Date(from); d <= to; d = new Date(d.getTime() + 86400e3)) {
    const orders = r() < 0.2 ? 0 : Math.floor(r() * 8);
    out.push({ day: d.toISOString().slice(0, 10), orders, tickets: orders * 2, revenue: orders * 2 * 1100000 });
  }
  return out;
}
export function overview(q) {
  const rows = revenue(q);
  const occ = occupancy(q);
  const total = rows.reduce((s, r) => s + r.revenue, 0);
  const tickets = rows.reduce((s, r) => s + r.ticketsSold, 0);
  const cap = occ.reduce((s, o) => s + o.capacity, 0);
  const sold = occ.reduce((s, o) => s + o.sold, 0);
  const perEvent = Object.values(rows.reduce((acc, r) => {
    const e = (acc[r.eventId] ??= { eventId: r.eventId, title: r.eventTitle, revenue: 0, tickets: 0 });
    e.revenue += r.revenue; e.tickets += r.ticketsSold;
    return acc;
  }, {}));
  const avg = perEvent.length ? total / perEvent.length : 0;
  return {
    revenue: total, ticketsSold: tickets, paidOrders: Math.round(tickets / 2.4), avgOrderValue: tickets ? Math.round(total / (tickets / 2.4)) : 0,
    avgTicketPrice: tickets ? Math.round(total / tickets) : 0, orders: { paid: Math.round(tickets / 2.4), cancelled: 10, expired: 5, pending: 0 },
    cancelRate: 5.9, seatCapacity: cap, seatsSold: sold, occupancyRate: cap ? Math.round((sold / cap) * 1000) / 10 : 0,
    checkedIn: Math.round(tickets * 0.2), checkInRate: 20,
    topEvents: perEvent.sort((a, b) => b.revenue - a.revenue).map((e) => ({ ...e, share: total ? Math.round((e.revenue / total) * 1000) / 10 : 0, aboveAverage: e.revenue > avg })),
  };
}
export const suspicious = () => [
  { userId: '31', email: 'acc.a@example.com', fullName: 'Trần Tài Khoản A', phone: '0977123456', ticketCount: 4, sharedPhoneAccounts: 3, atLimitEvents: 1, level: 'HIGH',
    signals: [{ type: 'GROUP_OVER_LIMIT', text: '3 tài khoản chung số điện thoại mua tổng 12 vé tại Đêm nhạc Rock Quân khu 7 (giới hạn 4/người)' }] },
  { userId: '32', email: 'acc.b@example.com', fullName: 'Trần Tài Khoản B', phone: '0977123456', ticketCount: 4, sharedPhoneAccounts: 3, atLimitEvents: 1, level: 'HIGH',
    signals: [{ type: 'GROUP_OVER_LIMIT', text: '3 tài khoản chung số điện thoại mua tổng 12 vé tại Đêm nhạc Rock Quân khu 7 (giới hạn 4/người)' }] },
  { userId: '12', email: 'scalper@example.com', fullName: 'Lê Gom Vé', phone: '0912000111', ticketCount: 16, sharedPhoneAccounts: 0, atLimitEvents: 4, level: 'MEDIUM',
    signals: [{ type: 'REPEAT_AT_LIMIT', text: 'Mua đủ giới hạn vé ở 4 sự kiện' }] },
].map((u) => ({ ...u, reason: u.signals.map((s) => s.text).join('; ') }));

// ---------- Đánh giá ----------
const names = [
  "Minh Anh",
  "Quốc Bảo",
  "Thu Hà",
  "Đức Huy",
  "Ngọc Lan",
  "Gia Hân",
];
const sampleComments = [
  "Âm thanh ánh sáng rất tốt, rất đáng tiền.",
  "Tổ chức chuyên nghiệp, soát vé nhanh.",
  "Ghế nhìn rõ sân khấu, sẽ đi tiếp.",
  "Hơi đông lúc vào cổng nhưng show tuyệt vời.",
];
function reviewStore() {
  const cur = load("mock_reviews", null);
  if (cur) return cur;
  const r = rng(11);
  const seed = {};
  for (const e of events) {
    seed[e.eventId] = Array.from({ length: 3 + (e.eventId % 3) }, (_, i) => ({
      reviewId: e.eventId * 100 + i,
      userName: names[(e.eventId + i) % names.length],
      rating: 3 + Math.floor(r() * 3),
      comment:
        i % 3 === 2
          ? ""
          : sampleComments[(e.eventId + i) % sampleComments.length],
      createdAt: new Date(Date.now() - (i + 1) * 86400e3 * 2).toISOString(),
    }));
  }
  save("mock_reviews", seed);
  return seed;
}
export const listReviews = (eventId) =>
  [...(reviewStore()[eventId] ?? [])].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
export function reviewSummary(eventId) {
  const l = reviewStore()[eventId] ?? [];
  return {
    average: l.length ? l.reduce((s, r) => s + r.rating, 0) / l.length : 0,
    count: l.length,
  };
}
export function addReview(eventId, { rating, comment }, user) {
  const store = reviewStore();
  const list = (store[eventId] ??= []);
  if (list.some((r) => r.userId === user?.userId)) {
    const err = new Error("Bạn đã đánh giá sự kiện này rồi");
    err.status = 409;
    throw err;
  }
  const review = {
    reviewId: Date.now(),
    userId: user?.userId,
    userName: user?.fullName ?? "Khách",
    rating,
    comment,
    createdAt: new Date().toISOString(),
  };
  list.push(review);
  save("mock_reviews", store);
  return review;
}

// ---------- Thông báo (Firestore notifications/{userId}/items) ----------
export const notifications = () => [
  {
    id: "n1",
    message: "Thanh toán thành công 2 vé Đêm nhạc Rock Quân khu 7.",
    createdAt: new Date(Date.now() - 3600e3).toISOString(),
  },
  {
    id: "n2",
    message: "Chào mừng bạn đến với TicketRush!",
    createdAt: new Date(Date.now() - 86400e3).toISOString(),
  },
];
