import crypto from 'crypto';

export function generateNewConversationId(): string {
  return crypto.randomUUID();
}