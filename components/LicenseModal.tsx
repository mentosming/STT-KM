
import React, { useState } from 'react';
import { XMarkIcon, LoadingSpinner, SparklesIcon, GoogleIcon } from './Icons';
import { computeSHA256 } from '../utils/cryptoUtils';
import { SUBSCRIPTION_URL } from '../constants';
import { db, signInWithGoogle } from '../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { User } from 'firebase/auth';

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: User | null;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({ isOpen, onClose, onSuccess, user }) => {
  const [inputKey, setInputKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleLogin = async () => {
     try {
         await signInWithGoogle();
     } catch (e) {
         console.error(e);
         alert("登入失敗，請稍後再試。");
     }
  };

  const handleVerify = async () => {
    if (!inputKey.trim()) return;
    setLoading(true);
    setError('');

    try {
      // 1. Hash the input
      const hash = await computeSHA256(inputKey.trim());
      
      // 2. Check against Firestore Database
      const docRef = doc(db, "licenses", hash);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // 3. Check Expiration
        if (data.expiresAt && Date.now() > data.expiresAt) {
             setError("此啟用碼已過期，請訂閱以獲取新碼。");
        } else {
             // Success
             localStorage.setItem('hkai_license_key', hash);
             onSuccess();
             onClose();
        }
      } else {
        setError('啟用碼無效，請檢查是否輸入錯誤。');
      }
    } catch (err) {
      console.error(err);
      setError('驗證發生錯誤 (請檢查網路)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white text-center">
          <div className="mx-auto bg-white/20 w-12 h-12 rounded-full flex items-center justify-center mb-3 backdrop-blur-md">
            <SparklesIcon />
          </div>
          <h2 className="text-xl font-bold">解鎖完整功能</h2>
          <p className="text-blue-100 text-sm mt-1">啟用 Pro 版以移除 3 分鐘限制</p>
        </div>

        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white"
        >
          <XMarkIcon />
        </button>

        {/* Body */}
        <div className="p-6 space-y-6">
          {!user ? (
            <div className="text-center py-4">
                <div className="mb-4 text-slate-600 text-sm">
                    為了確保啟用碼與您的帳號安全綁定，<br/>請先登入 Google 帳號。
                </div>
                <button 
                    onClick={handleLogin}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 font-medium transition-colors shadow-sm"
                >
                    <GoogleIcon /> 使用 Google 帳號登入
                </button>
            </div>
          ) : (
            <>
                <div className="text-center mb-2">
                    <p className="text-xs text-slate-500">已登入為</p>
                    <p className="text-sm font-medium text-slate-800">{user.email}</p>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">輸入啟用碼 (License Key)</label>
                    <input 
                    type="text" 
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    placeholder="例如: VIP-xxxx-xxxx"
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none text-center font-mono text-lg tracking-wide uppercase"
                    />
                    {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
                </div>

                <button
                    onClick={handleVerify}
                    disabled={loading || !inputKey}
                    className="w-full py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                >
                    {loading ? <LoadingSpinner /> : '驗證啟用碼'}
                </button>

                <div className="text-center">
                    <p className="text-xs text-slate-500 mb-2">還沒有啟用碼？</p>
                    <a 
                    href={SUBSCRIPTION_URL} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-blue-600 font-medium text-sm hover:underline"
                    >
                    前往訂閱獲取 ($1/月) &rarr;
                    </a>
                </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
