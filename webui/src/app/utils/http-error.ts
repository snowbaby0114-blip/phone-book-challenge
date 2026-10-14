import { HttpErrorResponse } from '@angular/common/http';

const DEFAULT_MESSAGE = 'Something went wrong. Please try again.';
const UNREACHABLE_MESSAGE = 'Unable to reach the server. Check your connection and try again.';
const MAX_MESSAGE_LENGTH = 200;

function readableMessage(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const text = value.trim();
  return text && text.length <= MAX_MESSAGE_LENGTH && !text.startsWith('<') ? text : null;
}

export function describeError(error: unknown, fallback: string = DEFAULT_MESSAGE): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }
  if (error.status === 0) {
    return UNREACHABLE_MESSAGE;
  }
  if (error.status >= 500) {
    return fallback;
  }

  const body: unknown = error.error;
  const plainText = readableMessage(body);
  if (plainText) {
    return plainText;
  }
  if (body && typeof body === 'object') {
    const problem = body as { detail?: unknown; title?: unknown; errors?: Record<string, unknown> };
    const validation = problem.errors ? Object.values(problem.errors).flat() : [];
    return (
      validation.map(readableMessage).find(message => message !== null) ??
      readableMessage(problem.detail) ??
      readableMessage(problem.title) ??
      fallback
    );
  }
  return fallback;
}
