import React, { useState, useEffect } from 'react';
import { db, auth } from '../services/firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import { computeSHA256 } from '../utils/cryptoUtils';
import { XMarkIcon, LoadingSpinner, TrashIcon } from './Icons';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface License {
  id: string; // This is the hash
  createdAt: number;
  expiresAt?: number; // Optional expiration timestamp
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose }) => {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [newKey, setNewKey] = useState('');
  const [durationMonths, setDurationMonths] = useState(1); // Default 1 month
  const [isPermanent, setIsPermanent] = useState(false);
  const [calculatedHash, setCalculatedHash] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-calculate hash when user types
  useEffect(() => {
    const calc = async () => {
        if (!newKey.trim()) {
            setCalculatedHash('');
            return;
        }
        const hash = await computeSHA256(newKey.trim());
        setCalculatedHash(hash);
    };
    calc();
  }, [newKey]);

  useEffect(() => {
    if (!isOpen) return;
    
    // Listen to realtime updates
    const q = query(collection(db, "licenses"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: License[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as License);
      });
      // Sort by creation date desc
      setLicenses(list.sort((a,b) => b.createdAt - a.createdAt));
    }, (error) => {
      console.error("Firestore Listen Error:", error);
    });

    return () => unsubscribe();
  }, [isOpen]);

  const handleAddKey = async () => {
    if (!newKey.trim()) return;
    setLoading(true);
    try {
      const hash = await computeSHA256(newKey.trim());
      
      const now = Date.now();
      let expiresAt = null;

      if (!isPermanent) {
          // Calculate expiration: Now + X months
          const d = new Date();
          d.setMonth(d.getMonth() + durationMonths);
          expiresAt = d.getTime();
      }

      const data: any = { createdAt: now };
      if (expiresAt) data.expiresAt = expiresAt;

      // Add to Firestore
      await setDoc(doc(db, "licenses", hash), data);
      
      setNewKey('');
      alert("✅ 成功！啟用碼已自動儲存。");
    } catch (e: any) {
      console.error(e);
      alert(`❌ 自動儲存失敗: ${e.message}\n\n請使用下方的「手動操作」方式。`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (hash: string) => {
    if (!confirm("確定要刪除此金鑰嗎？")) return;
    try {
      await deleteDoc(doc(db, "licenses", hash));
    } catch (e: any) {
      alert(`刪除失敗: ${e.message}`);
    }
  };

  const formatDate = (ts?: number) => {
      if (!ts) return <span className="text-green-600 font-bold">永久有效</span>;
      const date = new Date(ts);
      const isExpired = Date.now() > ts;
      return (
        <span className={isExpired ? "text-red-600 font-bold" : "text-slate-600"}>
            {date.toLocaleDateString()} {isExpired && "(已過期)"}
        </span>
      );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden animate-fade-in-up">
        
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center flex-none">
           <div>
              <h2 className="font-bold flex items-center gap-2">🔧 管理後台</h2>
              <p className="text-xs text-slate-400 mt-1">登入帳號: {auth.currentUser?.email}</p>
           </div>
           <button onClick={onClose}><XMarkIcon /></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 bg-slate-50">
           
           {/* Generator Section */}
           <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 mb-6">
              <h3 className="font-semibold text-slate-800 mb-3 border-b pb-2">1. 新增啟用碼 (設定時效)</h3>
              
              <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">啟用碼內容</label>
                    <input 
                        type="text" 
                        value={newKey}
                        onChange={e => setNewKey(e.target.value)}
                        placeholder="例如: VIP-NOV-2024"
                        className="w-full px-3 py-2 border border-slate-300 rounded font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="permCheck" 
                            checked={isPermanent} 
                            onChange={e => setIsPermanent(e.target.checked)}
                            className="w-4 h-4 text-blue-600"
                          />
                          <label htmlFor="permCheck" className="text-sm text-slate-700">永久有效</label>
                      </div>

                      {!isPermanent && (
                          <div className="flex items-center gap-2">
                             <label className="text-sm text-slate-700">有效月數:</label>
                             <select 
                                value={durationMonths} 
                                onChange={e => setDurationMonths(Number(e.target.value))}
                                className="border border-slate-300 rounded px-2 py-1 text-sm"
                             >
                                 <option value={1}>1 個月</option>
                                 <option value={3}>3 個月</option>
                                 <option value={6}>6 個月</option>
                                 <option value={12}>1 年</option>
                             </select>
                             <span className="text-xs text-slate-400">
                                (到期日: {new Date(Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000).toLocaleDateString()})
                             </span>
                          </div>
                      )}
                  </div>

                  <button 
                    onClick={handleAddKey} 
                    disabled={loading || !newKey}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {loading ? <LoadingSpinner /> : "產生並儲存"}
                  </button>
              </div>

              {/* Manual Helper */}
              {calculatedHash && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                      <p className="text-amber-800 font-bold mb-1">👇 手動新增 (若自動失敗)：</p>
                      <code className="block bg-white p-2 border border-amber-200 rounded font-mono text-xs text-slate-600 break-all select-all">
                          {calculatedHash}
                      </code>
                      <div className="mt-2 text-xs text-amber-900">
                         <strong>提示：</strong> 若要手動設定到期日，請在 Firebase 新增欄位 <code>expiresAt</code> (類型: number)，填入 Timestamp。若不填則視為永久。
                      </div>
                  </div>
              )}
           </div>

           {/* List Section */}
           <h3 className="font-semibold text-slate-800 mb-3">資料庫中的有效金鑰</h3>
           <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
              {licenses.length === 0 ? (
                 <div className="p-8 text-center text-slate-400 text-sm">
                    目前沒有資料，或無法讀取資料庫。
                 </div>
              ) : (
                 <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                       <tr>
                          <th className="px-4 py-2 font-medium text-slate-500">Hash (ID)</th>
                          <th className="px-4 py-2 font-medium text-slate-500">到期日</th>
                          <th className="px-4 py-2 font-medium text-slate-500 w-20">操作</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {licenses.map(lic => (
                          <tr key={lic.id} className="hover:bg-slate-50">
                             <td className="px-4 py-3 font-mono text-xs text-slate-600 truncate max-w-[200px]" title={lic.id}>
                                {lic.id}
                             </td>
                             <td className="px-4 py-3 text-xs whitespace-nowrap">
                                {formatDate(lic.expiresAt)}
                             </td>
                             <td className="px-4 py-3 text-center">
                                <button 
                                   onClick={() => handleDelete(lic.id)}
                                   className="text-red-400 hover:text-red-600 bg-red-50 p-1.5 rounded"
                                >
                                   <TrashIcon />
                                </button>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              )}
           </div>

           {/* Rules Guide */}
           <div className="mt-8 p-4 bg-slate-100 rounded-lg text-xs text-slate-500">
               <h4 className="font-bold text-slate-700 mb-2">Firebase 安全規則設定指南</h4>
               <p className="mb-2">請確保您的 Firebase Rules 設定如下，讓使用者能驗證，且只有您能管理：</p>
               <pre className="bg-slate-800 text-slate-200 p-3 rounded overflow-x-auto font-mono select-all">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /licenses/{licenseHash} {
      allow get: if true;
      allow list, write, delete: if request.auth.token.email == '${auth.currentUser?.email || "您的AdminEmail"}';
    }
  }
}`}
               </pre>
           </div>
        </div>
      </div>
    </div>
  );
};