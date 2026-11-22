// Khung quét QR bằng camera, hoạt động như màn hình quét của app ngân hàng: video phát ngay trong khung, không điều khiển, không toàn màn hình.
// Tự dựng bằng getUserMedia thay vì thư viện có sẵn thẻ video, vì trên iOS thẻ video do thư viện tạo hiện nút play và có thể mở toàn màn hình.
// Giải mã: BarcodeDetector (Chrome/Android, nhanh) nếu có, không thì jsQR (iPhone Safari, mọi trình duyệt).
// Gọi onScan(text) mỗi lần đọc được mã.
import { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

const SCAN_INTERVAL_MS = 120;
const MAX_SIDE = 640; // thu nhỏ khung hình trước khi giải mã cho nhanh

function explain(err) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
    return 'Trình duyệt này không mở được camera. Hãy mở trang bằng Safari hoặc Chrome (không dùng trình duyệt trong Zalo/Messenger), hoặc dùng "Nhập mã vé thủ công".';
  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError')
    return 'Chưa có quyền camera. Hãy cho phép camera cho trang này trong cài đặt trình duyệt rồi bấm "Thử lại".';
  if (err?.name === 'NotFoundError' || err?.name === 'OverconstrainedError') return 'Không tìm thấy camera trên thiết bị này.';
  if (err?.name === 'NotReadableError') return 'Camera đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi bấm "Thử lại".';
  return 'Không mở được camera. Hãy cấp quyền camera hoặc dùng "Nhập mã vé thủ công".';
}

export default function QrScanner({ onScan }) {
  const handler = useRef(onScan);
  handler.current = onScan;
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let stream = null;
    let timer = null;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const detector = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
    setError(null);

    async function decode(video) {
      if (detector) {
        const found = await detector.detect(video);
        return found[0]?.rawValue ?? null;
      }
      const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
    }

    async function loop() {
      const video = videoRef.current;
      if (stopped || !video) return;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        try {
          const text = await decode(video);
          if (text && !stopped) handler.current(text);
        } catch {
          /* khung hình lỗi: bỏ qua, thử khung kế tiếp */
        }
      }
      if (!stopped) timer = setTimeout(loop, SCAN_INTERVAL_MS);
    }

    (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('insecure');
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        // Lấy nét liên tục nếu thiết bị hỗ trợ (giúp mã gần camera không bị mờ)
        stream.getVideoTracks()[0]?.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        loop();
      } catch (err) {
        if (!stopped) setError(explain(err));
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [attempt]);

  return (
    <div className="relative rounded-3xl bg-black overflow-hidden h-[340px]">
      {/* playsInline + muted + autoPlay: bắt buộc trên iOS để video chạy ngay trong khung, không bật trình phát toàn màn hình.
          pointer-events-none và controls={false}: không có nút play/tua như video thường. */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        className="absolute inset-0 w-full h-full object-cover pointer-events-none [&::-webkit-media-controls]:hidden [&::-webkit-media-controls-start-playback-button]:hidden"
      />
      <div className={'absolute left-1/2 top-1/2 w-[220px] h-[220px] -ml-[110px] -mt-[130px] pointer-events-none ' + (error ? 'opacity-30' : '')}>
        <span className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white rounded-tl-2xl" />
        <span className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white rounded-tr-2xl" />
        <span className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white rounded-bl-2xl" />
        <span className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white rounded-br-2xl" />
        {!error && <span className="absolute left-3 right-3 top-1/2 h-[3px] bg-glow rounded animate-scan" />}
      </div>
      <div className="absolute bottom-4 inset-x-0 px-6 text-center">
        <p className={'text-sm ' + (error ? 'text-amber-300' : 'text-white/80 [text-shadow:0_1px_3px_rgba(0,0,0,0.8)]')}>
          {error ?? 'Đưa mã QR trên vé vào khung'}
        </p>
        {error && (
          <button onClick={retry} className="mt-3 rounded-lg bg-white/15 hover:bg-white/25 px-4 py-2 text-sm font-bold text-white">
            Thử lại
          </button>
        )}
      </div>
    </div>
  );
}
