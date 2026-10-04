// Shared wallet sign-in message contract. Client-safe.

export function getWalletSignInMessage(
  address: string,
  nonce: string,
  origin: string,
): string {
  return `Sign in to SpinChain\n\nAddress: ${address.toLowerCase()}\nOrigin: ${origin}\nNonce: ${nonce}`;
}
