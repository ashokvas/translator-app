import { GoogleAuth, JWT } from 'google-auth-library';

export interface DocumentAiResult {
  text: string;
  pageCount: number;
  tables?: DocumentAiTable[];
}

export interface DocumentAiTable {
  startIndex?: number;
  endIndex?: number;
  headers: string[];
  rows: string[][];
  rawText?: string;
}

function getDocumentAiConfig() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
  const location = process.env.GOOGLE_DOCUMENT_AI_LOCATION || 'us';
  const processorId = process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID;

  if (!projectId || !processorId) {
    throw new Error(
      'Document AI is not configured. Set GOOGLE_CLOUD_PROJECT_ID and GOOGLE_DOCUMENT_AI_PROCESSOR_ID.'
    );
  }

  return { projectId, location, processorId };
}

type TextAnchorSegment = { startIndex?: string | number; endIndex?: string | number };

function getTextFromSegments(text: string, segments: TextAnchorSegment[] = []) {
  if (!text || segments.length === 0) return '';
  const parts: string[] = [];

  for (const segment of segments) {
    const start = Number(segment.startIndex ?? 0);
    const end = Number(segment.endIndex ?? 0);
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
      parts.push(text.slice(start, end));
    }
  }

  return parts.join('').replace(/\s+/g, ' ').trim();
}

function getTableRange(segments: TextAnchorSegment[] = []) {
  const indices = segments
    .map((segment) => ({
      start: Number(segment.startIndex ?? 0),
      end: Number(segment.endIndex ?? 0),
    }))
    .filter((entry) => Number.isFinite(entry.start) && Number.isFinite(entry.end) && entry.end > entry.start);

  if (indices.length === 0) return {};
  const startIndex = Math.min(...indices.map((entry) => entry.start));
  const endIndex = Math.max(...indices.map((entry) => entry.end));
  return { startIndex, endIndex };
}

function extractTables(documentText: string, pages: Array<any> = []): DocumentAiTable[] {
  const tables: DocumentAiTable[] = [];

  for (const page of pages) {
    const pageTables = Array.isArray(page?.tables) ? page.tables : [];
    for (const table of pageTables) {
      const headerRows = Array.isArray(table?.headerRows) ? table.headerRows : [];
      const bodyRows = Array.isArray(table?.bodyRows) ? table.bodyRows : [];
      const tableSegments = table?.layout?.textAnchor?.textSegments;
      const tableRange = getTableRange(tableSegments);

      const headers = headerRows
        .flatMap((row: any) => row?.cells || [])
        .map((cell: any) => getTextFromSegments(documentText, cell?.layout?.textAnchor?.textSegments));

      const rows = bodyRows.map((row: any) =>
        (row?.cells || []).map((cell: any) =>
          getTextFromSegments(documentText, cell?.layout?.textAnchor?.textSegments)
        )
      );

      if (headers.length === 0 && rows.length === 0) continue;

      let rawText: string | undefined;
      if (typeof tableRange.startIndex === 'number' && typeof tableRange.endIndex === 'number') {
        rawText = documentText.slice(tableRange.startIndex, tableRange.endIndex).trim();
      }

      tables.push({
        headers,
        rows,
        rawText,
        ...tableRange,
      });
    }
  }

  return tables;
}

async function getAccessToken(): Promise<string> {
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFile) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS is not set.');
  }
  const client = new JWT({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  await client.authorize();
  const token = client.credentials.access_token;
  if (!token) {
    throw new Error('Failed to obtain Google Cloud access token for Document AI.');
  }
  return `Bearer ${token}`;
}

export async function performDocumentAiOcr(
  buffer: Buffer,
  mimeType: string
): Promise<DocumentAiResult> {
  const { projectId, location, processorId } = getDocumentAiConfig();
  const authHeader = await getAccessToken();

  const endpoint = `https://${location}-documentai.googleapis.com/v1/projects/${projectId}/locations/${location}/processors/${processorId}:process`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      rawDocument: {
        content: buffer.toString('base64'),
        mimeType,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Document AI error: ${errorText}`);
  }

  const data = (await response.json()) as {
    document?: { text?: string; pages?: Array<unknown> };
  };

  const text = String(data.document?.text || '').trim();
  const pages = data.document?.pages || [];
  const pageCount = pages.length || 1;
  const tables = extractTables(text, pages as Array<any>);

  return { text, pageCount, tables };
}
