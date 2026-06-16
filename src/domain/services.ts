/**
 * The closed set of services in the fictional PaaS. This is the correlating key
 * shared verbatim across deploys and logs, so it lives in exactly one place.
 * Ids are kebab-case and used as-is everywhere.
 */
export const SERVICES = [
  "api-gateway",
  "api",
  "postgres",
  "redis",
  "auth-service",
  "email-service",
] as const;

export type Service = (typeof SERVICES)[number];

const serviceSet = new Set<string>(SERVICES);

/** Type guard: is the given string one of the known services? */
export function isService(value: string): value is Service {
  return serviceSet.has(value);
}
