/**
 * Autosave Manager - Automatic project saving
 * 
 * Features:
 * - Auto-save at configurable intervals
 * - Save after important actions
 * - Background saving without blocking UI
 * - Recovery mode
 */

import { ProjectManager, Project } from './projectManager';
import { IndexedDBAdapter } from './indexedDBAdapter';

// =============================================================================
// Types
// =============================================================================

export interface AutosaveConfig {
  enabled: boolean;
  intervalSeconds: number;
  saveOnImportantActions: boolean;
  maxBackups: number;
  compressBackups: boolean;
}

export interface AutosaveState {
  lastSaveTime: number;
  isSaving: boolean;
  pendingSave: boolean;
  saveCount: number;
  errorCount: number;
}

export type ImportantAction = 
  | 'add_track'
  | 'delete_track'
  | 'add_clip'
  | 'delete_clip'
  | 'move_clip'
  | 'add_note'
  | 'delete_note'
  | 'record_audio'
  | 'import_audio'
  | 'apply_effect'
  | 'bounce_track'
  | 'tempo_change';

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_CONFIG: AutosaveConfig = {
  enabled: true,
  intervalSeconds: 30,
  saveOnImportantActions: true,
  maxBackups: 10,
  compressBackups: false,
};

const IMPORTANT_ACTIONS: ImportantAction[] = [
  'add_track',
  'delete_track',
  'add_clip',
  'delete_clip',
  'move_clip',
  'record_audio',
  'import_audio',
  'bounce_track',
];

// =============================================================================
// Autosave Manager Class
// =============================================================================

export class AutosaveManager {
  private projectManager: ProjectManager;
  private db: IndexedDBAdapter;
  private config: AutosaveConfig;
  private state: AutosaveState;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private currentProject: Project | null = null;

  constructor(
    projectManager: ProjectManager,
    db: IndexedDBAdapter,
    config: Partial<AutosaveConfig> = {}
  ) {
    this.projectManager = projectManager;
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = {
      lastSaveTime: 0,
      isSaving: false,
      pendingSave: false,
      saveCount: 0,
      errorCount: 0,
    };
  }

  // =============================================================================
  // Lifecycle
  // =============================================================================

  /**
   * Start autosave for a project
   */
  start(project: Project): void {
    if (!this.config.enabled) {
      console.log('[Autosave] Disabled');
      return;
    }

    this.currentProject = project;
    this.state.lastSaveTime = Date.now();

    // Clear existing timer
    this.stop();

    // Start new timer
    const intervalMs = this.config.intervalSeconds * 1000;
    this.timerId = setInterval(() => {
      this.autosave();
    }, intervalMs);

    console.log(`[Autosave] Started for project: ${project.name} (${this.config.intervalSeconds}s interval)`);
  }

  /**
   * Stop autosave
   */
  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.currentProject = null;
    console.log('[Autosave] Stopped');
  }

  /**
   * Pause autosave temporarily
   */
  pause(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Resume autosave
   */
  resume(): void {
    if (this.currentProject && this.config.enabled) {
      const intervalMs = this.config.intervalSeconds * 1000;
      this.timerId = setInterval(() => {
        this.autosave();
      }, intervalMs);
    }
  }

  // =============================================================================
  // Autosave Logic
  // =============================================================================

  /**
   * Perform an autosave
   */
  private async autosave(): Promise<void> {
    if (!this.currentProject) return;
    if (this.state.isSaving) {
      this.state.pendingSave = true;
      return;
    }

    await this.performSave();
  }

  /**
   * Perform the actual save operation
   */
  private async performSave(): Promise<void> {
    if (!this.currentProject) return;

    this.state.isSaving = true;

    try {
      await this.projectManager.saveProject(this.currentProject);
      
      this.state.lastSaveTime = Date.now();
      this.state.saveCount++;
      this.state.pendingSave = false;

      // Create backup if needed
      if (this.config.maxBackups > 0 && this.state.saveCount % 5 === 0) {
        await this.createBackup();
      }

      console.log(`[Autosave] Saved project (save #${this.state.saveCount})`);
    } catch (error) {
      this.state.errorCount++;
      console.error('[Autosave] Save failed:', error);
    } finally {
      this.state.isSaving = false;

      // Handle pending save
      if (this.state.pendingSave) {
        setTimeout(() => this.performSave(), 100);
      }
    }
  }

  /**
   * Trigger immediate save
   */
  async saveNow(): Promise<void> {
    if (!this.currentProject) {
      throw new Error('No project to save');
    }

    await this.performSave();
  }

  /**
   * Handle an important action
   */
  handleAction(action: ImportantAction): void {
    if (!this.config.enabled || !this.config.saveOnImportantActions) return;
    if (!this.currentProject) return;

    // Check if this action should trigger an autosave
    if (IMPORTANT_ACTIONS.includes(action)) {
      // Debounce: wait 1 second after last action before saving
      this.debouncedSave();
    }
  }

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  private debouncedSave(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.saveNow();
    }, 1000);
  }

  // =============================================================================
  // Backup Management
  // =============================================================================

  /**
   * Create a backup version
   */
  private async createBackup(): Promise<void> {
    if (!this.currentProject) return;

    try {
      const backupId = `${this.currentProject.id}-backup-${Date.now()}`;
      const backupData = {
        metadata: { ...this.currentProject.metadata, id: backupId },
        projectJson: JSON.stringify(this.currentProject.data),
        backupVersions: [],
      };

      await this.db.saveProject(backupId, backupData);

      // Clean up old backups
      await this.cleanupOldBackups();

      console.log(`[Autosave] Created backup: ${backupId}`);
    } catch (error) {
      console.error('[Autosave] Backup creation failed:', error);
    }
  }

  /**
   * Clean up old backups
   */
  private async cleanupOldBackups(): Promise<void> {
    if (!this.currentProject) return;

    try {
      const allProjects = await this.db.listProjects();
      const backupProjects = allProjects.filter(
        p => p.id.startsWith(`${this.currentProject!.id}-backup-`)
      );

      // Sort by date (oldest first)
      backupProjects.sort((a, b) => a.createdAt - b.createdAt);

      // Delete excess backups
      const toDelete = backupProjects.slice(0, -this.config.maxBackups);
      for (const backup of toDelete) {
        await this.db.deleteProject(backup.id);
        console.log(`[Autosave] Deleted old backup: ${backup.id}`);
      }
    } catch (error) {
      console.error('[Autosave] Backup cleanup failed:', error);
    }
  }

  /**
   * List available backups for current project
   */
  async listBackups(): Promise<Array<{ id: string; timestamp: number; version: number }>> {
    if (!this.currentProject) return [];

    try {
      const allProjects = await this.db.listProjects();
      return allProjects
        .filter(p => p.id.startsWith(`${this.currentProject!.id}-backup-`))
        .map(p => ({
          id: p.id,
          timestamp: p.createdAt,
          version: p.version,
        }))
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      console.error('[Autosave] Failed to list backups:', error);
      return [];
    }
  }

  /**
   * Restore from a backup
   */
  async restoreFromBackup(backupId: string): Promise<Project | null> {
    try {
      const backupData = await this.db.loadProject(backupId);
      if (!backupData) return null;

      const projectData = JSON.parse(backupData.projectJson);
      
      // Restore to current project
      if (this.currentProject) {
        this.currentProject.data = projectData;
        this.currentProject.metadata.modifiedAt = Date.now();
        
        // Save restored state
        await this.projectManager.saveProject(this.currentProject);
        
        console.log(`[Autosave] Restored from backup: ${backupId}`);
        return this.currentProject;
      }

      return null;
    } catch (error) {
      console.error('[Autosave] Restore failed:', error);
      return null;
    }
  }

  // =============================================================================
  // Configuration
  // =============================================================================

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutosaveConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart if interval changed and we're active
    if (this.currentProject && this.timerId) {
      this.stop();
      this.start(this.currentProject);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AutosaveConfig {
    return { ...this.config };
  }

  // =============================================================================
  // State Queries
  // =============================================================================

  /**
   * Get autosave state
   */
  getState(): AutosaveState {
    return { ...this.state };
  }

  /**
   * Check if autosave is active
   */
  isActive(): boolean {
    return this.timerId !== null;
  }

  /**
   * Get time since last save (in seconds)
   */
  getTimeSinceLastSave(): number {
    return (Date.now() - this.state.lastSaveTime) / 1000;
  }

  /**
   * Check if save is needed (based on time since last save)
   */
  isSaveNeeded(): boolean {
    return this.getTimeSinceLastSave() > this.config.intervalSeconds;
  }

  // =============================================================================
  // Recovery
  // =============================================================================

  /**
   * Check for recoverable projects (after crash)
   */
  async checkForRecovery(): Promise<Project | null> {
    try {
      const allProjects = await this.db.listProjects();
      
      // Find projects with unsaved changes (newer than last backup)
      const potentiallyUnsaved = allProjects.filter(p => {
        const backupPrefix = `${p.id}-backup-`;
        const hasBackups = allProjects.some(bp => bp.id.startsWith(backupPrefix));
        return hasBackups && p.modifiedAt > p.createdAt;
      });

      if (potentiallyUnsaved.length > 0) {
        // Return the most recently modified project
        potentiallyUnsaved.sort((a, b) => b.modifiedAt - a.modifiedAt);
        console.log(`[Autosave] Found ${potentiallyUnsaved.length} projects with potential unsaved changes`);
        
        // Load the most recent one
        return this.projectManager.loadProject(potentiallyUnsaved[0].id);
      }

      return null;
    } catch (error) {
      console.error('[Autosave] Recovery check failed:', error);
      return null;
    }
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.stop();
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createAutosaveManager(
  projectManager: ProjectManager,
  db: IndexedDBAdapter,
  config?: Partial<AutosaveConfig>
): AutosaveManager {
  return new AutosaveManager(projectManager, db, config);
}

export default AutosaveManager;
