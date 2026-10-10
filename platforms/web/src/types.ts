export type SessionPhase =
  | 'Contract'
  | 'CheckIn'
  | 'Focus'
  | 'Explore'
  | 'Options'
  | 'Commit'
  | 'Close';

export type OperatingMode = 'Steady' | 'Explore' | 'Build' | 'Perform';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'coach';
  reflection?: string;
  inquiry?: string;
  text?: string;
  technique?: string;
  timestamp: number;
}

export interface PreScanResult {
  tier: 'Green' | 'Amber' | 'Red';
  matchedCategory?: string;
  helplineResource?: string;
}

export interface LocalModelOption {
  id: string;
  name: string;
  contextWindow: string;
  tag: string;
  description: string;
  recommended?: boolean;
}

export interface SessionState {
  currentPhase: SessionPhase;
  operatingMode: OperatingMode;
  actionConfidence: number;
  currentActionPlan: string;
  messages: ChatMessage[];
  checkoutScore?: number;
  isComplete: boolean;
  selectedModelId: string;
  disguiseMode: boolean;
  quietMode: boolean;
  panicWiped: boolean;
}
