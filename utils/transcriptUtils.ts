
export interface TranscriptRow {
  time: string;
  speaker: string;
  content: string;
}

export const parseTranscript = (text: string): TranscriptRow[] => {
  const lines = text.split('\n');
  const rows: TranscriptRow[] = [];
  
  // Regex to match: [MM:SS] Speaker: Content
  // Captures: 1=Time, 2=Speaker, 3=Content
  // Handles variations where speaker might be missing colon or spacing varies
  const regex = /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*([^:]+?)\s*:\s*(.+)$/;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const match = trimmed.match(regex);
    if (match) {
      rows.push({
        time: match[1],
        speaker: match[2].trim(),
        content: match[3].trim()
      });
    } else {
        // Fallback: If line doesn't match format (e.g. continuation), append to previous content
        // or if it's a timestamped line without speaker: [MM:SS] Content
        const timeOnlyRegex = /^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.+)$/;
        const timeMatch = trimmed.match(timeOnlyRegex);

        if (timeMatch) {
             rows.push({
                time: timeMatch[1],
                speaker: '-', // No speaker identified
                content: timeMatch[2].trim()
            });
        } else if (rows.length > 0) {
            // Append to previous row if it looks like continued speech
            rows[rows.length - 1].content += " " + trimmed;
        }
    }
  });
  return rows;
}

export const convertToCSV = (rows: TranscriptRow[]) => {
    // Add BOM for Excel compatibility with UTF-8
    const BOM = "\uFEFF";
    const header = "時間,說話者,內容\n";
    const body = rows.map(r => {
        // Escape quotes by doubling them
        const time = `"${r.time}"`;
        const speaker = `"${r.speaker.replace(/"/g, '""')}"`;
        const content = `"${r.content.replace(/"/g, '""')}"`;
        return `${time},${speaker},${content}`;
    }).join("\n");
    
    return BOM + header + body;
}
