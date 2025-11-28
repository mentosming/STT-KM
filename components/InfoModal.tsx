
import React from 'react';
import { XMarkIcon } from './Icons';
import { SUBSCRIPTION_URL, FREE_LIMIT_MINUTES } from '../constants';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[50] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in-up">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            📖 使用說明與簡介
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <XMarkIcon />
          </button>
        </div>

        <div className="p-6 space-y-6 text-slate-600">
          
          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">關於此工具</h3>
            <p className="leading-relaxed text-sm">
              這是一個專為<b>廣東話 (Cantonese)</b> 設計的 AI 語音轉文字網頁應用程式。
              我們利用 Google 最新的 Gemini 3.0 Pro 模型，解決傳統語音轉文字無法準確識別「中英夾雜」、「口語助詞 (嘅、喺、咁)」的問題。
            </p>
          </section>

          {/* Subscription Section */}
          <section className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-xl border border-amber-100">
             <h3 className="text-lg font-bold text-amber-800 mb-2 flex items-center gap-2">
                💎 訂閱計劃 (Pro)
             </h3>
             <div className="text-sm text-amber-900 space-y-2">
                <p>為了維持服務運作，免費版設有以下限制：</p>
                <ul className="list-disc list-inside ml-2 font-medium">
                    <li>單次轉錄長度上限：<b>{FREE_LIMIT_MINUTES} 分鐘</b></li>
                </ul>
                <p className="mt-2">
                    如需轉錄更長的錄音 (無限時長)，請考慮支持我們。每月只需 <b>$1 USD</b>，我們將發送專屬的「啟用碼 (License Key)」給您解鎖完整功能。
                </p>
                <div className="mt-4">
                    <a 
                        href={SUBSCRIPTION_URL} 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-block px-4 py-2 bg-amber-600 text-white font-semibold rounded-lg hover:bg-amber-700 shadow-sm transition-colors"
                    >
                        前往訂閱支持 &rarr;
                    </a>
                </div>
             </div>
          </section>

          <section className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">🚀 快速開始</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-blue-900">
              <li>
                <b>上載檔案</b>：點擊左側上載區域或拖放檔案。
              </li>
              <li>
                <b>輸入啟用碼 (如適用)</b>：若檔案超過 {FREE_LIMIT_MINUTES} 分鐘，請先點擊右上角按鈕輸入啟用碼。
              </li>
              <li>
                <b>設定 (可選)</b>：開啟「說話者辨識」並輸入名字。
              </li>
              <li>
                <b>開始轉錄</b>：點擊按鈕，系統會即時顯示結果。
              </li>
            </ol>
          </section>
          
          <section>
            <h3 className="text-lg font-semibold text-slate-800 mb-3">常見問題</h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="font-medium text-slate-900">Q: 如何獲得啟用碼？</p>
                <p className="mt-1">
                  A: 請點擊上方的訂閱按鈕。付款成功後，您會在感謝頁面或 Email 中收到一組代碼 (例如 VIP-xxxx)。
                </p>
              </div>
              <div>
                <p className="font-medium text-slate-900">Q: 啟用碼可以共用嗎？</p>
                <p className="mt-1">
                  A: 每組啟用碼都是唯一的。為了保障您的權益，請勿將其公開。若發現濫用，該代碼可能會失效。
                </p>
              </div>
            </div>
          </section>

        </div>
        
        <div className="p-6 border-t border-slate-100 bg-slate-50 text-center rounded-b-2xl">
           <button 
             onClick={onClose}
             className="px-6 py-2 bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-700 transition-colors"
           >
             明白了
           </button>
        </div>
      </div>
    </div>
  );
};
