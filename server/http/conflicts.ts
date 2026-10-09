export class RevisionConflictError extends Error {
  readonly resourceType: string;
  readonly resourceId: string;
  readonly expectedRevision: number;
  readonly actualRevision: number | null;

  constructor(
    resourceType: string,
    resourceId: string,
    expectedRevision: number,
    actualRevision: number | null,
  ) {
    super(
      `${resourceType} ${resourceId} changed after revision ${expectedRevision}.`,
    );
    this.name = "RevisionConflictError";
    this.resourceType = resourceType;
    this.resourceId = resourceId;
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export class ResourceNotFoundError extends Error {
  readonly resourceType: string;
  readonly resourceId: string;

  constructor(resourceType: string, resourceId: string) {
    super(`${resourceType} ${resourceId} was not found.`);
    this.name = "ResourceNotFoundError";
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}
