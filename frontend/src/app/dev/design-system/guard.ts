export function isDesignSystemShowcaseEnabled(environment = process.env.NODE_ENV) {
  return environment === "development" || environment === "test";
}
