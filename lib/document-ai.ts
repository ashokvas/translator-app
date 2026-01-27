import { GoogleAuth, JWT } from 'google-auth-library';

export interface DocumentAiResult {
  text: string;
  pageCount: number;
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
  const pageCount = data.document?.pages?.length || 1;

  return { text, pageCount };
}
