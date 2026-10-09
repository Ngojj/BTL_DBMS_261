// TODO [WaitingRoomPage] Phụ trách: TV5 (#3, làm thêm, ưu tiên thấp)
// Phòng chờ ảo trước giờ mở bán. Firestore events/{eventId}/queue/{userId}: position, joinedAt, admitted
// Chưa có mockup – khi làm: nghe onSnapshot vào queue/{userId}, admitted=true thì chuyển sang /events/:eventId
export default function WaitingRoomPage() {
  return (
    <div className="card p-10 text-center max-w-xl mx-auto">
      <h1 className="text-2xl font-extrabold">Phòng chờ ảo</h1>
      <p className="text-gray-500 mt-2">Đang xây dựng…</p>
    </div>
  );
}
