// Firebase Web SDK – CHỈ đọc/lắng nghe Firestore (ngoại lệ: staff ghi checkedIn vào validTickets)
// TODO [firebase] Phụ trách: TV5 (cấu hình Firebase, sơ đồ ghế realtime, offline)
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import {
  initializeFirestore, connectFirestoreEmulator,
  persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
});

// Cache IndexedDB → trang soát vé đọc/ghi được khi mất mạng
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
export const auth = getAuth(app);

// Đăng nhập Google: mở popup chọn tài khoản, trả về Firebase ID token + thông tin hiển thị.
// Token này gửi cho backend (POST /api/auth/google) – backend xác minh rồi cấp JWT của TicketRush.
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export async function pickGoogleAccount() {
  const { user } = await signInWithPopup(auth, googleProvider);
  return { idToken: await user.getIdToken(), profile: { name: user.displayName, email: user.email } };
}

// Hai cờ độc lập: có thể để Firestore chạy Emulator (dữ liệu seed) mà đăng nhập Google THẬT (VITE_USE_AUTH_EMULATOR=false)
if (import.meta.env.VITE_USE_EMULATOR === 'true') connectFirestoreEmulator(db, '127.0.0.1', 8085);
const authEmulator = import.meta.env.VITE_USE_AUTH_EMULATOR ?? import.meta.env.VITE_USE_EMULATOR; // thiếu cờ riêng thì theo cờ chung
if (authEmulator === 'true') connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
