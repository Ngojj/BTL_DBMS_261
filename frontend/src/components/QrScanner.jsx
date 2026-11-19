// Khung quét QR bằng camera (html5-qrcode). Gọi onScan(text) mỗi lần đọc được mã.
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const ELEMENT_ID = 'qr-reader';

export default function QrScanner({ onScan }) {
  const handler = useRef(onScan);
  handler.current = onScan;
  const [error, setError] = useState(null);

  useEffect(() => {
    const scanner = new Html5Qrcode(ELEMENT_ID);
    const started = scanner
      // Không đặt qrbox: quét toàn bộ khung hình. Video bị cắt theo kiểu object-cover nên vùng qrbox của thư viện sẽ lệch với khung ngắm trên màn hình.
      .start({ facingMode: 'environment' }, { fps: 10 }, (text) => handler.current(text), () => {})
      .catch(() => setError('Không mở được camera. Hãy cấp quyền camera hoặc dùng "Nhập mã vé thủ công".'));
    return () => {
      started.then(() => scanner.stop()).then(() => scanner.clear()).catch(() => {});
    };
  }, []);

  return (
    <div className="relative rounded-3xl bg-black overflow-hidden h-[340px]">
      <div id={ELEMENT_ID} className="absolute inset-0 w-full h-full overflow-hidden [&_video]:!w-full [&_video]:!h-full [&_video]:object-cover [&_#qr-shaded-region]:!hidden" />
      <div className={'absolute left-1/2 top-1/2 w-[220px] h-[220px] -ml-[110px] -mt-[130px] pointer-events-none ' + (error ? 'opacity-30' : '')}>
        <span className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white rounded-tl-2xl" />
        <span className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white rounded-tr-2xl" />
        <span className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white rounded-bl-2xl" />
        <span className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white rounded-br-2xl" />
        {!error && <span className="absolute left-3 right-3 top-1/2 h-[3px] bg-glow rounded animate-scan" />}
      </div>
      <p className={'absolute bottom-4 inset-x-0 px-6 text-center text-sm ' + (error ? 'text-amber-300' : 'text-white/60')}>{error ?? 'Đưa mã QR trên vé vào khung'}</p>
    </div>
  );
}
