export class AppError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'AppError';
    this.code = code;
  }
}

export function toPublicError(error) {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message };
  }

  console.error(error);
  return { code: 'internal_error', message: 'The daemon could not complete the request.' };
}
