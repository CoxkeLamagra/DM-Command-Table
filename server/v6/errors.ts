export class PublicApiError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
    this.name = "PublicApiError";
  }
}

export class RequestTooLargeError extends PublicApiError {
  constructor() {
    super("The request body is too large.", 413);
    this.name = "RequestTooLargeError";
  }
}
