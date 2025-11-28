import React, { useState } from 'react';
import { splitFile, formatBytes } from '../utils/fileUtils';
import { LoadingSpinner } from './Icons';

export const FileSplitterTool: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [minutes, setMinutes] = useState(10);
  const [isProcessing, setIsProcessing] = useState(false);
  const [chunks, setChunks] = useState<File[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setChunks([]);
    }
  };

  const handleSplit = async () => {
    if (!file) return;
    setIsProcessing(true);
    setChunks([]);
    try {
      const result = await splitFile(file, minutes);
      setChunks(result);
    } catch (error) {
      alert(`分割失敗: ${(error as Error).message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mt-8">
      <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
        ✂️ 檔案分割工具
        <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            純前端 (Client-side)
        </span>
      </h3>
      <p className="text-sm text-slate-600 mb-4">
        檔案太大？在此將其分割成小段以便分批轉錄。
        <br/>
        <span className="text-xs text-amber-600">注意：此工具採用位元組分割，對於某些影片格式 (如 MP4)，分割後的片段可能需要修復才能播放，但通常可用於 AI 轉錄。</span>
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">選擇檔案</label>
          <input 
            type="file" 
            onChange={handleFileChange} 
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
          />
        </div>
        
        <div className="flex items-end gap-2">
            <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">分割間隔 (分鐘)</label>
                <input 
                    type="number" 
                    min="1" 
                    value={minutes} 
                    onChange={(e) => setMinutes(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <button
                onClick={handleSplit}
                disabled={!file || isProcessing}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed h-[42px] flex items-center justify-center min-w-[100px]"
            >
                {isProcessing ? <LoadingSpinner /> : '分割'}
            </button>
        </div>
      </div>

      {chunks.length > 0 && (
        <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="font-medium text-slate-700 mb-2">結果 ({chunks.length} 部分):</h4>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                {chunks.map((chunk, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm bg-white p-2 rounded border border-slate-200 shadow-sm">
                        <span className="truncate max-w-[200px]">{chunk.name}</span>
                        <span className="text-slate-500 text-xs mr-2">{formatBytes(chunk.size)}</span>
                        <a 
                            href={URL.createObjectURL(chunk)} 
                            download={chunk.name}
                            className="text-blue-600 hover:text-blue-800 font-medium text-xs uppercase"
                        >
                            下載
                        </a>
                    </div>
                ))}
            </div>
        </div>
      )}
    </div>
  );
};