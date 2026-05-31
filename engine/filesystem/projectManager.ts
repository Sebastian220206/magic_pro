/**
 * Project Manager - High-level project operations
 * 
 * Features:
 * - Create, save, load, rename, duplicate, delete projects
 * - Project metadata management
 * - Import/export projects
 * - Integration with IndexedDB and AssetManager
 */

import { IndexedDBAdapter, ProjectMetadata, ProjectData, UserSettings } from './indexedDBAdapter';
import { AssetManager } from './assetManager';
import { ProjectSerializer, SerializedProject } from './projectSerializer';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Types
// =============================================================================

export interface Project {
  id: string;
  name: string;
  data: SerializedProject;
  metadata: ProjectMetadata;
}

export interface CreateProjectOptions {
  name: string;
  template?: 'empty' | 'electronic' | 'rock' | 'orchestral';
  tempo?: number;
  timeSignature?: { numerator: number; denominator: number };
}

export interface ImportProjectResult {
  project: Project;
  importedAssets: number;
  errors: string[];
}

// =============================================================================
// Project Templates
// =============================================================================

const PROJECT_TEMPLATES: Record<string, Partial<SerializedProject>> = {
  empty: {
    timeline: {
      tempo: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      startBeat: 0,
      endBeat: 128,
    },
    tracks: [],
    midiClips: [],
    mixer: { master: { volume: 0 }, channels: [] },
    automation: {},
    markers: [],
    assets: [],
    plugins: [],
  },
  
  electronic: {
    timeline: {
      tempo: 128,
      timeSignature: { numerator: 4, denominator: 4 },
      startBeat: 0,
      endBeat: 256,
    },
    tracks: [
      { id: 'track-1', name: 'Kick', type: 'audio', color: '#3B82F6', muted: false, soloed: false, volume: 0, pan: 0, clips: [] },
      { id: 'track-2', name: 'Snare', type: 'audio', color: '#EF4444', muted: false, soloed: false, volume: 0, pan: 0, clips: [] },
      { id: 'track-3', name: 'Hi-Hats', type: 'audio', color: '#F59E0B', muted: false, soloed: false, volume: -3, pan: 0, clips: [] },
      { id: 'track-4', name: 'Bass', type: 'midi', color: '#8B5CF6', muted: false, soloed: false, volume: 0, pan: 0, clips: [] },
      { id: 'track-5', name: 'Lead Synth', type: 'midi', color: '#10B981', muted: false, soloed: false, volume: -2, pan: 10, clips: [] },
      { id: 'track-6', name: 'Pads', type: 'midi', color: '#EC4899', muted: false, soloed: false, volume: -6, pan: -10, clips: [] },
    ],
    midiClips: [],
    mixer: {
      master: { volume: -1, limiter: true },
      channels: [],
    },
    automation: {},
    markers: [
      { beat: 0, name: 'Intro', color: '#10B981' },
      { beat: 32, name: 'Build Up', color: '#F59E0B' },
      { beat: 64, name: 'Drop', color: '#EF4444' },
      { beat: 128, name: 'Break', color: '#3B82F6' },
    ],
    assets: [],
    plugins: [],
  },
  
  rock: {
    timeline: {
      tempo: 140,
      timeSignature: { numerator: 4, denominator: 4 },
      startBeat: 0,
      endBeat: 192,
    },
    tracks: [
      { id: 'track-1', name: 'Drums', type: 'audio', color: '#EF4444', muted: false, soloed: false, volume: -2, pan: 0, clips: [] },
      { id: 'track-2', name: 'Bass Guitar', type: 'audio', color: '#8B5CF6', muted: false, soloed: false, volume: -1, pan: 0, clips: [] },
      { id: 'track-3', name: 'Rhythm Guitar L', type: 'audio', color: '#F59E0B', muted: false, soloed: false, volume: -3, pan: -25, clips: [] },
      { id: 'track-4', name: 'Rhythm Guitar R', type: 'audio', color: '#F59E0B', muted: false, soloed: false, volume: -3, pan: 25, clips: [] },
      { id: 'track-5', name: 'Lead Guitar', type: 'audio', color: '#3B82F6', muted: false, soloed: false, volume: -1, pan: 0, clips: [] },
      { id: 'track-6', name: 'Vocals', type: 'audio', color: '#10B981', muted: false, soloed: false, volume: 0, pan: 0, clips: [] },
    ],
    midiClips: [],
    mixer: {
      master: { volume: -0.5, limiter: true },
      channels: [],
    },
    automation: {},
    markers: [
      { beat: 0, name: 'Intro', color: '#10B981' },
      { beat: 16, name: 'Verse 1', color: '#3B82F6' },
      { beat: 48, name: 'Chorus 1', color: '#EF4444' },
      { beat: 80, name: 'Verse 2', color: '#3B82F6' },
    ],
    assets: [],
    plugins: [],
  },
  
  orchestral: {
    timeline: {
      tempo: 100,
      timeSignature: { numerator: 4, denominator: 4 },
      startBeat: 0,
      endBeat: 320,
    },
    tracks: [
      { id: 'track-1', name: 'Strings', type: 'midi', color: '#8B5CF6', muted: false, soloed: false, volume: -4, pan: 0, clips: [] },
      { id: 'track-2', name: 'Brass', type: 'midi', color: '#F59E0B', muted: false, soloed: false, volume: -3, pan: 0, clips: [] },
      { id: 'track-3', name: 'Woodwinds', type: 'midi', color: '#10B981', muted: false, soloed: false, volume: -5, pan: 0, clips: [] },
      { id: 'track-4', name: 'Percussion', type: 'midi', color: '#EF4444', muted: false, soloed: false, volume: -2, pan: 0, clips: [] },
      { id: 'track-5', name: 'Piano', type: 'midi', color: '#3B82F6', muted: false, soloed: false, volume: -3, pan: -15, clips: [] },
      { id: 'track-6', name: 'Harp', type: 'midi', color: '#EC4899', muted: false, soloed: false, volume: -6, pan: 15, clips: [] },
    ],
    midiClips: [],
    mixer: {
      master: { volume: -1, limiter: false },
      channels: [],
    },
    automation: {},
    markers: [
      { beat: 0, name: 'Introduction', color: '#10B981' },
      { beat: 32, name: 'Theme A', color: '#3B82F6' },
      { beat: 96, name: 'Development', color: '#F59E0B' },
      { beat: 192, name: 'Recapitulation', color: '#8B5CF6' },
      { beat: 256, name: 'Coda', color: '#EC4899' },
    ],
    assets: [],
    plugins: [],
  },
};

// =============================================================================
// Project Manager Class
// =============================================================================

export class ProjectManager {
  private db: IndexedDBAdapter;
  private assetManager: AssetManager;
  private serializer: ProjectSerializer;
  private currentProject: Project | null = null;

  constructor(db: IndexedDBAdapter, assetManager: AssetManager) {
    this.db = db;
    this.assetManager = assetManager;
    this.serializer = new ProjectSerializer();
  }

  /**
   * Initialize the project manager
   */
  async initialize(): Promise<void> {
    await this.db.initialize();
    console.log('[ProjectManager] Initialized');
  }

  // =============================================================================
  // Project Lifecycle
  // =============================================================================

  /**
   * Create a new project
   */
  async createProject(options: CreateProjectOptions): Promise<Project> {
    const { name, template = 'empty', tempo, timeSignature } = options;
    
    // Generate project ID
    const projectId = `project-${uuidv4()}`;
    const now = Date.now();
    
    // Get template or use empty
    const templateData = PROJECT_TEMPLATES[template] || PROJECT_TEMPLATES.empty;
    
    // Apply custom tempo/time signature if provided
    const projectData: SerializedProject = {
      format: 'daw-project-v1',
      project: {
        id: projectId,
        name,
        createdAt: now,
        modifiedAt: now,
        version: 1,
      },
      timeline: {
        ...templateData.timeline!,
        tempo: tempo || templateData.timeline!.tempo,
        timeSignature: timeSignature || templateData.timeline!.timeSignature,
      },
      tracks: templateData.tracks || [],
      midiClips: templateData.midiClips || [],
      mixer: templateData.mixer || { master: { volume: 0 }, channels: [] },
      automation: templateData.automation || {},
      markers: templateData.markers || [],
      assets: [],
      plugins: [],
    };

    // Create metadata
    const metadata: ProjectMetadata = {
      id: projectId,
      name,
      createdAt: now,
      modifiedAt: now,
      version: 1,
      duration: 128,
      trackCount: projectData.tracks.length,
      assetCount: 0,
      size: 0,
    };

    // Create project object
    const project: Project = {
      id: projectId,
      name,
      data: projectData,
      metadata,
    };

    // Save to database
    const dbData: ProjectData = {
      metadata,
      projectJson: JSON.stringify(projectData),
      backupVersions: [],
    };
    
    await this.db.saveProject(projectId, dbData);
    
    // Update recent projects
    await this.addToRecentProjects(projectId);
    
    console.log(`[ProjectManager] Created project: ${name} (${projectId})`);
    
    return project;
  }

  /**
   * Save the current project
   */
  async saveProject(project?: Project): Promise<void> {
    const projectToSave = project || this.currentProject;
    if (!projectToSave) {
      throw new Error('No project to save');
    }

    // Update metadata
    const now = Date.now();
    projectToSave.metadata.modifiedAt = now;
    projectToSave.metadata.version++;
    projectToSave.data.project.modifiedAt = now;
    projectToSave.data.project.version = projectToSave.metadata.version;
    
    // Calculate size
    const projectJson = JSON.stringify(projectToSave.data);
    projectToSave.metadata.size = new Blob([projectJson]).size;
    
    // Update track/asset counts
    projectToSave.metadata.trackCount = projectToSave.data.tracks.length;
    projectToSave.metadata.assetCount = projectToSave.data.assets.length;
    
    // Save to database
    const dbData: ProjectData = {
      metadata: projectToSave.metadata,
      projectJson,
      backupVersions: [], // Could add backup logic here
    };
    
    await this.db.saveProject(projectToSave.id, dbData);
    
    console.log(`[ProjectManager] Saved project: ${projectToSave.name} (v${projectToSave.metadata.version})`);
  }

  /**
   * Load a project
   */
  async loadProject(projectId: string): Promise<Project> {
    const dbData = await this.db.loadProject(projectId);
    if (!dbData) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Parse project data
    const projectData: SerializedProject = JSON.parse(dbData.projectJson);
    
    // Create project object
    const project: Project = {
      id: projectId,
      name: dbData.metadata.name,
      data: projectData,
      metadata: dbData.metadata,
    };

    // Set as current project
    this.currentProject = project;
    
    // Update recent projects
    await this.addToRecentProjects(projectId);
    
    console.log(`[ProjectManager] Loaded project: ${project.name}`);
    
    return project;
  }

  /**
   * Close the current project
   */
  async closeProject(saveBeforeClose: boolean = true): Promise<void> {
    if (this.currentProject && saveBeforeClose) {
      await this.saveProject();
    }
    
    this.currentProject = null;
    console.log('[ProjectManager] Closed project');
  }

  // =============================================================================
  // Project Management
  // =============================================================================

  /**
   * Rename a project
   */
  async renameProject(projectId: string, newName: string): Promise<void> {
    const dbData = await this.db.loadProject(projectId);
    if (!dbData) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Update metadata
    dbData.metadata.name = newName;
    dbData.metadata.modifiedAt = Date.now();
    
    // Update project data
    const projectData: SerializedProject = JSON.parse(dbData.projectJson);
    projectData.project.name = newName;
    projectData.project.modifiedAt = Date.now();
    
    dbData.projectJson = JSON.stringify(projectData);
    
    // Save back
    await this.db.saveProject(projectId, dbData);
    
    // Update current project if it's the same
    if (this.currentProject?.id === projectId) {
      this.currentProject.name = newName;
      this.currentProject.data.project.name = newName;
    }
    
    console.log(`[ProjectManager] Renamed project to: ${newName}`);
  }

  /**
   * Duplicate a project
   */
  async duplicateProject(projectId: string, newName: string): Promise<Project> {
    const sourceProject = await this.loadProject(projectId);
    
    // Create new project ID
    const newProjectId = `project-${uuidv4()}`;
    const now = Date.now();
    
    // Clone project data
    const clonedData: SerializedProject = JSON.parse(JSON.stringify(sourceProject.data));
    clonedData.project.id = newProjectId;
    clonedData.project.name = newName;
    clonedData.project.createdAt = now;
    clonedData.project.modifiedAt = now;
    clonedData.project.version = 1;
    
    // Generate new IDs for tracks and clips
    const idMap = new Map<string, string>();
    
    clonedData.tracks = clonedData.tracks.map(track => {
      const newTrackId = `track-${uuidv4()}`;
      idMap.set(track.id, newTrackId);
      return { ...track, id: newTrackId };
    });
    
    clonedData.midiClips = clonedData.midiClips.map(clip => {
      const newClipId = `clip-${uuidv4()}`;
      const newTrackId = idMap.get(clip.trackId) || clip.trackId;
      return { ...clip, id: newClipId, trackId: newTrackId };
    });
    
    // Create metadata
    const metadata: ProjectMetadata = {
      id: newProjectId,
      name: newName,
      createdAt: now,
      modifiedAt: now,
      version: 1,
      duration: sourceProject.metadata.duration,
      trackCount: sourceProject.metadata.trackCount,
      assetCount: sourceProject.metadata.assetCount,
      size: sourceProject.metadata.size,
    };

    // Create project
    const newProject: Project = {
      id: newProjectId,
      name: newName,
      data: clonedData,
      metadata,
    };

    // Save to database
    const dbData: ProjectData = {
      metadata,
      projectJson: JSON.stringify(clonedData),
      backupVersions: [],
    };
    
    await this.db.saveProject(newProjectId, dbData);
    
    console.log(`[ProjectManager] Duplicated project: ${newName}`);
    
    return newProject;
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<void> {
    // Check if project exists
    const exists = await this.db.projectExists(projectId);
    if (!exists) {
      throw new Error(`Project not found: ${projectId}`);
    }

    // Load project to get asset references
    const dbData = await this.db.loadProject(projectId);
    if (dbData) {
      const projectData: SerializedProject = JSON.parse(dbData.projectJson);
      
      // Remove project references from assets
      for (const asset of projectData.assets) {
        const assetData = await this.db.loadAsset(asset.id);
        if (assetData) {
          const usedBy = assetData.metadata.usedBy.filter(id => id !== projectId);
          await this.db.updateAssetUsage(asset.id, usedBy);
          
          // Delete asset if no longer used
          if (usedBy.length === 0) {
            await this.assetManager.deleteAsset(asset.id);
          }
        }
      }
    }

    // Delete project
    await this.db.deleteProject(projectId);
    
    // Remove from recent projects
    await this.removeFromRecentProjects(projectId);
    
    // Clear current project if it was the deleted one
    if (this.currentProject?.id === projectId) {
      this.currentProject = null;
    }
    
    console.log(`[ProjectManager] Deleted project: ${projectId}`);
  }

  // =============================================================================
  // Queries
  // =============================================================================

  /**
   * List all projects
   */
  async listProjects(): Promise<ProjectMetadata[]> {
    return this.db.listProjects();
  }

  /**
   * Get project metadata
   */
  async getProjectMetadata(projectId: string): Promise<ProjectMetadata | null> {
    return this.db.getProjectMetadata(projectId);
  }

  /**
   * Get current project
   */
  getCurrentProject(): Project | null {
    return this.currentProject;
  }

  /**
   * Check if a project exists
   */
  async projectExists(projectId: string): Promise<boolean> {
    return this.db.projectExists(projectId);
  }

  // =============================================================================
  // Recent Projects
  // =============================================================================

  /**
   * Get recent projects list
   */
  async getRecentProjects(): Promise<string[]> {
    const settings = await this.db.loadSettings();
    return settings?.recentProjects || [];
  }

  private async addToRecentProjects(projectId: string): Promise<void> {
    const settings = await this.db.loadSettings();
    const recentProjects = settings?.recentProjects || [];
    
    // Remove if already exists
    const filtered = recentProjects.filter(id => id !== projectId);
    
    // Add to front (most recent)
    filtered.unshift(projectId);
    
    // Keep only last 20
    const trimmed = filtered.slice(0, 20);
    
    // Save
    await this.db.saveSettings({
      ...settings,
      recentProjects: trimmed,
      autosaveInterval: settings?.autosaveInterval || 30,
      backupCount: settings?.backupCount || 10,
      defaultTempo: settings?.defaultTempo || 120,
      defaultTimeSignature: settings?.defaultTimeSignature || { numerator: 4, denominator: 4 },
    });
  }

  private async removeFromRecentProjects(projectId: string): Promise<void> {
    const settings = await this.db.loadSettings();
    if (!settings) return;
    
    const filtered = settings.recentProjects.filter(id => id !== projectId);
    
    await this.db.saveSettings({
      ...settings,
      recentProjects: filtered,
    });
  }

  // =============================================================================
  // Export/Import
  // =============================================================================

  /**
   * Export project as JSON blob
   */
  async exportProjectAsJson(projectId: string): Promise<Blob> {
    const project = await this.loadProject(projectId);
    const json = JSON.stringify(project.data, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  /**
   * Export project as ZIP (includes audio assets)
   */
  async exportProjectAsZip(projectId: string): Promise<Blob> {
    // This would use JSZip to create a complete project archive
    // For now, return JSON
    return this.exportProjectAsJson(projectId);
  }

  /**
   * Import project from JSON
   */
  async importProjectFromJson(json: string, name?: string): Promise<Project> {
    const projectData: SerializedProject = JSON.parse(json);
    
    // Generate new IDs
    const projectId = `project-${uuidv4()}`;
    const now = Date.now();
    
    projectData.project.id = projectId;
    projectData.project.name = name || projectData.project.name;
    projectData.project.createdAt = now;
    projectData.project.modifiedAt = now;
    projectData.project.version = 1;
    
    // Create metadata
    const metadata: ProjectMetadata = {
      id: projectId,
      name: projectData.project.name,
      createdAt: now,
      modifiedAt: now,
      version: 1,
      duration: projectData.timeline.endBeat - projectData.timeline.startBeat,
      trackCount: projectData.tracks.length,
      assetCount: projectData.assets.length,
      size: json.length,
    };

    // Create project
    const project: Project = {
      id: projectId,
      name: metadata.name,
      data: projectData,
      metadata,
    };

    // Save
    const dbData: ProjectData = {
      metadata,
      projectJson: JSON.stringify(projectData),
      backupVersions: [],
    };
    
    await this.db.saveProject(projectId, dbData);
    await this.addToRecentProjects(projectId);
    
    console.log(`[ProjectManager] Imported project: ${metadata.name}`);
    
    return project;
  }

  // =============================================================================
  // Utility
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
    return this.db.getStorageStats();
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.currentProject = null;
    this.db.close();
  }
}

// =============================================================================
// Factory
// =============================================================================

export function createProjectManager(
  db: IndexedDBAdapter,
  assetManager: AssetManager
): ProjectManager {
  return new ProjectManager(db, assetManager);
}

export default ProjectManager;
