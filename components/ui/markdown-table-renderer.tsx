'use client';

import React from 'react';

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

/**
 * Parse markdown table from lines
 */
function parseMarkdownTable(lines: string[]): ParsedTable | null {
  if (lines.length < 2) return null;
  
  // Check if first line looks like a table header (starts and ends with |)
  const headerLine = lines[0].trim();
  if (!headerLine.startsWith('|') || !headerLine.endsWith('|')) return null;
  
  // Check if second line is separator (contains |---| pattern)
  const separatorLine = lines[1].trim();
  if (!separatorLine.match(/^\|[-:\s|]+\|$/)) return null;
  
  // Parse header
  const headers = headerLine
    .split('|')
    .slice(1, -1) // Remove empty strings from start/end
    .map(h => h.trim());
  
  if (headers.length === 0) return null;
  
  // Parse data rows
  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const rowLine = lines[i].trim();
    if (!rowLine.startsWith('|')) break; // End of table
    
    const cells = rowLine
      .split('|')
      .slice(1, -1)
      .map(c => c.trim());
    
    // Ensure row has same number of columns as header
    while (cells.length < headers.length) {
      cells.push('');
    }
    
    rows.push(cells.slice(0, headers.length));
  }
  
  return { headers, rows };
}

/**
 * Split text into table blocks and text blocks
 */
function splitIntoBlocks(text: string): Array<{ type: 'text' | 'table'; content: string; table?: ParsedTable }> {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: Array<{ type: 'text' | 'table'; content: string; table?: ParsedTable }> = [];
  
  let i = 0;
  let currentTextLines: string[] = [];
  
  while (i < lines.length) {
    const line = lines[i];
    
    // Check if this is the start of a markdown table
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      // Save any accumulated text
      if (currentTextLines.length > 0) {
        blocks.push({ type: 'text', content: currentTextLines.join('\n') });
        currentTextLines = [];
      }
      
      // Collect all consecutive table lines
      const tableLines: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].trim().startsWith('|')) {
        tableLines.push(lines[j]);
        j++;
      }
      
      // Try to parse as markdown table
      const tableData = parseMarkdownTable(tableLines);
      if (tableData && tableData.rows.length > 0) {
        blocks.push({ type: 'table', content: tableLines.join('\n'), table: tableData });
        i = j;
        continue;
      }
    }
    
    // Regular text line
    currentTextLines.push(line);
    i++;
  }
  
  // Save any remaining text
  if (currentTextLines.length > 0) {
    blocks.push({ type: 'text', content: currentTextLines.join('\n') });
  }
  
  return blocks;
}

interface MarkdownTableRendererProps {
  text: string;
  className?: string;
}

/**
 * Renders text with markdown tables as proper HTML tables with borders
 */
export function MarkdownTableRenderer({ text, className = '' }: MarkdownTableRendererProps) {
  const blocks = splitIntoBlocks(text);
  
  return (
    <div className={className}>
      {blocks.map((block, blockIndex) => {
        if (block.type === 'table' && block.table) {
          return (
            <div key={blockIndex} className="my-3 overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-400">
                <thead>
                  <tr className="bg-gray-100">
                    {block.table.headers.map((header, i) => (
                      <th
                        key={i}
                        className="border border-gray-400 px-3 py-2 text-left text-sm font-bold text-gray-900"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.table.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      {row.map((cell, cellIndex) => (
                        <td
                          key={cellIndex}
                          className="border border-gray-400 px-3 py-2 text-sm text-gray-900"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        
        // Regular text block
        return (
          <p key={blockIndex} className="text-sm text-gray-900 whitespace-pre-wrap">
            {block.content}
          </p>
        );
      })}
    </div>
  );
}

