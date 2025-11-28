import { GoogleGenAI, HarmCategory, HarmBlockThreshold, GenerateContentResponse } from "@google/genai";
import { TranscriptionSettings } from "../types";
import { MAX_INLINE_SIZE_MB, MAX_OUTPUT_TOKENS, SYSTEM_INSTRUCTION, GEMINI_API_KEY } from "../constants";

// Helper to convert Blob to Base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

interface StreamCallbacks {
  onProgress: (chunkText: string) => void;
  onStatusChange: (status: string) => void;
}

// Helper to race stream against timeout
async function* streamWithTimeout<T>(stream: AsyncIterable<T>, timeoutMs: number): AsyncIterable<T> {
  let timeoutId: any;
  const iterator = stream[Symbol.asyncIterator]();
  
  while (true) {
    const result = await Promise.race([
      iterator.next(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("連線逾時 (60秒無回應)，請檢查網絡或嘗試分割檔案")), timeoutMs);
      })
    ]);
    
    clearTimeout(timeoutId);
    
    if (result.done) break;
    yield result.value;
  }
}

export const transcribeMedia = async (
  file: File,
  settings: TranscriptionSettings,
  callbacks: StreamCallbacks,
  signal: AbortSignal
) => {
  // Use the key from constants.ts
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes("在此處貼上")) {
      throw new Error("請在 constants.ts 中設定 GEMINI_API_KEY");
  }
  
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // 1. Construct the Prompt
  let promptText = "Transcribe the following audio/video file verbatim in Cantonese.";
  
  if (settings.timestamps) {
    promptText += " Insert a timestamp [MM:SS] at the beginning of each new sentence or distinct segment.";
  }

  if (settings.identifySpeakers) {
    promptText += " Identify different speakers.";
    const validSpeakers = settings.speakerNames.filter(n => n.trim() !== "");
    if (validSpeakers.length > 0) {
      promptText += ` The speakers are likely: ${validSpeakers.join(', ')}. Label them accordingly if recognized.`;
    } else {
      promptText += " Label them as Speaker 1, Speaker 2, etc.";
    }
  }

  // 2. Prepare Content
  let contentPart: any;
  const fileSizeMB = file.size / (1024 * 1024);

  try {
    if (fileSizeMB < MAX_INLINE_SIZE_MB) {
      // Small File: Inline Base64
      callbacks.onStatusChange("正在本機處理...");
      const base64Data = await blobToBase64(file);
      contentPart = {
        inlineData: {
          mimeType: file.type,
          data: base64Data,
        },
      };
    } else {
      // Large File: Upload via File API
      callbacks.onStatusChange("正在上載至 Gemini (大檔案)...");
      
      const uploadResponse = await ai.files.upload({
        file: file,
        config: { mimeType: file.type }
      });
      
      // Fix: Access file metadata from the response directly
      const uploadedFile = uploadResponse;
      const fileUri = uploadedFile.uri;
      const fileName = uploadedFile.name;
      
      // Poll for active state
      let fileState = uploadedFile.state;
      let startTime = Date.now();
      const MAX_POLL_TIME = 5 * 60 * 1000; // 5 mins max wait

      while (fileState === 'PROCESSING') {
         if (signal.aborted) throw new Error("Aborted by user");
         
         if (Date.now() - startTime > MAX_POLL_TIME) {
             throw new Error("檔案處理逾時 (超過5分鐘)");
         }

         callbacks.onStatusChange("伺服器處理檔案中...");
         await new Promise(resolve => setTimeout(resolve, 2000));
         
         const fileStatus = await ai.files.get({ name: fileName });
         fileState = fileStatus.state;
         
         if (fileState === 'FAILED') throw new Error("File processing failed on Gemini server.");
      }

      contentPart = {
        fileData: {
          fileUri: fileUri,
          mimeType: file.type,
        },
      };
    }

    // 3. Generate Stream
    callbacks.onStatusChange("正在轉錄...");
    
    // Safety Settings to Block None to prevent cutting off colloquial speech
    const safetySettings = [
      { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
      { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
    ];

    const responseStream = await ai.models.generateContentStream({
      model: settings.model,
      contents: [
        { role: 'user', parts: [contentPart, { text: promptText }] }
      ],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        safetySettings: safetySettings,
      }
    });

    // Use watchdog wrapper to throw if stream hangs
    const safeStream = streamWithTimeout(responseStream, 60000); // 60s timeout

    for await (const chunk of safeStream) {
      if (signal.aborted) {
        throw new Error("Aborted by user");
      }
      const responseChunk = chunk as GenerateContentResponse;
      const text = responseChunk.text; 
      if (text) {
        callbacks.onProgress(text);
      }
    }

  } catch (error: any) {
    if (signal.aborted) return; // Ignore errors if aborted
    console.error("Gemini Service Error:", error);
    throw error;
  }
};