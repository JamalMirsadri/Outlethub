export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  public constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
}
