import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { queueApi } from '../api/queueApi.js';
import { eventsApi } from '../api/eventsApi.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function WaitingRoomPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [event, setEvent] = useState(null);
  const [queueState, setQueueState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [admitted, setAdmitted] = useState(false);

  // 1. Tải thông tin sự kiện
  useEffect(() => {
    eventsApi.get(eventId)
      .then(setEvent)
      .catch((err) => setError(err.message));
  }, [eventId]);

  // 2. Tham gia hàng đợi
  useEffect(() => {
    if (!user) return;
    queueApi.join(eventId)
      .then((data) => {
        setQueueState(data);
        if (data.admitted) {
          setAdmitted(true);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [eventId, user]);

  // 3. Polling kiểm tra trạng thái hàng đợi mỗi 3 giây
  useEffect(() => {
    if (!user || admitted) return undefined;

    const interval = setInterval(() => {
      queueApi.status(eventId)
        .then((res) => {
          if (res.admitted) {
            setAdmitted(true);
            setTimeout(() => {
              navigate(`/events/${eventId}`, { replace: true });
            }, 1500);
          } else {
            setQueueState((prev) => ({ ...prev, ...res }));
          }
        })
        .catch(() => {});
    }, 3000);

    return () => clearInterval(interval);
  }, [eventId, user, admitted, navigate]);

  async function handleLeave() {
    if (!window.confirm('Bạn có chắc muốn rời khỏi phòng chờ? Bạn sẽ mất số thứ tự hiện tại.')) return;
    await queueApi.leave(eventId).catch(() => {});
    navigate(`/events/${eventId}`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link to={`/events/${eventId}`} className="text-sm font-medium text-indigo-700 hover:underline">
        ← Quay lại trang sự kiện
      </Link>

      {/* Header Sự kiện */}
      {event && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-2">
          <span className="rounded-full bg-indigo-100 text-indigo-800 px-3 py-1 text-xs font-semibold">
            Phòng Chờ Ảo Giờ G
          </span>
          <h1 className="text-2xl font-bold text-gray-950">{event.title}</h1>
          <p className="text-sm text-gray-600">
            📍 {event.venue_name}, {event.city} · 📅 {new Date(event.event_date).toLocaleString('vi-VN')}
          </p>
          <p className="text-xs text-gray-500">
            Mở bán chính thức: <strong>{new Date(event.sale_open_at).toLocaleString('vi-VN')}</strong>
          </p>
        </div>
      )}

      {error && <p role="alert" className="text-red-700 text-sm font-medium bg-red-50 p-3 rounded-lg border border-red-200">{error}</p>}

      {/* Thẻ Trạng thái Hàng đợi */}
      <div className="rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50/50 to-white p-8 shadow-sm text-center space-y-6">
        {admitted ? (
          <div className="space-y-4 py-6">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl animate-bounce">
              🎉
            </div>
            <h2 className="text-2xl font-extrabold text-emerald-900">ĐÃ ĐẾN LƯỢT CỦA BẠN!</h2>
            <p className="text-sm text-gray-600 animate-pulse">
              Hệ thống đang chuyển hướng bạn vào sơ đồ chọn ghế…
            </p>
            <Link
              to={`/events/${eventId}`}
              className="inline-block rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700 shadow-md"
            >
              Vào chọn ghế ngay
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <span className="inline-block animate-pulse rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                ● Đang trong hàng đợi trực tuyến
              </span>
              <p className="text-xs text-gray-500">
                Vui lòng không tắt hoặc tải lại trang để duy trì số thứ tự
              </p>
            </div>

            {/* Vị trí */}
            <div className="space-y-1">
              <p className="text-xs uppercase font-bold tracking-wider text-gray-500">Số thứ tự của bạn</p>
              <p className="text-6xl font-black font-mono text-indigo-700">
                #{queueState?.position || '...'}
              </p>
            </div>

            {/* Thông số chờ */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-white p-4 rounded-xl border border-gray-200 shadow-inner">
              <div>
                <span className="text-gray-500 block">Người đứng trước bạn:</span>
                <span className="font-bold text-sm text-gray-800">
                  {queueState?.peopleAhead != null ? `${queueState.peopleAhead} người` : 'Đang tính…'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Thời gian ước tính:</span>
                <span className="font-bold text-sm text-gray-800">
                  ~{queueState?.estimatedWaitSeconds ? Math.ceil(queueState.estimatedWaitSeconds / 60) : 1} phút
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1">
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-500 rounded-full"
                  style={{
                    width: `${Math.max(10, 100 - (queueState?.peopleAhead || 0) * 10)}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-gray-400">Tự động làm mới trạng thái mỗi 3 giây</p>
            </div>

            <div>
              <button
                type="button"
                onClick={handleLeave}
                className="text-xs text-red-600 hover:text-red-800 hover:underline"
              >
                Rời khỏi phòng chờ
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

