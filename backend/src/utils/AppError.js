// An error with an HTTP status code, e.g. throw new AppError('Not found', 404)
class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}
module.exports = AppError;
