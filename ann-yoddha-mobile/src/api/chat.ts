import { BACKEND_URL } from '../utils/constants';

export async function getChatSessions(token: string) {
  const response = await fetch(`${BACKEND_URL}/api/v1/recommendations/chat/sessions`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to fetch chat sessions');
  return response.json();
}

export async function getSessionMessages(sessionId: string, token: string) {
  const response = await fetch(`${BACKEND_URL}/api/v1/recommendations/chat/sessions/${encodeURIComponent(sessionId)}/messages`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) throw new Error('Failed to fetch chat messages');
  return response.json();
}

// React Native fetch streaming workaround
export async function streamChat(query: string, sessionId: string, token: string) {
  const response = await fetch(
    `${BACKEND_URL}/api/v1/recommendations/chat/stream?query=${encodeURIComponent(query)}&session_id=${encodeURIComponent(sessionId)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  if (!response.ok) throw new Error(`Streaming failed: ${response.status}`);
  return response;
}
