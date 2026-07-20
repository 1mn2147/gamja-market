import { randomUUID } from "node:crypto";

export const uniqueId = (prefix: string) => `${prefix}-${randomUUID()}`;
