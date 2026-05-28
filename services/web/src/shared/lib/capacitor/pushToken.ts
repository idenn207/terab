let _pushToken: string | null = null;

export function setPushToken(token: string): void {
  _pushToken = token;
}

export function getPushToken(): string | null {
  return _pushToken;
}

export function clearPushToken(): void {
  _pushToken = null;
}
