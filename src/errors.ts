export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ParseError';
  }
}

export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    body: string,
  ) {
    super(message);
    this.name = 'ServiceError';
    // Store body as non-enumerable so it won't appear in JSON.stringify
    Object.defineProperty(this, '_body', { value: body, enumerable: false, writable: false });
  }

  /** Access the truncated response body for debugging. Not included in JSON serialization. */
  getDebugBody(): string {
    return (this as unknown as { _body: string })._body;
  }
}
