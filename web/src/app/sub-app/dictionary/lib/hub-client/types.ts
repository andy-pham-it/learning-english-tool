// ---- Protocol types (mirrors Hub-side message-types.ts) ----

export interface HubRequest {
  type: string;
  requestId: string;
  payload?: unknown;
}

export interface HubSuccessResponse<T = unknown> {
  type: string;
  requestId: string;
  ok: true;
  data: T;
}

export interface HubErrorResponse {
  type: string;
  requestId: string;
  ok: false;
  error: { code: string; message: string };
}

export type HubResponse<T = unknown> = HubSuccessResponse<T> | HubErrorResponse;

export interface HubPushEvent {
  type: string;
  requestId: null;
  payload: unknown;
}

// ---- User-facing API types ----

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  image: string | null;
}

export interface TokenResult {
  token: string;
}

export interface GetResult {
  value: unknown | null;
}

export interface PointsBalance {
  balance: number;
  currency: string;
}

export interface PointsAddResult {
  newBalance: number;
}

export interface PointsSpendResult {
  newBalance: number;
  success: boolean;
}

export interface LeaderboardEntry {
  userId: string;
  name: string;
  score: number;
  rank: number;
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  cost: number;
}

export interface ClaimRewardResult {
  reward: Reward;
  newBalance: number;
}

export interface Achievement {
  id: string;
  name: string;
  description?: string;
  unlocked: boolean;
  progress: number;
}

export interface AchievementsResult {
  achievements: Achievement[];
}

// ---- AI types ----

export interface AiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiChatRequest {
  provider: string;
  model: string;
  messages: AiChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface AiChatResponse {
  id: string;
  content: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface AiProviderInfo {
  id: string;
  name: string;
  models: string[];
}

export interface HubClientOptions {
  /** Origin of The Hub application (e.g., 'http://localhost:4200'). */
  hubOrigin: string;
  /** Per-request timeout in milliseconds (default: 10000). */
  timeout?: number;
}

export type PushEventHandler = (payload: unknown) => void;
