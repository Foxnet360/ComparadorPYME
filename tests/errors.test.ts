import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  NotFoundError,
} from '../server/src/errors';

describe('Custom Error Classes', () => {
  it('AppError should have correct properties', () => {
    const error = new AppError('Test error', 500);
    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(500);
    expect(error.isOperational).toBe(true);
  });

  it('ValidationError should have status 400 and details', () => {
    const details = [{ field: 'email', message: 'Invalid email' }];
    const error = new ValidationError('Validation failed', details);
    expect(error.statusCode).toBe(400);
    expect(error.details).toEqual(details);
    expect(error.message).toBe('Validation failed');
  });

  it('AuthenticationError should have status 401', () => {
    const error = new AuthenticationError();
    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Authentication required');
  });

  it('AuthenticationError should accept custom message', () => {
    const error = new AuthenticationError('Token expired');
    expect(error.message).toBe('Token expired');
  });

  it('AuthorizationError should have status 403', () => {
    const error = new AuthorizationError();
    expect(error.statusCode).toBe(403);
    expect(error.message).toBe('Access denied');
  });

  it('RateLimitError should have status 429 and retryAfter', () => {
    const error = new RateLimitError('Too many requests', 60);
    expect(error.statusCode).toBe(429);
    expect(error.retryAfter).toBe(60);
    expect(error.message).toBe('Too many requests');
  });

  it('RateLimitError should have default retryAfter of 60', () => {
    const error = new RateLimitError();
    expect(error.retryAfter).toBe(60);
  });

  it('NotFoundError should have status 404', () => {
    const error = new NotFoundError();
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Resource not found');
  });

  it('should capture stack trace', () => {
    const error = new AppError('Test', 500);
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('Error: Test');
  });
});
