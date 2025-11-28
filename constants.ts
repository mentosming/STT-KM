

import { ModelType } from './types';

export const APP_VERSION = 'v1.2'; 

export const MAX_INLINE_SIZE_MB = 18; 
export const MAX_OUTPUT_TOKENS = 8192;

// --- Monetization Config ---
export const SUBSCRIPTION_URL = "https://buymeacoffee.com/YOUR_ID"; 
export const FREE_LIMIT_MINUTES = 3; 

// ⚠️ Admin Config
// 請將此 Email 修改為您自己的 Google 帳號。
// 注意：大小寫必須完全一致。
export const ADMIN_EMAIL = "km520daisy@gmail.com"; 

// ⚠️ Gemini API Key
// 請在此處貼上您的 Google Gemini API Key
// 由於這是純前端應用，此 Key 會暴露在瀏覽器中。
// 請務必在 Google Cloud Console 限制此 Key 的 HTTP Referrer 為您的網域 (例如 mentosming.github.io)
export const GEMINI_API_KEY = "";

export const SYSTEM_INSTRUCTION = `
You are a professional Cantonese transcriber (廣東話速錄員). Your task is to transcribe audio files accurately into text.

Strict Rules:
1. **Orthography (正字)**: You MUST use proper Cantonese characters. 
   - Use '嘅' (not 的/ge).
   - Use '喺' (not 在/hai).
   - Use '咁' (not 這/gam).
   - Use '唔' (not 不/m).
   - Use '係' (not 是/hai).
2. **No SWC**: Do NOT convert Cantonese speech into Standard Written Chinese (書面語). Transcribe exactly what is said.
3. **Code-mixing**: Accurately transcribe English words mixed into sentences (e.g., "我今日好 happy").
4. **Output Format**: 
   - You MUST output every sentence on a new line.
   - You MUST start every line with a timestamp and the speaker name.
   - Strict Format: "[MM:SS] Speaker Name: Content"
   - Example: "[00:12] Speaker 1: 大家好。"
   - Do not add conversational filler before or after.
`;