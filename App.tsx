
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UploadIcon, CheckIcon, ErrorIcon, LoadingSpinner, StopIcon, InfoIcon, SparklesIcon, GoogleIcon, LogoutIcon } from './components/Icons';
import { AudioExtractorTool } from './components/AudioExtractorTool';
import { AudioMergerTool } from './components/AudioMergerTool';
import { MediaPlayer } from './components/MediaPlayer';
import { TranscriptTable } from './components/TranscriptTable';
import { InfoModal } from './components/InfoModal';
import { LicenseModal } from './components/LicenseModal';
import { AdminDashboard } from './components/AdminDashboard';
import { transcribeMedia } from './services/geminiService';
import { signInWithGoogle, logout, auth, db } from './services/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { MAX_INLINE_SIZE_MB, APP_VERSION, FREE_LIMIT_MINUTES, ADMIN_EMAIL } from './constants';
import { AppState, TranscriptionSettings, ErrorDetails, ModelType } from './types';
import { formatBytes, getMediaDuration, splitFile, adjustTimestamps } from './utils/fileUtils';
import { parseTranscript, convertToCSV } from './utils/transcriptUtils';

const App: React.FC = () => {
  // --- State ---
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [file, setFile] = useState<File | null>(null);
  
  // Auth & Pro Status
  const [user, setUser] = useState<User | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  // Transcript State
  const [completedTranscript, setCompletedTranscript] = useState<string>("");
  const [currentPartTranscript, setCurrentPartTranscript] = useState<string>("");
  
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  
  // Tools State
  const [showExtractor, setShowExtractor] = useState(false);
  const [showMerger, setShowMerger] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  const [progress, setProgress] = useState<number>(0);
  
  // --- Settings State ---
  const [settings, setSettings] = useState<TranscriptionSettings>({
    model: ModelType.PRO, 
    identifySpeakers: true,
    speakerNames: [], 
    timestamps: true,
  });

  // --- Refs ---
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // --- Init Check ---
  useEffect(() => {
    // 1. Check local storage for license key and validate expiration
    const checkLicense = async () => {
        const storedHash = localStorage.getItem('hkai_license_key');
        if (storedHash) {
             const docRef = doc(db, "licenses", storedHash);
             try {
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    // Check Expiration
                    if (data.expiresAt && Date.now() > data.expiresAt) {
                        console.warn("Stored license has expired.");
                        localStorage.removeItem('hkai_license_key'); // Remove invalid key
                        setIsPro(false);
                    } else {
                        setIsPro(true);
                    }
                } else {
                    // Key deleted from DB
                    localStorage.removeItem('hkai_license_key');
                    setIsPro(false);
                }
             } catch (e) {
                console.error("Failed to validate cached license", e);
                // On network error, we might be lenient or strict. 
                // Here we default to strict (remain false) or keep true if we trust local state until verify.
             }
        }
    };
    checkLicense();

    // 2. Auth State Listener
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser?.email) {
          console.log(`[Auth] User Logged In: ${currentUser.email}`);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithGoogle();
    } catch (error: any) {
      console.error("Login Error:", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert("登入失敗：網域未授權 (Unauthorized Domain)。\n\n這是 Firebase 安全設定問題。請前往 Firebase Console -> Authentication -> Settings -> Authorized Domains，將您目前的網址網域加入列表中。");
      } else if (error.code === 'auth/popup-closed-by-user') {
        // User closed popup, ignore
      } else if (error.code === 'auth/operation-not-allowed') {
        alert("登入失敗：Google 登入功能未啟用。\n\n請前往 Firebase Console -> Authentication -> Sign-in method，將 Google 設為 Enabled。");
      } else {
        alert(`登入失敗: ${error.message}`);
      }
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  // --- Derived State ---
  const fullTranscript = completedTranscript + currentPartTranscript;
  const tableData = useMemo(() => parseTranscript(fullTranscript), [fullTranscript]);
  
  // Robust Admin Check: Case insensitive with Debug Logging
  const isAdmin = useMemo(() => {
    if (!user?.email) return false;
    
    const userEmail = user.email.trim().toLowerCase();
    const adminEmail = ADMIN_EMAIL.trim().toLowerCase();
    
    const match = userEmail === adminEmail;
    
    // Debug log to help user troubleshoot
    if (match) {
        console.log("✅ Admin access granted.");
    } else {
        console.log(`⚠️ Admin check failed. User: '${userEmail}', Configured Admin: '${adminEmail}'`);
    }
    
    return match;
  }, [user]);

  // --- Handlers ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setAppState(AppState.IDLE);
      setCompletedTranscript("");
      setCurrentPartTranscript("");
      setErrorDetails(null);
      setProgress(0);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
       const selectedFile = e.dataTransfer.files[0];
       if (selectedFile.type.startsWith('audio/') || selectedFile.type.startsWith('video/')) {
         setFile(selectedFile);
         setAppState(AppState.IDLE);
         setCompletedTranscript("");
         setCurrentPartTranscript("");
         setErrorDetails(null);
         setProgress(0);
       } else {
         alert("請上載有效的音訊或影片檔案。");
       }
    }
  };

  const handleStart = async () => {
    if (!file) return;

    // --- LICENSE CHECK START ---
    const duration = await getMediaDuration(file);
    const durationMinutes = duration / 60;

    if (!isPro && durationMinutes > FREE_LIMIT_MINUTES) {
      if (durationMinutes > 0 || file.size > 10 * 1024 * 1024) {
          setShowLicenseModal(true);
          return;
      }
    }
    // --- LICENSE CHECK END ---

    setAppState(AppState.UPLOADING);
    setStatusMessage("初始化中...");
    setCompletedTranscript("");
    setCurrentPartTranscript("");
    setErrorDetails(null);
    setProgress(0);

    abortControllerRef.current = new AbortController();

    try {
      const shouldSplit = durationMinutes > 2 || file.size > 25 * 1024 * 1024;

      if (shouldSplit) {
         setStatusMessage(durationMinutes > 0 
            ? `檔案長度 ${Math.round(durationMinutes)}分鐘，正在自動分割為安全片段...` 
            : `檔案較大 (${formatBytes(file.size)})，正在分割處理...`
         );
         setProgress(2);
         
         const CHUNK_DURATION_MINS = 2;
         const chunks = await splitFile(file, CHUNK_DURATION_MINS); 
         
         for (let i = 0; i < chunks.length; i++) {
            if (abortControllerRef.current?.signal.aborted) break;

            if (!isPro && i * CHUNK_DURATION_MINS >= FREE_LIMIT_MINUTES) {
                 setCompletedTranscript(prev => prev + `\n\n[免費版限制：已停止轉錄。請訂閱以解鎖完整長度。]\n`);
                 setShowLicenseModal(true);
                 break;
            }

            const chunk = chunks[i];
            const partMsg = `[第 ${i + 1}/${chunks.length} 部分]`;
            const chunkStartProgress = Math.round((i / chunks.length) * 100);
            setProgress(chunkStartProgress);

            const offsetSeconds = i * CHUNK_DURATION_MINS * 60;
            let currentChunkAccumulator = "";
            let attempts = 0;
            let success = false;
            const maxRetries = 3;

            while(attempts < maxRetries && !success) {
                if (abortControllerRef.current?.signal.aborted) break;
                try {
                    setStatusMessage(`${partMsg} 處理中 (嘗試 ${attempts + 1}/${maxRetries})...`);
                    currentChunkAccumulator = "";
                    
                    await transcribeMedia(
                        chunk,
                        settings,
                        {
                            onProgress: (textChunk) => {
                                setAppState(AppState.TRANSCRIBING);
                                currentChunkAccumulator += textChunk;
                                setCurrentPartTranscript(adjustTimestamps(currentChunkAccumulator, offsetSeconds));
                            },
                            onStatusChange: (status) => {
                                setStatusMessage(`${partMsg} ${status}`);
                            } 
                        },
                        abortControllerRef.current.signal
                    );
                    success = true;
                } catch (err: any) {
                    attempts++;
                    console.warn(`Chunk ${i+1} failed attempt ${attempts}:`, err);
                    if (abortControllerRef.current?.signal.aborted) break;
                    if (attempts < maxRetries) {
                        setStatusMessage(`${partMsg} 發生錯誤，準備重試 (${attempts}/${maxRetries})...`);
                        await new Promise(r => setTimeout(r, 2000));
                    } else {
                         console.error(`Chunk ${i+1} failed permanently.`);
                         setCompletedTranscript((prev) => prev + `\n\n[錯誤：第 ${i+1} 部分轉錄失敗，已略過]\n\n`);
                         setCurrentPartTranscript("");
                    }
                }
            }

            if (success) {
                const correctedText = adjustTimestamps(currentChunkAccumulator, offsetSeconds);
                setCompletedTranscript((prev) => prev + correctedText + "\n");
                setCurrentPartTranscript("");
            }
            await new Promise(r => setTimeout(r, 1000));
         }

      } else {
         // Standard flow
         setProgress(10);
         let chunkAccumulator = "";
         await transcribeMedia(
            file, 
            settings, 
            {
                onProgress: (textChunk) => {
                    setAppState(AppState.TRANSCRIBING);
                    chunkAccumulator += textChunk;
                    setCurrentPartTranscript(chunkAccumulator);
                    setProgress(prev => Math.min(prev + 0.1, 90));
                },
                onStatusChange: (msg) => {
                    setStatusMessage(msg);
                    if (msg.includes("轉錄")) setProgress(40);
                }
            },
            abortControllerRef.current.signal
         );
         setCompletedTranscript(chunkAccumulator);
         setCurrentPartTranscript("");
      }

      if (abortControllerRef.current?.signal.aborted) {
          setAppState(AppState.IDLE);
      } else {
          setAppState(AppState.COMPLETED);
          setStatusMessage("轉錄完成");
          setProgress(100);
      }

    } catch (err: any) {
      if (err.message === "Aborted by user") {
        setAppState(AppState.IDLE);
        setStatusMessage("已由使用者停止");
        setProgress(0);
        return;
      }
      setAppState(AppState.ERROR);
      setProgress(0);
      let msg = err.message || "發生未知錯誤。";
      let code = "";
      
      if (msg.includes("429")) {
        msg = "API 配額已滿，請稍後再試。";
        code = "429";
      } else if (msg.includes("403")) {
        msg = "API Key 權限錯誤。";
        code = "403";
      }
      setErrorDetails({ message: msg, code });
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(fullTranscript);
    alert("已複製到剪貼簿！");
  };

  const handleDownloadCSV = () => {
    const csvContent = convertToCSV(tableData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Speaker Logic
  const handleAddSpeaker = () => setSettings(p => ({...p, speakerNames: [...p.speakerNames, '']}));
  const handleSpeakerChange = (i: number, v: string) => {
    const ns = [...settings.speakerNames];
    ns[i] = v;
    setSettings(p => ({...p, speakerNames: ns}));
  };
  const handleRemoveSpeaker = (i: number) => setSettings(p => ({...p, speakerNames: p.speakerNames.filter((_, idx) => idx !== i)}));

  const toggleTool = (tool: 'extractor' | 'merger') => {
      setShowExtractor(tool === 'extractor' ? !showExtractor : false);
      setShowMerger(tool === 'merger' ? !showMerger : false);
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto flex flex-col">
      {/* Header */}
      <header className="mb-8 flex justify-between items-center flex-wrap gap-4 flex-none">
        <div className="flex flex-col items-start gap-1">
            <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-slate-800 tracking-tight">
                🇭🇰 廣東話 <span className="text-blue-600">AI</span> 語音轉文字
                </h1>
                <button 
                  onClick={() => setShowInfo(true)}
                  className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                >
                  <InfoIcon />
                </button>
            </div>
            <p className="text-slate-500">
            專為廣東話、中英夾雜及正字優化。
            </p>
        </div>
        
        <div className="flex items-center gap-4">
            {/* User Login Section */}
            {user ? (
               <div className="flex items-center gap-3 mr-2">
                  {user.photoURL && <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-slate-200" />}
                  <span className="text-sm font-medium text-slate-700 hidden sm:block">{user.displayName}</span>
                  <button onClick={handleLogout} className="text-slate-400 hover:text-red-500"><LogoutIcon /></button>
               </div>
            ) : (
               <button onClick={handleLogin} className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors mr-2">
                  <GoogleIcon /> 登入
               </button>
            )}

            {/* Admin Button */}
            {isAdmin && (
                <button onClick={() => setShowAdmin(true)} className="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-full hover:bg-slate-700">
                    🔧 管理後台
                </button>
            )}

             {/* Plan Badge / Button */}
             {isPro ? (
                 <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-100 to-amber-200 text-amber-800 rounded-full text-xs font-bold border border-amber-300">
                     <SparklesIcon /> PRO 會員
                 </div>
             ) : (
                 <button 
                    onClick={() => setShowLicenseModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-full text-xs font-medium transition-colors"
                 >
                    免費版 (限3分鐘) - 點此升級
                 </button>
             )}

            {/* Tools */}
            <div className="flex gap-2 hidden md:flex">
                <button onClick={() => toggleTool('merger')} className={`text-sm px-3 py-1.5 rounded-lg ${showMerger ? 'bg-green-100 text-green-700' : 'text-slate-600 hover:bg-slate-100'}`}>➕ 合併</button>
                <button onClick={() => toggleTool('extractor')} className={`text-sm px-3 py-1.5 rounded-lg ${showExtractor ? 'bg-purple-100 text-purple-700' : 'text-slate-600 hover:bg-slate-100'}`}>🎵 轉MP3</button>
            </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow">
        <div className="lg:col-span-4 space-y-6">
          <div 
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              file ? 'border-blue-500 bg-blue-50' : 'border-slate-300 hover:border-slate-400 bg-white'
            }`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input 
              type="file" 
              accept="audio/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            {file ? (
              <div className="space-y-3">
                <div className="mx-auto w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center"><CheckIcon /></div>
                <p className="font-medium text-slate-800 truncate px-4">{file.name}</p>
                <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
                <button onClick={() => fileInputRef.current?.click()} className="text-sm text-blue-600 font-medium hover:text-blue-800">更換檔案</button>
                {file.size < 500 * 1024 * 1024 && <MediaPlayer file={file} />}
              </div>
            ) : (
              <div className="space-y-4 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className="mx-auto w-fit"><UploadIcon /></div>
                <div>
                  <p className="text-slate-700 font-medium">點擊上載或拖放檔案</p>
                  <p className="text-sm text-slate-400 mt-1">MP3, M4A, WAV, AAC</p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
            <h2 className="font-semibold text-slate-800 border-b border-slate-100 pb-2">設定</h2>
            
            <div className="flex items-center justify-between">
               <label className="text-sm font-medium text-slate-700">時間戳 [MM:SS]</label>
               <button 
                onClick={() => setSettings({...settings, timestamps: !settings.timestamps})}
                disabled={appState !== AppState.IDLE && appState !== AppState.COMPLETED && appState !== AppState.ERROR}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.timestamps ? 'bg-blue-600' : 'bg-slate-200'}`}
               >
                 <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.timestamps ? 'translate-x-6' : 'translate-x-1'}`} />
               </button>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">說話者辨識</label>
                    <button 
                        onClick={() => setSettings({...settings, identifySpeakers: !settings.identifySpeakers})}
                        disabled={appState !== AppState.IDLE && appState !== AppState.COMPLETED && appState !== AppState.ERROR}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.identifySpeakers ? 'bg-blue-600' : 'bg-slate-200'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.identifySpeakers ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
                {settings.identifySpeakers && (
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <div className="flex justify-between items-center mb-2">
                             <label className="block text-xs font-medium text-slate-500">已知說話者</label>
                             <button onClick={handleAddSpeaker} className="text-xs text-blue-600 hover:underline">+ 新增</button>
                        </div>
                        {settings.speakerNames.map((name, idx) => (
                            <div key={idx} className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-slate-400 whitespace-nowrap w-16">Speaker {idx + 1}:</span>
                                <input type="text" placeholder="名字" value={name} onChange={(e) => handleSpeakerChange(idx, e.target.value)} className="flex-1 text-sm p-1.5 border border-slate-200 rounded" />
                                <button onClick={() => handleRemoveSpeaker(idx)} className="text-slate-400 hover:text-red-500">✕</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {appState === AppState.UPLOADING || appState === AppState.TRANSCRIBING || appState === AppState.PROCESSING ? (
                <button onClick={handleStop} className="w-full py-3 bg-red-50 text-red-600 font-semibold rounded-lg hover:bg-red-100 flex items-center justify-center gap-2 border border-red-200"><StopIcon /> 停止生成</button>
            ) : (
                <button onClick={handleStart} disabled={!file} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-md shadow-blue-200">開始轉錄 {isPro ? '(Pro)' : '(免費版)'}</button>
            )}
          </div>
          
          {showMerger && <AudioMergerTool />}
          {showExtractor && <AudioExtractorTool />}
        </div>

        <div className="lg:col-span-8 flex flex-col h-[600px] lg:h-auto bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white z-10 sticky top-0">
                <div className="flex items-center gap-3">
                    <h2 className="font-semibold text-slate-800">轉錄結果</h2>
                    {appState !== AppState.IDLE && (
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1.5 ${appState === AppState.COMPLETED ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                           {(appState === AppState.UPLOADING || appState === AppState.TRANSCRIBING || appState === AppState.PROCESSING) && <LoadingSpinner />}
                           {statusMessage || appState}
                        </span>
                    )}
                </div>
                <div className="flex gap-2">
                    <button onClick={handleCopy} disabled={!fullTranscript} className="text-xs font-medium text-slate-600 hover:text-blue-600 px-3 py-1.5 rounded border border-slate-200">複製文字</button>
                    <button onClick={handleDownloadCSV} disabled={!fullTranscript} className="text-xs font-medium text-green-700 hover:text-green-800 px-3 py-1.5 rounded border border-green-200 bg-green-50">下載 CSV</button>
                </div>
            </div>
            {(appState === AppState.UPLOADING || appState === AppState.TRANSCRIBING || appState === AppState.PROCESSING) && (
                <div className="w-full bg-slate-100 h-1"><div className="bg-blue-600 h-1 transition-all duration-300" style={{ width: `${progress}%` }} /></div>
            )}
            <div className="flex-1 overflow-y-auto bg-slate-50 relative">
                {fullTranscript ? (
                   <div className="h-full"><TranscriptTable data={tableData} />{tableData.length === 0 && <div className="p-6 whitespace-pre-wrap font-mono text-sm">{fullTranscript}</div>}</div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6">
                         {appState === AppState.ERROR ? (
                             <div className="text-center max-w-md">
                                 <div className="inline-block p-3 bg-red-100 rounded-full mb-3 text-red-500"><ErrorIcon /></div>
                                 <h3 className="text-slate-800 font-medium">轉錄失敗</h3>
                                 <p className="text-sm text-red-600 mt-1">{errorDetails?.message}</p>
                             </div>
                         ) : <p>上載檔案以開始，結果將以表格顯示。</p>}
                    </div>
                )}
                <div ref={bottomRef} />
            </div>
        </div>

        <InfoModal isOpen={showInfo} onClose={() => setShowInfo(false)} />
        <LicenseModal isOpen={showLicenseModal} onClose={() => setShowLicenseModal(false)} onSuccess={() => setIsPro(true)} user={user} />
        <AdminDashboard isOpen={showAdmin} onClose={() => setShowAdmin(false)} />
      </main>
      
      <footer className="mt-8 py-6 text-center text-slate-400 text-xs border-t border-slate-100 flex-none">
        <p>Cantonese AI Transcriber {APP_VERSION}</p>
      </footer>
    </div>
  );
};

export default App;
