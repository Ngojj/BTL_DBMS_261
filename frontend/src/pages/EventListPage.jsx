// [#1] xem sự kiện theo thể loại (loại d) · [#2] lọc thành phố + khoảng ngày + khoảng giá (loại e)
// Phụ trách: TV1 (#1) + TV2 (#2)
import { useState } from "react";
import { Link } from "react-router-dom";
import { eventsApi } from "../api/eventsApi.js";
import { useAsync } from "../lib/useAsync.js";
import { dayMonthTime, dayParts, money } from "../lib/format.js";
import { ErrorBox, Loading, PageHeader } from "../components/ui.jsx";

const CITIES = ["TP. HCM", "Hà Nội", "Đà Nẵng"];
const GENRE_COLOR = {
  pop: "bg-[#b93a17]",
  rock: "bg-royal",
  edm: "bg-ink",
  indie: "bg-[#6b3fa0]",
  acoustic: "bg-[#8f2c10]",
};

function StatusPill({ event }) {
  if (event.status === "SOLD_OUT")
    return (
      <span className="rounded-full px-3 py-1 text-xs font-bold bg-gray-200 text-gray-600">
        Hết vé
      </span>
    );
  if (new Date(event.saleOpenAt) > new Date())
    return (
      <span className="rounded-full px-3 py-1 text-xs font-bold bg-indigo-100 text-royal">
        Mở bán {dayMonthTime(event.saleOpenAt)}
      </span>
    );
  return (
    <span className="rounded-full px-3 py-1 text-xs font-bold bg-orange-100 text-brand">
      Đang mở bán
    </span>
  );
}

function EventCard({ event }) {
  const d = dayParts(event.eventDate);
  const color = GENRE_COLOR[event.genre?.toLowerCase()] ?? "bg-[#0f7360]";
  return (
    // Thẻ dạng vé: cuống vé (ngày) | đường xé nét đứt có hai khuyết tròn | thân vé | đuôi răng cưa
    <Link to={"/events/" + event.eventId} className="ticket group">
      <div className="ticket-saw">
        <div className="ticket-notch bg-white flex min-h-[210px]">
          <div
            className={
              "ticket-stub shrink-0 text-white flex flex-col items-center justify-center gap-1 py-5 " +
              color
            }
          >
            <span className="text-sm">{d.month}</span>
            <span className="text-5xl font-extrabold leading-none">
              {d.day}
            </span>
            <span className="text-sm">{d.time}</span>
            <span className="ticket-barcode mt-3" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0 pl-6 pr-7 py-5 flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold tracking-wider text-gray-500 uppercase">
                {event.genre}
              </span>
              <span className="font-mono text-[11px] text-gray-400">
                Nº {String(event.eventId).padStart(4, "0")}
              </span>
            </div>
            <h3 className="text-xl font-bold leading-snug group-hover:text-brand transition-colors">
              {event.title}
            </h3>
            <p className="text-sm text-gray-500">
              {event.venueName} · {event.city}
            </p>
            <div className="ticket-rule mt-auto pt-3 flex items-end justify-between gap-2 flex-wrap">
              <span className="text-sm text-gray-500">
                Từ <b className="text-lg text-ink">{money(event.minPrice)}</b>
              </span>
              <StatusPill event={event} />
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function EventListPage() {
  const [genreId, setGenreId] = useState("");
  const [form, setForm] = useState({
    city: "",
    dateFrom: "",
    dateTo: "",
    priceMin: "",
    priceMax: "",
  });
  const [applied, setApplied] = useState(form);

  const genres = useAsync(() => eventsApi.genres(), []);
  const events = useAsync(
    () => eventsApi.list({ genreId, ...applied }),
    [genreId, applied],
  );
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <PageHeader
        title="Sự kiện sắp diễn ra"
        subtitle="Chọn sự kiện, chọn ghế, giữ chỗ trong 10 phút để thanh toán."
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {[{ genreId: "", name: "Tất cả" }, ...(genres.data ?? [])].map((g) => (
          <button
            key={g.genreId}
            onClick={() => setGenreId(String(g.genreId))}
            className={
              "rounded-full px-5 py-2 text-sm font-bold border " +
              (String(g.genreId) === genreId
                ? "bg-ink text-white border-ink"
                : "bg-white border-black/15 hover:bg-black/5")
            }
          >
            {g.name}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setApplied(form);
        }}
        // className="card p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.4fr_auto] items-end mb-6"
        className="card p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 items-end mb-6"
      >
        <div>
          <label className="label">Thành phố</label>
          <select className="input" value={form.city} onChange={set("city")}>
            <option value="">Tất cả</option>
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Từ ngày</label>
          <input
            type="date"
            className="input"
            value={form.dateFrom}
            onChange={set("dateFrom")}
          />
        </div>
        <div>
          <label className="label">Đến ngày</label>
          <input
            type="date"
            className="input"
            value={form.dateTo}
            onChange={set("dateTo")}
          />
        </div>
        {/* <div>
          <label className="label">Giá tối đa (₫)</label>
          <input
            type="number"
            min="0"
            step="50000"
            placeholder="VD: 2000000"
            className="input"
            value={form.priceMax}
            onChange={set("priceMax")}
          />
        </div> */}
        <div>
          <label className="label">Giá từ (₫)</label>
          <input
            type="number"
            min="0"
            step="50000"
            placeholder="VD: 500000"
            className="input"
            value={form.priceMin}
            onChange={set("priceMin")}
          />
        </div>
        <div>
          <label className="label">Đến giá (₫)</label>
          <input
            type="number"
            min="0"
            step="50000"
            placeholder="VD: 2000000"
            className="input"
            value={form.priceMax}
            onChange={set("priceMax")}
          />
        </div>
        <button className="btn-dark h-[38px]">Lọc sự kiện</button>
      </form>

      <ErrorBox error={events.error} />
      {events.loading && <Loading />}
      {events.data && events.data.length === 0 && (
        <p className="text-center text-gray-500 py-10">
          Không có sự kiện phù hợp.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {events.data?.map((e) => (
          <EventCard key={e.eventId} event={e} />
        ))}
      </div>
    </div>
  );
}
