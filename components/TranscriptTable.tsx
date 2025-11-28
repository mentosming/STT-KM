import React from 'react';
import { TranscriptRow } from '../utils/transcriptUtils';

interface TranscriptTableProps {
  data: TranscriptRow[];
}

export const TranscriptTable: React.FC<TranscriptTableProps> = ({ data }) => {
  if (data.length === 0) {
      return <div className="p-4 text-center text-slate-400 text-sm">暫無資料</div>;
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="bg-slate-100 sticky top-0 z-10">
          <tr>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">時間</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">說話者</th>
            <th className="px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">內容</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-100">
          {data.map((row, index) => (
            <tr key={index} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 text-sm text-slate-500 font-mono whitespace-nowrap align-top">
                {row.time}
              </td>
              <td className="px-4 py-3 text-sm text-blue-600 font-medium whitespace-nowrap align-top">
                {row.speaker}
              </td>
              <td className="px-4 py-3 text-sm text-slate-800 align-top leading-relaxed">
                {row.content}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
