export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface FeedbackResult {
  CursorGood: string;
  images: string[];
}

export interface Session {
  id: string;
  write: (event: string, data: string) => void;
}

export interface PendingCall {
  sessionId: string;
  rpcId: string | number | null;
  resolve: (result: FeedbackResult) => void;
}

export interface ActivePrompt {
  callId:      string;
  message:     string;
  options:     string[];
  iconDataUrl: string;
}

export interface ChatMessage {
  role:     'ai' | 'user';
  text:     string;
  options?: string[];
  images?:  string[];
  callId?:  string;
  ts:       number;
}
