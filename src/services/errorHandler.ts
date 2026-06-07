/**
 * Error Handling Utilities
 * Convert silent failures to user-friendly error messages
 */

type OperationType = 'creating' | 'reading' | 'updating' | 'deleting' | 'processing';

export interface UserFriendlyError {
  title: string;
  message: string;
  actionItems?: string[];
}

/**
 * Convert Firestore errors to user-friendly messages
 */
export function handleFirestoreErrorUser(error: unknown, operation: OperationType, context: string): UserFriendlyError {
  const err = error as any;
  const errorMessage = err?.message || String(error);

  const errorMap: Record<string, UserFriendlyError> = {
    'permission-denied': {
      title: 'Access Denied',
      message: 'You do not have permission to perform this action. Contact your administrator if you believe this is incorrect.',
      actionItems: ['Check your user role', 'Contact system administrator'],
    },
    'not-found': {
      title: 'Data Not Found',
      message: `The ${context} you are trying to access no longer exists or has been deleted.`,
      actionItems: ['Refresh the page', 'Try again with different data'],
    },
    'already-exists': {
      title: 'Data Already Exists',
      message: `A ${context} with this information already exists in the system.`,
      actionItems: ['Use a different value', 'Check existing entries'],
    },
    'failed-precondition': {
      title: 'Operation Failed',
      message: `Cannot perform this operation. The ${context} may have been modified by another user.`,
      actionItems: ['Refresh and try again', 'Check if data was modified'],
    },
    'unauthenticated': {
      title: 'Session Expired',
      message: 'Your session has expired. Please log in again.',
      actionItems: ['Log out and log back in'],
    },
    'resource-exhausted': {
      title: 'Operation Too Frequent',
      message: 'Too many requests. Please wait a moment and try again.',
      actionItems: ['Wait 30 seconds', 'Try again'],
    },
    'invalid-argument': {
      title: 'Invalid Data',
      message: `The ${context} data is invalid. Please review your input and try again.`,
      actionItems: ['Check all required fields', 'Verify data format'],
    },
    'internal': {
      title: 'Server Error',
      message: 'An unexpected server error occurred. Please try again later.',
      actionItems: ['Refresh the page', 'Try again in a few minutes', 'Contact support if problem persists'],
    },
    'network-error': {
      title: 'Connection Error',
      message: 'Unable to connect to the server. Please check your internet connection.',
      actionItems: ['Check your internet connection', 'Try again'],
    },
  };

  // Try to find matching error type
  for (const [key, userError] of Object.entries(errorMap)) {
    if (errorMessage.toLowerCase().includes(key)) {
      return userError;
    }
  }

  // Default error
  return {
    title: 'Operation Failed',
    message: `An error occurred while ${operation} ${context}: ${errorMessage}`,
    actionItems: ['Try again', 'Refresh the page', 'Contact support if problem persists'],
  };
}

/**
 * Handle API/Backend errors
 */
export function handleApiErrorUser(error: unknown, operation: string): UserFriendlyError {
  const err = error as any;
  const status = err?.status || 500;
  const errorMessage = err?.message || String(error);

  const statusMap: Record<number, UserFriendlyError> = {
    400: {
      title: 'Invalid Request',
      message: `The request was invalid. ${errorMessage}`,
      actionItems: ['Check your input', 'Review required fields'],
    },
    401: {
      title: 'Unauthorized',
      message: 'You are not authorized to perform this action.',
      actionItems: ['Log in again', 'Contact administrator'],
    },
    403: {
      title: 'Access Forbidden ',
      message: 'You do not have permission for this operation.',
      actionItems: ['Check your permissions', 'Contact administrator'],
    },
    404: {
      title: 'Not Found',
      message: 'The requested resource could not be found.',
      actionItems: ['Verify the information', 'Try again'],
    },
    408: {
      title: 'Request Timeout',
      message: 'The request took too long. Please try again.',
      actionItems: ['Try again', 'Check your connection'],
    },
    409: {
      title: 'Conflict',
      message: 'The data conflicts with existing information.',
      actionItems: ['Refresh and try again', 'Check for duplicates'],
    },
    429: {
      title: 'Too Many Requests',
      message: 'You are making requests too quickly. Please wait a moment.',
      actionItems: ['Wait 30 seconds', 'Try again'],
    },
    500: {
      title: 'Server Error',
      message: 'An unexpected server error occurred. Please try again later.',
      actionItems: ['Try again', 'Contact support'],
    },
    503: {
      title: 'Service Unavailable',
      message: 'The service is temporarily unavailable. Please try again later.',
      actionItems: ['Try again in a few minutes', 'Contact support'],
    },
  };

  return statusMap[status] || {
    title: 'Operation Failed',
    message: `Failed to ${operation}: ${errorMessage}`,
    actionItems: ['Try again', 'Contact support if problem persists'],
  };
}

/**
 * Validation error to user-friendly format
 */
export function formatValidationErrorsForUser(errors: string[]): string {
  if (errors.length === 0) return '';
  
  if (errors.length === 1) {
    return errors[0];
  }

  // Group errors nicely
  const grouped = errors.map((e, i) => `${i + 1}. ${e}`).join('\n');
  return `Please fix the following issues:\n\n${grouped}`;
}
