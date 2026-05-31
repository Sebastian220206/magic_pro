/**
 * IndexedDB Adapter - Low-level storage interface for DAW projects
 * 
 * Features:
 * - Projects store (metadata + JSON)
 * - Assets store (audio buffers + metadata)
 * - Waveforms store (pre-computed peaks)
 * - Settings store (user preferences)
 * - Transaction-based operations
 * - Error handling and recovery
 */

// =============================================================================
// Database Configuration
// =============================================================================

const DB_NAME = 'DAWProjectsDB';
const DB_VERSION = 1;

const STORES = {
  PROJECTS: 'projects',
  ASSETS: 'assets',
  WAVEFORMS: 'waveforms',
  SETTINGS: 'settings',
} as const;

// =============================================================================
// Types
// =============================================================================

export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: number;
  modifiedAt: number;
  version: number;
  thumbnail?: string; // Base64 encoded thumbnail
  duration: number; // Project length in beats
  trackCount: number;
  assetCount: number;
  size: number; // Total size in bytes
}

export interface ProjectData {
  metadata: ProjectMetadata;
  projectJson: string; // Serialized project state
  backupVersions: Array<{
    version: number;
    timestamp: number;
    data: string;
  }>;
}

export interface AssetMetadata {
  id: string;
  type: 'audio' | 'midi' | 'video' | 'image';
  name: string;
  hash: string; // SHA-256 hash for deduplication
  size: number;
  duration?: number;
  sampleRate?: number;
  channels?: number;
  createdAt: number;
  usedBy: string[]; // Project IDs that reference this asset
}

export interface AssetData {
  metadata: AssetMetadata;
  buffer: ArrayBuffer;
}

export interface WaveformData {
  assetId: string;
  peaks: Float32Array;
  samplesPerPeak: number;
  version: number;
}

export interface UserSettings {
  recentProjects: string[];
  autosaveInterval: number;
  backupCount: number;
  defaultTempo: number;
  defaultTimeSignature: { numerator: number; denominator: number };
}

// =============================================================================
// IndexedDB Adapter Class
// =============================================================================

export class IndexedDBAdapter {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the database
   */
  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[IndexedDB] Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log(`[IndexedDB] Upgrading database to version ${DB_VERSION}`);

        // Projects store
        if (!db.objectStoreNames.contains(STORES.PROJECTS)) {
          const projectsStore = db.createObjectStore(STORES.PROJECTS, { keyPath: 'metadata.id' });
          projectsStore.createIndex('name', 'metadata.name', { unique: false });
          projectsStore.createIndex('modifiedAt', 'metadata.modifiedAt', { unique: false });
          console.log('[IndexedDB] Created projects store');
        }

        // Assets store
        if (!db.objectStoreNames.contains(STORES.ASSETS)) {
          const assetsStore = db.createObjectStore(STORES.ASSETS, { keyPath: 'metadata.id' });
          assetsStore.createIndex('hash', 'metadata.hash', { unique: true });
          assetsStore.createIndex('type', 'metadata.type', { unique: false });
          console.log('[IndexedDB] Created assets store');
        }

        // Waveforms store
        if (!db.objectStoreNames.contains(STORES.WAVEFORMS)) {
          db.createObjectStore(STORES.WAVEFORMS, { keyPath: 'assetId' });
          console.log('[IndexedDB] Created waveforms store');
        }

        // Settings store
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
          console.log('[IndexedDB] Created settings store');
        }
      };
    });
  }

  // =============================================================================
  // Project Operations
  // =============================================================================

  /**
   * Save a project to IndexedDB
   */
  async saveProject(projectId: string, data: ProjectData): Promise<void> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PROJECTS], 'readwrite');
      const store = transaction.objectStore(STORES.PROJECTS);
      
      // Update modified time
      data.metadata.modifiedAt = Date.now();
      data.metadata.version++;
      
      const request = store.put(data);
      
      request.onsuccess = () => {
        console.log(`[IndexedDB] Saved project: ${projectId}`);
        resolve();
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to save project: ${request.error?.message}`));
      };
    });
  }

  /**
   * Load a project from IndexedDB
   */
  async loadProject(projectId: string): Promise<ProjectData | null> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PROJECTS], 'readonly');
      const store = transaction.objectStore(STORES.PROJECTS);
      const request = store.get(projectId);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to load project: ${request.error?.message}`));
      };
    });
  }

  /**
   * Delete a project from IndexedDB
   */
  async deleteProject(projectId: string): Promise<void> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PROJECTS], 'readwrite');
      const store = transaction.objectStore(STORES.PROJECTS);
      const request = store.delete(projectId);
      
      request.onsuccess = () => {
        console.log(`[IndexedDB] Deleted project: ${projectId}`);
        resolve();
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to delete project: ${request.error?.message}`));
      };
    });
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<ProjectMetadata[]> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PROJECTS], 'readonly');
      const store = transaction.objectStore(STORES.PROJECTS);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const projects = request.result.map((data: ProjectData) => data.metadata);
        // Sort by modified date (newest first)
        projects.sort((a: ProjectMetadata, b: ProjectMetadata) => b.modifiedAt - a.modifiedAt);
        resolve(projects);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to list projects: ${request.error?.message}`));
      };
    });
  }

  /**
   * Get project metadata
   */
  async getProjectMetadata(projectId: string): Promise<ProjectMetadata | null> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PROJECTS], 'readonly');
      const store = transaction.objectStore(STORES.PROJECTS);
      const request = store.get(projectId);
      
      request.onsuccess = () => {
        const data = request.result as ProjectData | undefined;
        resolve(data?.metadata || null);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to get metadata: ${request.error?.message}`));
      };
    });
  }

  /**
   * Check if project exists
   */
  async projectExists(projectId: string): Promise<boolean> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.PROJECTS], 'readonly');
      const store = transaction.objectStore(STORES.PROJECTS);
      const request = store.count(projectId);
      
      request.onsuccess = () => {
        resolve(request.result > 0);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to check project: ${request.error?.message}`));
      };
    });
  }

  // =============================================================================
  // Asset Operations
  // =============================================================================

  /**
   * Save an audio asset
   */
  async saveAsset(assetId: string, buffer: ArrayBuffer, metadata: AssetMetadata): Promise<void> {
    await this.ensureInitialized();
    
    const data: AssetData = {
      metadata: { ...metadata, id: assetId },
      buffer,
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.ASSETS], 'readwrite');
      const store = transaction.objectStore(STORES.ASSETS);
      const request = store.put(data);
      
      request.onsuccess = () => {
        console.log(`[IndexedDB] Saved asset: ${assetId} (${buffer.byteLength} bytes)`);
        resolve();
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to save asset: ${request.error?.message}`));
      };
    });
  }

  /**
   * Load an asset
   */
  async loadAsset(assetId: string): Promise<AssetData | null> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.ASSETS], 'readonly');
      const store = transaction.objectStore(STORES.ASSETS);
      const request = store.get(assetId);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to load asset: ${request.error?.message}`));
      };
    });
  }

  /**
   * Delete an asset
   */
  async deleteAsset(assetId: string): Promise<void> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.ASSETS], 'readwrite');
      const store = transaction.objectStore(STORES.ASSETS);
      const request = store.delete(assetId);
      
      request.onsuccess = () => {
        console.log(`[IndexedDB] Deleted asset: ${assetId}`);
        resolve();
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to delete asset: ${request.error?.message}`));
      };
    });
  }

  /**
   * Find asset by hash (for deduplication)
   */
  async findAssetByHash(hash: string): Promise<AssetMetadata | null> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.ASSETS], 'readonly');
      const store = transaction.objectStore(STORES.ASSETS);
      const index = store.index('hash');
      const request = index.get(hash);
      
      request.onsuccess = () => {
        const data = request.result as AssetData | undefined;
        resolve(data?.metadata || null);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to find asset: ${request.error?.message}`));
      };
    });
  }

  /**
   * List all assets
   */
  async listAssets(): Promise<AssetMetadata[]> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.ASSETS], 'readonly');
      const store = transaction.objectStore(STORES.ASSETS);
      const request = store.getAll();
      
      request.onsuccess = () => {
        const assets = request.result.map((data: AssetData) => data.metadata);
        resolve(assets);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to list assets: ${request.error?.message}`));
      };
    });
  }

  /**
   * Update asset usage (which projects use this asset)
   */
  async updateAssetUsage(assetId: string, projectIds: string[]): Promise<void> {
    await this.ensureInitialized();
    
    const asset = await this.loadAsset(assetId);
    if (!asset) return;
    
    asset.metadata.usedBy = projectIds;
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.ASSETS], 'readwrite');
      const store = transaction.objectStore(STORES.ASSETS);
      const request = store.put(asset);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to update asset usage`));
    });
  }

  // =============================================================================
  // Waveform Operations
  // =============================================================================

  /**
   * Save waveform data
   */
  async saveWaveform(assetId: string, peaks: Float32Array, samplesPerPeak: number): Promise<void> {
    await this.ensureInitialized();
    
    const data: WaveformData = {
      assetId,
      peaks,
      samplesPerPeak,
      version: 1,
    };
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.WAVEFORMS], 'readwrite');
      const store = transaction.objectStore(STORES.WAVEFORMS);
      const request = store.put(data);
      
      request.onsuccess = () => {
        console.log(`[IndexedDB] Saved waveform: ${assetId} (${peaks.length} peaks)`);
        resolve();
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to save waveform: ${request.error?.message}`));
      };
    });
  }

  /**
   * Load waveform data
   */
  async loadWaveform(assetId: string): Promise<WaveformData | null> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.WAVEFORMS], 'readonly');
      const store = transaction.objectStore(STORES.WAVEFORMS);
      const request = store.get(assetId);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => {
        reject(new Error(`Failed to load waveform: ${request.error?.message}`));
      };
    });
  }

  /**
   * Delete waveform data
   */
  async deleteWaveform(assetId: string): Promise<void> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.WAVEFORMS], 'readwrite');
      const store = transaction.objectStore(STORES.WAVEFORMS);
      const request = store.delete(assetId);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete waveform`));
    });
  }

  // =============================================================================
  // Settings Operations
  // =============================================================================

  /**
   * Save user settings
   */
  async saveSettings(settings: UserSettings): Promise<void> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.SETTINGS], 'readwrite');
      const store = transaction.objectStore(STORES.SETTINGS);
      const request = store.put({ key: 'userSettings', ...settings });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to save settings`));
    });
  }

  /**
   * Load user settings
   */
  async loadSettings(): Promise<UserSettings | null> {
    await this.ensureInitialized();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORES.SETTINGS], 'readonly');
      const store = transaction.objectStore(STORES.SETTINGS);
      const request = store.get('userSettings');
      
      request.onsuccess = () => {
        const result = request.result;
        if (!result) {
          resolve(null);
          return;
        }
        
        const { key, ...settings } = result;
        resolve(settings as UserSettings);
      };
      
      request.onerror = () => reject(new Error(`Failed to load settings`));
    });
  }

  // =============================================================================
  // Utility Methods
  // =============================================================================

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    projects: number;
    assets: number;
    waveforms: number;
    estimatedSize: number;
  }> {
    await this.ensureInitialized();
    
    const [projects, assets, waveforms] = await Promise.all([
      this.countStore(STORES.PROJECTS),
      this.countStore(STORES.ASSETS),
      this.countStore(STORES.WAVEFORMS),
    ]);
    
    // Estimate size (rough approximation)
    const estimatedSize = await this.estimateStorageSize();
    
    return { projects, assets, waveforms, estimatedSize };
  }

  private countStore(storeName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to count ${storeName}`));
    });
  }

  private async estimateStorageSize(): Promise<number> {
    // Get all assets and sum their sizes
    const assets = await this.listAssets();
    return assets.reduce((total, asset) => total + asset.size, 0);
  }

  /**
   * Clear all data (use with caution!)
   */
  async clearAllData(): Promise<void> {
    await this.ensureInitialized();
    
    const stores = Object.values(STORES);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(stores, 'readwrite');
      
      let completed = 0;
      let hasError = false;
      
      stores.forEach(storeName => {
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = () => {
          completed++;
          if (completed === stores.length && !hasError) {
            resolve();
          }
        };
        
        request.onerror = () => {
          hasError = true;
          reject(new Error(`Failed to clear ${storeName}`));
        };
      });
    });
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
      console.log('[IndexedDB] Database closed');
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createIndexedDBAdapter(): IndexedDBAdapter {
  return new IndexedDBAdapter();
}

// Singleton instance
let adapterInstance: IndexedDBAdapter | null = null;

export function getIndexedDBAdapter(): IndexedDBAdapter {
  if (!adapterInstance) {
    adapterInstance = createIndexedDBAdapter();
  }
  return adapterInstance;
}

export default IndexedDBAdapter;
