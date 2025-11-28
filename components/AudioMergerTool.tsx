import React, { useState } from 'react';
import { LoadingSpinner, CheckIcon } from './Icons';
import { formatBytes } from '../utils/fileUtils';

declare var lamejs: any;

export const AudioMergerTool: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Append new files to existing list
      const newFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...newFiles]);
      setDownloadUrl(null);
      setProgress(0);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setDownloadUrl(null);
  };

  const mergeAudio = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setProgress(0);
    setDownloadUrl(null);

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // We force a standard sample rate for the output MP3 (e.g., 44.1kHz)
      // All inputs will be resampled to this by decodeAudioData automatically if they differ.
      const TARGET_SAMPLE_RATE = audioCtx.sampleRate; 
      const kbps = 128;
      const channels = 2; // Force stereo output
      const mp3encoder = new lamejs.Mp3Encoder(channels, TARGET_SAMPLE_RATE, kbps);
      const mp3Data: Int8Array[] = [];

      const sampleBlockSize = 1152; 

      for (let i = 0; i < files.length; i++) {
        // Update Progress based on file count
        setProgress(Math.round((i / files.length) * 100));

        const file = files[i];
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : left; // Duplicate mono if needed

        const length = left.length;
        let idx = 0;

        // Process this file in chunks
        while (idx < length) {
             // Yield to UI thread every so often
             if (idx % (sampleBlockSize * 50) === 0) {
                 await new Promise(r => setTimeout(r, 0));
             }

             let leftChunk = new Int16Array(sampleBlockSize);
             let rightChunk = new Int16Array(sampleBlockSize);
             let blockSize = Math.min(length - idx, sampleBlockSize);

             for (let j = 0; j < blockSize; j++) {
                 // Float to Int16 conversion
                 let s = left[idx + j];
                 s = s < 0 ? s * 0x8000 : s * 0x7FFF;
                 leftChunk[j] = s;

                 let s2 = right[idx + j];
                 s2 = s2 < 0 ? s2 * 0x8000 : s2 * 0x7FFF;
                 rightChunk[j] = s2;
             }

             const mp3buf = mp3encoder.encodeBuffer(leftChunk.subarray(0, blockSize), rightChunk.subarray(0, blockSize));
             if (mp3buf.length > 0) mp3Data.push(mp3buf);

             idx += sampleBlockSize;
        }
      }

      // Finish
      const mp3buf = mp3encoder.flush();
      if (mp3buf.length > 0) mp3Data.push(mp3buf);

      const blob = new Blob(mp3Data as any[], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setProgress(100);
      
      audioCtx.close();

    } catch (error) {
      console.error(error);
      alert("合併失敗: 可能是記憶體不足或檔案格式損壞。");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mt-8">
      <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
        ➕ 合併錄音工具
        <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            純前端 (Client-side)
        </span>
      </h3>
      <p className="text-sm text-slate-600 mb-4">
        將多個音訊檔案合併為單一 MP3 檔案。適合處理被分割的片段或零散的錄音。
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Input & List */}
        <div className="space-y-4">
            <label className="block">
                <span className="sr-only">選擇檔案</span>
                <input 
                    type="file" 
                    multiple
                    accept="audio/*"
                    onChange={handleFileChange} 
                    className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer"
                />
            </label>

            {files.length > 0 && (
                <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto bg-slate-50">
                    {files.map((f, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 text-xs border-b border-slate-100 last:border-0">
                            <span className="truncate flex-1 font-mono text-slate-600">{idx + 1}. {f.name}</span>
                            <span className="text-slate-400 mr-2">{formatBytes(f.size)}</span>
                            <button 
                                onClick={() => removeFile(idx)}
                                className="text-red-400 hover:text-red-600 px-1"
                                disabled={isProcessing}
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
        
        {/* Right: Actions */}
        <div className="flex flex-col justify-end space-y-4">
           {files.length > 1 && !downloadUrl && (
             <button
                onClick={mergeAudio}
                disabled={isProcessing}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed h-[42px] flex items-center justify-center gap-2 shadow-sm"
             >
                {isProcessing ? <LoadingSpinner /> : `合併 ${files.length} 個檔案`}
             </button>
           )}
           
           {downloadUrl && (
             <a
                href={downloadUrl}
                download={`merged_audio_${new Date().getTime()}.mp3`}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 h-[42px] flex items-center justify-center gap-2 font-medium shadow-sm"
             >
                <CheckIcon /> 下載合併後的 MP3
             </a>
           )}

            {isProcessing && (
                <div className="mt-2">
                    <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>處理中...</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2">
                        <div 
                            className="bg-green-600 h-2 rounded-full transition-all duration-200"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};