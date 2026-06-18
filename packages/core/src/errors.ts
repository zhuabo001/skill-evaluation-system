export class ProjectLoaderError extends Error {
  public override readonly cause: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ProjectLoaderError";
    this.cause = cause;
  }
}
