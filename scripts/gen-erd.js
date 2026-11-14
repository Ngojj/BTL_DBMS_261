// Sinh docs/erd/README.md (ERD Mermaid + từ điển dữ liệu) bằng cách đọc trực tiếp CSDL PostgreSQL.
// Chạy: node scripts/gen-erd.js   (dùng DATABASE_URL trong backend/.env)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const backendDir = fileURLToPath(new URL('../backend/', import.meta.url));
process.loadEnvFile(backendDir + '.env');
const { Pool } = createRequire(backendDir + 'package.json')('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const q = async (sql) => (await pool.query(sql)).rows;

// Nhãn quan hệ (tiếng Việt) theo "bảng_cha.bảng_con"
const LABEL = {
  'genres.events': 'phân loại',
  'venues.events': 'tổ chức tại',
  'events.zones': 'gồm',
  'zones.seats': 'gồm',
  'users.orders': 'đặt',
  'events.orders': 'thuộc',
  'orders.tickets': 'gồm',
  'seats.tickets': 'được bán thành',
  'orders.payments': 'thanh toán',
  'users.reviews': 'viết',
  'events.reviews': 'nhận',
  'users.seats': 'giữ chỗ',
};

const cols = await q(`
  SELECT c.table_name t, c.column_name n, c.udt_name type, c.character_maximum_length len,
         c.numeric_precision p, c.numeric_scale s, (c.is_nullable = 'NO') AS nn, c.column_default def
  FROM information_schema.columns c JOIN information_schema.tables t USING (table_schema, table_name)
  WHERE c.table_schema='public' AND t.table_type='BASE TABLE' ORDER BY c.table_name, c.ordinal_position`);
const cons = await q(`
  SELECT cl.relname t, c.conname n, c.contype k, pg_get_constraintdef(c.oid) def,
         (SELECT array_agg(a.attname::text ORDER BY x.ord) FROM unnest(c.conkey) WITH ORDINALITY x(attnum, ord)
            JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=x.attnum) cols,
         (SELECT r.relname FROM pg_class r WHERE r.oid=c.confrelid) ref
  FROM pg_constraint c JOIN pg_class cl ON cl.oid=c.conrelid JOIN pg_namespace s ON s.oid=cl.relnamespace
  WHERE s.nspname='public' ORDER BY cl.relname, c.contype, c.conname`);
const idx = await q(`SELECT tablename t, indexname n, indexdef def FROM pg_indexes WHERE schemaname='public'
  AND indexname NOT IN (SELECT conname FROM pg_constraint) ORDER BY tablename, indexname`);
const trg = await q(`SELECT c.relname t, g.tgname n, pg_get_triggerdef(g.oid) def, p.proname fn
  FROM pg_trigger g JOIN pg_class c ON c.oid=g.tgrelid JOIN pg_proc p ON p.oid=g.tgfoid WHERE NOT g.tgisinternal`);
const fns = await q(`SELECT p.proname n, obj_description(p.oid) d FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace
  WHERE s.nspname='public'`);
await pool.end();

const tables = [...new Set(cols.map((c) => c.t))];
const pk = (t) => cons.find((c) => c.t === t && c.k === 'p')?.cols ?? [];
const fks = cons.filter((c) => c.k === 'f');
const fkCols = (t) => new Set(fks.filter((f) => f.t === t).flatMap((f) => f.cols));
const uniq = (t) => new Set(cons.filter((c) => c.t === t && c.k === 'u' && c.cols.length === 1).flatMap((c) => c.cols));

const typeName = (c) => {
  if (c.type === 'varchar') return `varchar(${c.len})`;
  if (c.type === 'numeric') return `numeric(${c.p},${c.s})`;
  return c.type;
};
const mer = (s) => s.replace(/\(.*\)/, '').replace(/[^A-Za-z0-9_]/g, '_');

let md = `# ERD – CSDL PostgreSQL của TicketRush

> File này **được sinh tự động** từ CSDL thật bằng \`node scripts/gen-erd.js\` – đừng sửa tay, hãy sửa \`database/schema.sql\` rồi chạy lại script.

PostgreSQL là nguồn dữ liệu chuẩn (${tables.length} bảng, ${fks.length} khóa ngoại, ${trg.length} trigger). Cloud Firestore chỉ là bản sao phục vụ realtime/offline (xem phần cuối).

## 1. Sơ đồ quan hệ thực thể

\`\`\`mermaid
erDiagram
`;
for (const f of fks) {
  const notNull = cols.find((c) => c.t === f.t && c.n === f.cols[0]).nn;
  const oneToOne = uniq(f.t).has(f.cols[0]);
  const right = oneToOne ? (notNull ? '||' : 'o|') : notNull ? 'o{' : 'o{';
  const left = notNull ? '||' : '|o';
  const label = LABEL[`${f.ref}.${f.t}`] ?? 'liên kết';
  md += `    ${f.ref} ${left}--${right} ${f.t} : "${label}${notNull ? '' : ' (tùy chọn)'}"\n`;
}
for (const t of tables) {
  md += `    ${t} {\n`;
  for (const c of cols.filter((x) => x.t === t)) {
    const marks = [pk(t).includes(c.n) && 'PK', fkCols(t).has(c.n) && 'FK', uniq(t).has(c.n) && !pk(t).includes(c.n) && 'UK'].filter(Boolean).join(',');
    md += `        ${mer(typeName(c))} ${c.n}${marks ? ' ' + marks : ''}\n`;
  }
  md += `    }\n`;
}
md += `\`\`\`

Ảnh để chèn báo cáo: [erd.png](erd.png) · [erd.svg](erd.svg) (dựng từ khối Mermaid trên).

Ghi chú ký hiệu: \`||\` đúng một, \`o{\` không hoặc nhiều, \`|o\` không hoặc một (khóa ngoại cho phép NULL).

## 2. Từ điển dữ liệu
`;
for (const t of tables) {
  md += `\n### ${t}\n\n| Cột | Kiểu | Null | Mặc định | Ghi chú |\n|---|---|---|---|---|\n`;
  for (const c of cols.filter((x) => x.t === t)) {
    const notes = [];
    if (pk(t).includes(c.n)) notes.push('PK');
    for (const f of fks.filter((f) => f.t === t && f.cols.includes(c.n))) notes.push(`FK → ${f.ref}` + (/ON DELETE (\w+( \w+)?)/.exec(f.def)?.[0] ? ` (${/ON DELETE (\w+( \w+)?)/.exec(f.def)[0]})` : ''));
    if (uniq(t).has(c.n)) notes.push('UNIQUE');
    md += `| ${c.n} | ${typeName(c)} | ${c.nn ? 'NOT NULL' : 'null'} | ${c.def ? '`' + c.def.replace(/\|/g, '\\|') + '`' : ''} | ${notes.join(', ')} |\n`;
  }
  const extra = cons.filter((c) => c.t === t && (c.k === 'c' || (c.k === 'u' && c.cols.length > 1)));
  const ix = idx.filter((i) => i.t === t);
  if (extra.length || ix.length) {
    md += `\n**Ràng buộc / chỉ mục khác**\n\n`;
    for (const c of extra) md += `- \`${c.n}\`: \`${c.def.replace(/\s+/g, ' ')}\`\n`;
    for (const i of ix) md += `- \`${i.n}\`: \`${i.def.replace(/\s+/g, ' ')}\`\n`;
  }
}

md += `\n## 3. Trigger và ràng buộc nghiệp vụ\n\n`;
for (const g of trg) md += `- Trigger \`${g.n}\` trên \`${g.t}\` gọi hàm \`${g.fn}()\`: \`${g.def}\`\n`;
md += `
Các chỉ mục unique một phần là tuyến phòng thủ cuối cùng chống bán trùng ghế và thanh toán trùng, kể cả khi mã ứng dụng có lỗi: \`uq_active_ticket_per_seat\` (mỗi ghế chỉ có tối đa một vé còn hiệu lực), \`uq_success_payment_per_order\` (mỗi đơn chỉ có một thanh toán thành công). Backend khóa bản ghi bằng \`SELECT … FOR UPDATE\` theo thứ tự users → events → seats (theo seat_id) để tránh deadlock.

## 4. Mô hình Cloud Firestore (bản sao)

| Đường dẫn | Nội dung | Nguồn từ PostgreSQL | Ai ghi |
|---|---|---|---|
| \`events/{eventId}\` | thông tin sự kiện, \`zonesSummary\` | events, zones | backend (sau COMMIT) |
| \`events/{eventId}/seats/{seatId}\` | trạng thái ghế, hạng, giá | seats, zones | backend |
| \`validTickets/{qrCode}\` | vé hợp lệ để soát offline; \`checkedIn\`, \`checkedInAt\` | tickets | backend; STAFF chỉ được cập nhật \`checkedIn\`/\`checkedInAt\` |
| \`notifications/{userId}/items/{id}\` | thông báo thanh toán/hủy | orders | backend |

- Firebase uid = \`String(user_id)\`, kèm custom claim \`role\` (cấp bởi \`POST /api/auth/firebase-token\`).
- Security Rules (\`firebase/firestore.rules\`): client chỉ đọc; thông báo chỉ chủ sở hữu đọc được.
- Đồng bộ một chiều PostgreSQL → Firestore sau mỗi COMMIT (lỗi chỉ ghi log; có nút "Đồng bộ" ở trang admin để dựng lại). Chiều ngược lại duy nhất là kết quả soát vé: Firestore → PostgreSQL qua \`POST /api/checkin/sync\` (idempotent).
`;

writeFileSync(fileURLToPath(new URL('../docs/erd/README.md', import.meta.url)), md);
console.log('Đã ghi docs/erd/README.md –', tables.length, 'bảng,', fks.length, 'khóa ngoại');
