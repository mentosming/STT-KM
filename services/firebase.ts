import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

// =================================================================
// ✅ 已填入您的 hk-transcriber-v2 設定
// =================================================================
const firebaseConfig = {
  apiKey: "AIzaSyATj6JbpbBfDczO95fEkuDAIS3tq57s2ow",
  authDomain: "hk-transcriber-v2.firebaseapp.com",
  projectId: "hk-transcriber-v2",
  storageBucket: "hk-transcriber-v2.firebasestorage.app",
  messagingSenderId: "944064620802",
  appId: "1:944064620802:web:9812b014eb5f270f0a3a1b"
};

// 初始化 Firebase
const app = initializeApp(firebaseConfig);

// 初始化 Auth
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// 初始化 Firestore 
// 使用 experimentalForceLongPolling: true 以解決某些防火牆或預覽環境下 (如 StackBlitz/WebContainer)
// 無法連線到 Firestore 導致資料寫入失敗的問題。
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  }),
  experimentalForceLongPolling: true, 
});

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error("Login failed", error);
    throw error;
  }
};

export const logout = async () => {
  await signOut(auth);
};

export { auth, db };