import React, { useState } from 'react';
import { LoadingSpinner, CheckIcon } from './Icons';
import { formatBytes } from '../utils/fileUtils';

declare var lamejs: any;

export const AudioExtractorTool: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setDownloadUrl(null);
      setProgress(0);
      
      // Prepare filename
      const name = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) || selectedFile.name;
      setFileName(`${name}.mp3`);
    }
  };

  const convertToMp3 = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgress(0);
    setDownloadUrl(null);

    try {
      // 1. Read File
      const arrayBuffer = await file.arrayBuffer();
      
      // 2. Decode Audio (Web Audio API)
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      
      // 3. Prepare LameJS Encoder
      const channels = audioBuffer.numberOfChannels;
      const sampleRate = audioBuffer.sampleRate;
      const kbps = 128; 
      
      const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, kbps);
      const mp3Data: Int8Array[] = [];

      // 4. Process Samples
      // We process in chunks to avoid blocking the UI thread
      const left = audioBuffer.getChannelData(0);
      const right = channels > 1 ? audioBuffer.getChannelData(1) : null;
      
      const sampleBlockSize = 1152; // multiple of 576
      const length = left.length;
      let i = 0;

      const processChunk = () => {
        const start = Date.now();
        // Process for ~20ms then yield
        while (i < length && (Date.now() - start < 20)) {
           let leftChunk = new Int16Array(sampleBlockSize);
           let rightChunk = new Int16Array(sampleBlockSize);
           let blockSize = Math.min(length - i, sampleBlockSize);

           for (let j = 0; j < blockSize; j++) {
              // Convert Float32 [-1, 1] to Int16 [-32768, 32767]
              let s = left[i + j];
              s = s < 0 ? s * 0x8000 : s * 0x7FFF;
              leftChunk[j] = s;
              
              if (right) {
                  let s2 = right[i + j];
                  s2 = s2 < 0 ? s2 * 0x8000 : s2 * 0x7FFF;
                  rightChunk[j] = s2;
              } else {
                  rightChunk[j] = s; // Mono to Stereo copy if needed, or lame handles mono
              }
           }
           
           // Encode
           let mp3buf;
           if (channels === 1) {
              mp3buf = mp3encoder.encodeBuffer(leftChunk.subarray(0, blockSize));
           } else {
              mp3buf = mp3encoder.encodeBuffer(leftChunk.subarray(0, blockSize), rightChunk.subarray(0, blockSize));
           }
           
           if (mp3buf.length > 0) {
              mp3Data.push(mp3buf);
           }
           
           i += sampleBlockSize;
        }

        // Update Progress
        setProgress(Math.min(Math.round((i / length) * 100), 99));

        if (i < length) {
            // Continue next frame
            setTimeout(processChunk, 0);
        } else {
            // Finish
            const mp3buf = mp3encoder.flush();
            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }
            
            const blob = new Blob(mp3Data as any[], { type: 'audio/mp3' });
            const url = URL.createObjectURL(blob);
            setDownloadUrl(url);
            setProgress(100);
            setIsProcessing(false);
            audioCtx.close();
        }
      };

      processChunk();

    } catch (error) {
      console.error(error);
      alert("轉換失敗: 可能是檔案格式不支援或檔案太大導致記憶體不足。");
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mt-8">
      <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
        🎵 影片轉 MP3 工具
        <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            純前端 (Client-side)
        </span>
      </h3>
      <p className="text-sm text-slate-600 mb-4">
        直接從影片中提取音軌並轉換為 MP3 下載。完全在瀏覽器內執行，無需上載。
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">選擇影片檔案</label>
          <input 
            type="file" 
            accept="video/*,audio/*"
            onChange={handleFileChange} 
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 cursor-pointer"
          />
        </div>
        
        <div>
           {file && !downloadUrl && (
             <button
                onClick={convertToMp3}
                disabled={isProcessing}
                className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed h-[42px] flex items-center justify-center gap-2"
             >
                {isProcessing ? <LoadingSpinner /> : '開始轉換 MP3'}
             </button>
           )}
           
           {downloadUrl && (
             <a
                href={downloadUrl}
                download={fileName}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 h-[42px] flex items-center justify-center gap-2 font-medium"
             >
                <CheckIcon /> 下載 MP3
             </a>
           )}
        </div>
      </div>

      {isProcessing && (
         <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>轉換中...</span>
                <span>{progress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2">
                <div 
                    className="bg-purple-600 h-2 rounded-full transition-all duration-200"
                    style={{ width: `${progress}%` }}
                />
            </div>
         </div>
      )}
      
      {file && (
        <div className="mt-2 text-xs text-slate-400">
           檔案: {file.name} ({formatBytes(file.size)})
        </div>
      )}
    </div>
  );
};