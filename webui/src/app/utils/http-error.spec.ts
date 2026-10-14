import { HttpErrorResponse } from '@angular/common/http';
import { describeError } from './http-error';

const failure = (status: number, error: unknown): HttpErrorResponse => new HttpErrorResponse({ status, error });

describe('describeError', () => {
  it('returns the fallback for errors that are not HTTP responses', () => {
    expect(describeError(new Error('boom'), 'fallback')).toBe('fallback');
    expect(describeError(null, 'fallback')).toBe('fallback');
    expect(describeError('text', 'fallback')).toBe('fallback');
  });

  it('uses a generic default message when no fallback is given', () => {
    expect(describeError(new Error('boom'))).toBe('Something went wrong. Please try again.');
  });

  it('reports an unreachable server for status 0', () => {
    expect(describeError(failure(0, new ProgressEvent('error')), 'fallback')).toContain('Unable to reach the server');
  });

  it('hides server error details behind the fallback', () => {
    expect(describeError(failure(500, { title: 'Internal Server Error', detail: 'stack trace' }), 'fallback')).toBe('fallback');
    expect(describeError(failure(503, 'Service Unavailable'), 'fallback')).toBe('fallback');
    expect(describeError(failure(502, '<html>bad gateway</html>'), 'fallback')).toBe('fallback');
  });

  it('returns a short plain-text body trimmed', () => {
    expect(describeError(failure(400, '  Email already in use  '), 'fallback')).toBe('Email already in use');
  });

  it('rejects html, empty and oversized plain-text bodies', () => {
    expect(describeError(failure(400, '<!DOCTYPE html><html></html>'), 'fallback')).toBe('fallback');
    expect(describeError(failure(400, '   '), 'fallback')).toBe('fallback');
    expect(describeError(failure(400, 'x'.repeat(201)), 'fallback')).toBe('fallback');
    expect(describeError(failure(400, 'x'.repeat(200)), 'fallback')).toBe('x'.repeat(200));
  });

  it('prefers the first validation error over detail and title', () => {
    const body = {
      title: 'One or more validation errors occurred.',
      detail: 'ignored',
      errors: { Body: ['The Body field is required.'], Type: ['The Type field is required.'] }
    };
    expect(describeError(failure(400, body), 'fallback')).toBe('The Body field is required.');
  });

  it('skips unreadable validation entries', () => {
    const body = { errors: { Body: [42, '<b>markup</b>'], Type: ['Type is required'] } };
    expect(describeError(failure(400, body), 'fallback')).toBe('Type is required');
  });

  it('uses the problem detail, then the title', () => {
    expect(describeError(failure(409, { title: 'Conflict', detail: 'Email already in use' }), 'fallback')).toBe('Email already in use');
    expect(describeError(failure(415, { title: 'Unsupported Media Type' }), 'fallback')).toBe('Unsupported Media Type');
  });

  it('falls back when the body has nothing readable', () => {
    expect(describeError(failure(400, {}), 'fallback')).toBe('fallback');
    expect(describeError(failure(404, null), 'fallback')).toBe('fallback');
    expect(describeError(failure(400, { detail: 12, title: '' }), 'fallback')).toBe('fallback');
  });
});
