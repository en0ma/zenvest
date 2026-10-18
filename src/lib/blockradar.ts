import "server-only";

export function blockradarConfig() {
  const key = process.env.BLOCK_RADAR_API_KEY;
  const walletId = process.env.BLOCK_RADAR_MASTER_WALLET_ID;
  if (!key || !walletId) throw new Error("Blockradar Solana wallet is not configured");
  return { key, walletId };
}

export type DedicatedAddress = { id: string; address: string; network?: string; blockchain?: { slug?: string }; indexingStatus?: string };

export async function createSolanaDepositAddress(userId: string): Promise<DedicatedAddress> {
  const { key, walletId } = blockradarConfig();
  const response = await fetch(`https://api.blockradar.co/v1/wallets/${encodeURIComponent(walletId)}/addresses`, {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ name: `Zenvest ${userId}`, metadata: { zenvestUserId: userId }, enableIndexing: true, showPrivateKey: false }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Blockradar address request failed: HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("data" in payload)) throw new Error("Malformed Blockradar response");
  const data = (payload as {data: unknown}).data;
  if (!data || typeof data !== "object") throw new Error("Missing Blockradar address");
  const address = data as Partial<DedicatedAddress>;
  if (typeof address.id !== "string" || typeof address.address !== "string" || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.address)) {
    throw new Error("Invalid Solana address in Blockradar response");
  }
  if (address.blockchain?.slug && address.blockchain.slug.toLowerCase() !== "solana") throw new Error("Unexpected deposit network");
  if (address.indexingStatus && address.indexingStatus !== "ACTIVE") throw new Error("Deposit address indexing inactive");
  return { id: address.id, address: address.address, network: address.network, blockchain: address.blockchain, indexingStatus: address.indexingStatus };
}
