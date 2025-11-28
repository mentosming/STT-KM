import React, { useState, useRef, useEffect } from 'react';
import { PlayIcon, PauseIcon } from './Icons';

interface MediaPlayerProps {
  file: File;
}

export const MediaPlayer: React.FC<MediaPlayerProps> = ({ file }) => {
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const isVideo = file.type.startsWith('video/');

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    // Reset state on file change
    setProgress(0);
    setIsPlaying(false);
    return () => {
        URL.revokeObjectURL(url);
    };
  }, [file]);

  const togglePlay = () => {
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.pause();
      } else {
        mediaRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      setProgress(mediaRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (mediaRef.current) {
      setDuration(mediaRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (mediaRef.current) {
      mediaRef.current.currentTime = time;
      setProgress(time);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "00:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!objectUrl) return null;

  return (
    <div className="mt-4 bg-slate-50 rounded-lg p-3 border border-slate-200">
      {isVideo ? (
        <div className="mb-3 aspect-video bg-black rounded overflow-hidden relative group">
             <video
                ref={mediaRef as React.RefObject<HTMLVideoElement>}
                src={objectUrl}
                className="w-full h-full"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                onClick={togglePlay}
             />
             {/* Overlay Play Button for Video */}
             {!isPlaying && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors cursor-pointer" onClick={togglePlay}>
                     <div className="p-3 bg-white/90 rounded-full shadow-lg">
                        <PlayIcon />
                     </div>
                 </div>
             )}
        </div>
      ) : (
          <audio
            ref={mediaRef as React.RefObject<HTMLAudioElement>}
            src={objectUrl}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
          />
      )}

      {/* Controls Bar */}
      <div className="flex items-center gap-3">
        <button
            onClick={togglePlay}
            className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-sm"
        >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>

        <span className="text-xs font-mono text-slate-500 min-w-[45px] text-right">
            {formatTime(progress)}
        </span>

        <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={progress}
            onChange={handleSeek}
            className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />

        <span className="text-xs font-mono text-slate-500 min-w-[45px]">
            {formatTime(duration)}
        </span>
      </div>
    </div>
  );
};