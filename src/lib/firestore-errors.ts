export const OperationType = {
  GET: 'GET',
  LIST: 'LIST',
  WRITE: 'WRITE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
} as const;

export type OperationType = typeof OperationType[keyof typeof OperationType];

export function handleFirestoreError(
  error: any,
  operation: OperationType,
  path?: string
) {
  if (
    error?.code === 'unavailable' || 
    error?.message?.includes('Could not reach Cloud Firestore backend') ||
    error?.message?.includes('offline')
  ) {
    console.warn(`[Firestore Offline/Reconnecting - ${operation}] Path: ${path || 'unknown'} - Client operating in offline mode.`);
    return;
  }
  console.warn(`[Firestore Error - ${operation}] Path: ${path || 'unknown'}`, error);
}

