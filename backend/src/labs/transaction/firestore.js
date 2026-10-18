import { randomUUID } from 'node:crypto';
import { firestore } from '../../config/firebase.js';
import { parseParams } from './params.js';

export async function run(params = {}) {
  const { simulateFailure } = parseParams(params);
  const runId = randomUUID();
  const price = 200000;
  // Không dùng collections events/validTickets của ứng dụng.
  const root = firestore.collection('transactionLabRuns').doc(runId);
  const refs = Object.fromEntries(
    ['user', 'genre', 'venue', 'event', 'zone', 'seat', 'order', 'ticket', 'payment']
      .map((name) => [name, root.collection('records').doc(name)]),
  );

  // Đọc dữ liệu đã lưu, bên ngoài transaction và TRƯỚC khi dọn dữ liệu.
  async function readState() {
    const [seat, order, ticket, payment] = await firestore.getAll(
      refs.seat, refs.order, refs.ticket, refs.payment,
    );
    if (!seat.exists) throw new Error('Không tìm thấy ghế thử nghiệm');
    const s = seat.data();
    return {
      seatStatus: s.status,
      heldBy: s.heldBy,
      heldUntil: s.heldUntil?.toDate().toISOString() ?? null,
      version: s.version,
      orders: Number(order.exists),
      paidOrders: Number(order.exists && order.get('status') === 'PAID'),
      tickets: Number(ticket.exists),
      validTickets: Number(ticket.exists && ticket.get('status') === 'VALID'),
      payments: Number(payment.exists),
      successfulPayments: Number(payment.exists && payment.get('status') === 'SUCCESS'),
    };
  }

  try {
    const now = new Date();
    // [a] Lưu trạng thái ban đầu độc lập với giao dịch mua vé.
    const setup = firestore.batch();
    setup.create(root, { runId, createdAt: now });
    setup.create(refs.user, { fullName: 'Transaction Lab', role: 'CUSTOMER' });
    setup.create(refs.genre, { name: 'Lab' });
    setup.create(refs.venue, { name: 'Lab', city: 'Lab' });
    setup.create(refs.event, {
      title: `Transaction Lab ${runId}`, status: 'DRAFT', maxTicketsPerUser: 4,
      genreId: refs.genre.id, venueId: refs.venue.id,
    });
    setup.create(refs.zone, { eventId: refs.event.id, name: 'LAB', price, capacity: 1 });
    setup.create(refs.seat, {
      zoneId: refs.zone.id, status: 'AVAILABLE', row: 'A', number: 1,
      heldBy: null, heldUntil: null, version: 0,
    });
    await setup.commit();

    const before = await readState();
    const simulatedError = new Error('Giả lập lỗi thanh toán');
    let failureInjected = false;

    try {
      await firestore.runTransaction(async (transaction) => {
        // Firestore yêu cầu mọi lần đọc xảy ra trước mọi lần ghi.
        const [user, seat] = await transaction.getAll(refs.user, refs.seat);
        if (!user.exists || !seat.exists || seat.get('status') !== 'AVAILABLE') {
          throw new Error('Dữ liệu thử nghiệm không hợp lệ hoặc ghế không còn trống');
        }

        const version = seat.get('version');
        // [a,c] Các lệnh này được xếp hàng; chỉ ghi khi callback thành công.
        transaction.update(refs.seat, {
          status: 'HELD', heldBy: refs.user.id,
          heldUntil: new Date(now.getTime() + 10 * 60 * 1000), version: version + 1,
        });
        transaction.create(refs.order, {
          userId: refs.user.id, eventId: refs.event.id, total: price, status: 'PENDING',
        });
        transaction.create(refs.ticket, {
          orderId: refs.order.id, seatId: refs.seat.id, price,
          qrCode: runId, status: 'VALID',
        });
        transaction.create(refs.payment, {
          orderId: refs.order.id, amount: price, method: 'CARD', status: 'PENDING',
        });

        if (simulateFailure) throw simulatedError;

        transaction.update(refs.payment, { status: 'SUCCESS', paidAt: now });
        transaction.update(refs.order, { status: 'PAID' });
        transaction.update(refs.seat, {
          status: 'SOLD', heldBy: null, heldUntil: null, version: version + 2,
        });
      });
    } catch (err) {
      // Không coi lỗi mạng hoặc lỗi SDK là một lần rollback thành công.
      if (err !== simulatedError) throw err;
      failureInjected = true;
    }

    const after = await readState();
    const rolledBack = failureInjected && JSON.stringify(after) === JSON.stringify(before);
    const committed = !failureInjected &&
      after.orders === 1 && after.paidOrders === 1 &&
      after.tickets === 1 && after.validTickets === 1 &&
      after.payments === 1 && after.successfulPayments === 1 &&
      after.seatStatus === 'SOLD' && after.heldBy === null && after.heldUntil === null &&
      after.version === before.version + 2;

    if (simulateFailure ? !rolledBack : !committed) {
      throw new Error(`Trạng thái sau giao dịch không đúng: ${JSON.stringify(after)}`);
    }

    return {
      metrics: {
        committed,
        rolledBack,
        leftoverRecords: failureInjected ? after.orders + after.tickets + after.payments : 0,
      },
      details: {
        runId, simulateFailure, before, after,
        note: 'Firestore hủy các lệnh ghi chưa commit khi callback lỗi; rolledBack biểu thị dữ liệu không đổi.',
      },
    };
  } finally {
    // [b] Xóa cả subcollection: xóa document cha không tự xóa các document con.
    // Mỗi run có UUID riêng, nên không đụng đến dữ liệu của run khác.
    const cleanup = firestore.batch();
    for (const ref of Object.values(refs)) cleanup.delete(ref);
    cleanup.delete(root);
    await cleanup.commit();
  }
}
