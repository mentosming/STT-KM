export const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

// Robust media duration fetcher
export const getMediaDuration = (file: File): Promise<number> => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    // Use Audio element for audio files, Video for others
    const media = file.type.startsWith('audio') 
        ? new Audio() 
        : document.createElement('video');
    
    media.preload = 'metadata';
    
    // Timeout to prevent hanging if metadata never loads
    const timeoutTimer = setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve(0);
    }, 4000); 

    media.onloadedmetadata = () => {
      clearTimeout(timeoutTimer);
      URL.revokeObjectURL(url);
      const duration = media.duration;
      // Handle Infinity (live streams) or NaN
      if (duration === Infinity || isNaN(duration)) {
        resolve(0);
      } else {
        resolve(duration);
      }
    };

    media.onerror = () => {
      clearTimeout(timeoutTimer);
      URL.revokeObjectURL(url);
      resolve(0);
    };

    media.src = url;
  });
};

export const splitFile = async (file: File, chunkDurationMinutes: number): Promise<File[]> => {
  // 1. Get Duration
  const duration = await getMediaDuration(file);
  
  let chunkSize = 0;

  // If duration is detected, calculate chunk size based on time
  if (duration > 0) {
      const targetSeconds = chunkDurationMinutes * 60;
      // If target duration is longer than file, return file as is
      if (targetSeconds >= duration) {
        return [file];
      }
      // Estimate byte size for the target duration
      chunkSize = Math.floor(file.size * (targetSeconds / duration));
  } else {
      // Fallback: If duration is unknown, use fixed 2MB chunks (was 10MB)
      // 2MB is safer for highly compressed formats like MP3 where 10MB could be 20+ mins
      console.warn("Duration not detected, falling back to 2MB chunks.");
      chunkSize = 2 * 1024 * 1024; 
  }

  // Safety check: ensure chunk size is at least 500KB to avoid creating too many tiny files
  // but also not larger than the file itself
  if (chunkSize < 500 * 1024) {
      chunkSize = 500 * 1024;
  }

  const chunks: File[] = [];
  let start = 0;
  let part = 1;

  // Filename parsing
  const lastDotIndex = file.name.lastIndexOf('.');
  const name = lastDotIndex !== -1 ? file.name.substring(0, lastDotIndex) : file.name;
  const ext = lastDotIndex !== -1 ? file.name.substring(lastDotIndex) : '';

  while (start < file.size) {
    const end = Math.min(start + chunkSize, file.size);
    const blobSlice = file.slice(start, end, file.type);
    
    const newFile = new File([blobSlice], `${name}_part${part}${ext}`, { type: file.type });
    
    chunks.push(newFile);
    start = end;
    part++;
  }

  return chunks;
};

// Adjust [MM:SS] timestamps in text by adding offsetSeconds
export const adjustTimestamps = (text: string, offsetSeconds: number): string => {
  if (offsetSeconds === 0) return text;
  
  return text.replace(/\[(\d{1,2}):(\d{2})\]/g, (match, p1, p2) => {
    const minutes = parseInt(p1, 10);
    const seconds = parseInt(p2, 10);
    const totalSeconds = minutes * 60 + seconds + offsetSeconds;
    
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hrs > 0) {
        return `[${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
    }
    return `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
  });
};