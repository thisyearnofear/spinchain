// Walrus Storage Client
// DRY: Single client for all Walrus operations

import type {
  WalrusBlob,
  StorageConfig,
  AssetType,
  StoredAsset,
  StoreResult,
  RetrieveResult,
} from './types';
import { DEFAULT_STORAGE_CONFIG } from './types';

// Walrus HTTP API client
export class WalrusClient {
  private config: StorageConfig;
  private currentAggregator: number = 0;
  
  constructor(config: Partial<StorageConfig> = {}) {
    this.config = { ...DEFAULT_STORAGE_CONFIG, ...config };
  }
  
  private get aggregator(): string {
    return this.config.aggregators[this.currentAggregator];
  }
  
  private rotateAggregator(): void {
    this.currentAggregator = (this.currentAggregator + 1) % this.config.aggregators.length;
  }
  
  // Store a blob on Walrus
  async store(
    data: Uint8Array | string,
    contentType: string = 'application/octet-stream',
    epochs: number = this.config.epochs
  ): Promise<StoreResult> {
    const body = typeof data === 'string' ? data : Buffer.from(data);
    
    // Try each aggregator
    for (let i = 0; i < this.config.aggregators.length; i++) {
      try {
        const response = await fetch(`${this.aggregator}/v1/store`, {
          method: 'PUT',
          headers: {
            'Content-Type': contentType,
          },
          body: body as BodyInit,
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        // NewlyCreated or AlreadyCertified
        const blobId = result.newlyCreated?.blobObject?.blobId || 
                       result.alreadyCertified?.blobId;
        
        if (blobId) {
          return {
            success: true,
            blobId,
            urls: {
              primary: `${this.aggregator}/v1/${blobId}`,
              walrusUri: `walrus://${blobId}`,
            },
          };
        }
        
        throw new Error('Invalid response format');
      } catch (error) {
        console.warn(`Aggregator ${this.aggregator} failed:`, error);
        this.rotateAggregator();
      }
    }
    
    return {
      success: false,
      error: 'All aggregators failed',
    };
  }
  
  // Retrieve a blob from Walrus
  async retrieve(blobId: string): Promise<RetrieveResult> {
    for (let i = 0; i < this.config.aggregators.length; i++) {
      try {
        const response = await fetch(`${this.aggregator}/v1/${blobId}`);
        
        if (!response.ok) {
          if (response.status === 404) {
            return { success: false, error: 'Blob not found' };
          }
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = new Uint8Array(await response.arrayBuffer());
        return { success: true, data };
      } catch (error) {
        console.warn(`Aggregator ${this.aggregator} failed:`, error);
        this.rotateAggregator();
      }
    }
    
    return { success: false, error: 'All aggregators failed' };
  }
  
  // Store JSON data
  async storeJSON<T>(data: T, epochs?: number): Promise<StoreResult> {
    const json = JSON.stringify(data);
    return this.store(json, 'application/json', epochs);
  }
  
  // Retrieve and parse JSON
  async retrieveJSON<T>(blobId: string): Promise<{ success: false; error: string } | { success: true; data: T }> {
    const result = await this.retrieve(blobId);
    
    if (!result.success || !result.data) {
      return { success: false, error: result.error || 'Unknown error' };
    }
    
    try {
      const text = new TextDecoder().decode(result.data);
      const data = JSON.parse(text) as T;
      return { success: true, data };
    } catch (error) {
      return { success: false, error: 'Failed to parse JSON' };
    }
  }
}

// Asset manager for domain-specific storage
export class AssetManager {
  private client: WalrusClient;
  
  constructor(client?: WalrusClient) {
    this.client = client || new WalrusClient();
  }
  
  // Store a 3D world asset
  async storeWorld(
    worldData: object,
    metadata: {
      name: string;
      classId?: string;
      owner: string;
    }
  ): Promise<StoredAsset | null> {
    const asset = {
      type: '3d_world' as AssetType,
      data: worldData,
      metadata: {
        ...metadata,
        createdAt: Date.now(),
      },
    };
    
    const result = await this.client.storeJSON(asset);
    
    if (!result.success || !result.blobId) {
      return null;
    }
    
    return {
      blobId: result.blobId,
      assetType: '3d_world',
      metadata: asset.metadata,
      urls: {
        primary: result.urls!.primary,
        mirrors: [],
      },
    };
  }
  
  // Store raw biometric telemetry
  async storeTelemetry(
    telemetry: {
      heartRate: number[];
      power: number[];
      cadence: number[];
      timestamps: number[];
    },
    metadata: {
      sessionId: string;
      riderId: string;
      classId: string;
    }
  ): Promise<StoredAsset | null> {
    // Compress telemetry data
    const compressed = this.compressTelemetry(telemetry);
    
    const asset = {
      type: 'telemetry' as AssetType,
      data: compressed,
      metadata: {
        name: `Telemetry-${metadata.sessionId}`,
        ...metadata,
        createdAt: Date.now(),
        owner: metadata.riderId,
        dataPoints: telemetry.timestamps.length,
      },
    };
    
    const result = await this.client.storeJSON(asset);
    
    if (!result.success || !result.blobId) {
      return null;
    }
    
    return {
      blobId: result.blobId,
      assetType: 'telemetry',
      metadata: asset.metadata,
      urls: {
        primary: result.urls!.primary,
        mirrors: [],
      },
    };
  }
  
  // Retrieve and decompress telemetry
  async retrieveTelemetry(blobId: string): Promise<{
    telemetry?: {
      heartRate: number[];
      power: number[];
      cadence: number[];
      timestamps: number[];
    };
    metadata?: Record<string, unknown>;
    error?: string;
  }> {
    const result = await this.client.retrieveJSON<{
      type: string;
      data: string;
      metadata: Record<string, unknown>;
    }>(blobId);
    
    if (!result.success) {
      return { error: result.error };
    }
    
    try {
      const telemetry = this.decompressTelemetry(result.data.data);
      return {
        telemetry,
        metadata: result.data.metadata,
      };
    } catch (error) {
      return { error: 'Failed to decompress telemetry' };
    }
  }
  
  // Simple compression for numeric arrays
  private compressTelemetry(telemetry: {
    heartRate: number[];
    power: number[];
    cadence: number[];
    timestamps: number[];
  }): string {
    // Delta encoding for timestamps + base64
    const deltas = telemetry.timestamps.map((t, i) => 
      i === 0 ? t : t - telemetry.timestamps[i - 1]
    );
    
    const compressed = {
      hr: telemetry.heartRate,
      p: telemetry.power,
      c: telemetry.cadence,
      ts: deltas,
    };
    
    return btoa(JSON.stringify(compressed));
  }
  
  private decompressTelemetry(compressed: string): {
    heartRate: number[];
    power: number[];
    cadence: number[];
    timestamps: number[];
  } {
    const data = JSON.parse(atob(compressed));
    
    // Reconstruct timestamps from deltas
    const timestamps: number[] = [];
    let current = 0;
    for (const delta of data.ts) {
      current += delta;
      timestamps.push(current);
    }
    
    return {
      heartRate: data.hr,
      power: data.p,
      cadence: data.c,
      timestamps,
    };
  }
}

// Singleton exports
let walrusClient: WalrusClient | null = null;
let assetManager: AssetManager | null = null;

export function getWalrusClient(): WalrusClient {
  if (!walrusClient) {
    walrusClient = new WalrusClient();
  }
  return walrusClient;
}

export function getAssetManager(): AssetManager {
  if (!assetManager) {
    assetManager = new AssetManager(getWalrusClient());
  }
  return assetManager;
}
