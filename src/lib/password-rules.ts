// The password length rule, importable from the browser as well as the server.
// Kept apart from password-policy.ts, which needs Node's crypto, so the form
// that shows the rule and the route that enforces it can never disagree.
export const MIN_PASSWORD_LENGTH = 10
