// Walrus Storage Types
// Decentralized blob storage for 3D assets and raw biometric logs

export interface WalrusBlob {
  id: string;
  data: Uint8Array;
  contentType: string;
  size: number;
  timestamp: number;
  owner: string;
}

export interface StorageConfig {
  // Walrus aggregator nodes
  aggregators: string[];
  
  // Storage epochs (how long data persists)
  epochs: number;
  
  // Redundancy level
  redundancy: 'low' | 'medium' | 'high';
}

export const DEFAULT_STORAGE_CONFIG: StorageConfig = {
  aggregators: [
    'https://aggregator.walrus-testnet.walrus.space',
    'https://aggregator2.walrus-testnet.walrus.space',
  ],
  epochs: 30, // ~30 days
  redundancy: 'medium',
};

// Asset types we store
export type AssetType = 'gpx_route' | '3d_world' | 'biometric_log' | 'proof_card' | 'telemetry' | 'ai_route';

export interface StoredAsset {
  blobId: string;
  assetType: AssetType;
  metadata: {
    name: string;
    description?: string;
    createdAt: number;
    owner: string;
    classId?: string;
    sessionId?: string;
  };
  urls: {
    primary: string;
    mirrors: string[];
  };
}

// Storage operation results
export interface StoreResult {
  success: boolean;
  blobId?: string;
  error?: string;
  urls?: {
    primary: string;
    walrusUri: string;
  };
}

export interface RetrieveResult {
  success: boolean;
  data?: Uint8Array;
  error?: string;
}
