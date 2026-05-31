'use client';

/**
 * ProjectBrowser - Project list and management UI
 * 
 * Features:
 * - Grid/list view of projects
 * - Search and filter
 - Sort by date/name
 * - Right-click context menu
 * - Create, open, rename, duplicate, delete
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FolderOpen, 
  Plus, 
  Search, 
  Grid, 
  List, 
  MoreVertical,
  Clock,
  Music,
  Trash2,
  Copy,
  Edit2,
  Download,
  FileJson,
  Archive
} from 'lucide-react';
import { ProjectMetadata } from '../../engine/filesystem/indexedDBAdapter';

interface ProjectBrowserProps {
  projects: ProjectMetadata[];
  onCreateProject: () => void;
  onOpenProject: (projectId: string) => void;
  onRenameProject: (projectId: string, newName: string) => void;
  onDuplicateProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
  onExportProject: (projectId: string, format: 'json' | 'zip') => void;
  isLoading?: boolean;
}

type ViewMode = 'grid' | 'list';
type SortBy = 'date' | 'name';

export function ProjectBrowser({
  projects,
  onCreateProject,
  onOpenProject,
  onRenameProject,
  onDuplicateProject,
  onDeleteProject,
  onExportProject,
  isLoading = false,
}: ProjectBrowserProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    projectId: string;
    x: number;
    y: number;
  } | null>(null);
  const [renamingProject, setRenamingProject] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let filtered = projects.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort
    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'date') {
        return b.modifiedAt - a.modifiedAt;
      }
      return a.name.localeCompare(b.name);
    });

    return filtered;
  }, [projects, searchQuery, sortBy]);

  // Context menu handlers
  const handleContextMenu = useCallback((e: React.MouseEvent, projectId: string) => {
    e.preventDefault();
    setContextMenu({ projectId, x: e.clientX, y: e.clientY });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Rename handlers
  const startRename = useCallback((projectId: string, currentName: string) => {
    setRenamingProject(projectId);
    setNewName(currentName);
    setContextMenu(null);
  }, []);

  const confirmRename = useCallback(() => {
    if (renamingProject && newName.trim()) {
      onRenameProject(renamingProject, newName.trim());
    }
    setRenamingProject(null);
    setNewName('');
  }, [renamingProject, newName, onRenameProject]);

  const cancelRename = useCallback(() => {
    setRenamingProject(null);
    setNewName('');
  }, []);

  // Format date
  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
      if (diff < 60 * 60 * 1000) {
        const minutes = Math.floor(diff / (60 * 1000));
        return minutes < 1 ? 'Just now' : `${minutes}m ago`;
      }
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours}h ago`;
    }
    
    // Less than 7 days
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = Math.floor(diff / (24 * 60 * 60 * 1000));
      return `${days}d ago`;
    }
    
    return date.toLocaleDateString();
  };

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => handleCloseContextMenu();
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [handleCloseContextMenu]);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h1 className="text-xl font-semibold text-white">Projects</h1>
        
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-blue-500 w-64"
            />
          </div>

          {/* View mode toggle */}
          <div className="flex bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
          </select>

          {/* Create button */}
          <button
            onClick={onCreateProject}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </div>

      {/* Project list */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FolderOpen className="w-16 h-16 mb-4" />
            <p className="text-lg">No projects found</p>
            <p className="text-sm">Create a new project to get started</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isRenaming={renamingProject === project.id}
                newName={newName}
                onNewNameChange={setNewName}
                onConfirmRename={confirmRename}
                onCancelRename={cancelRename}
                onOpen={() => onOpenProject(project.id)}
                onContextMenu={(e) => handleContextMenu(e, project.id)}
                formatDate={formatDate}
                formatSize={formatSize}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProjects.map((project) => (
              <ProjectListItem
                key={project.id}
                project={project}
                isRenaming={renamingProject === project.id}
                newName={newName}
                onNewNameChange={setNewName}
                onConfirmRename={confirmRename}
                onCancelRename={cancelRename}
                onOpen={() => onOpenProject(project.id)}
                onContextMenu={(e) => handleContextMenu(e, project.id)}
                formatDate={formatDate}
                formatSize={formatSize}
              />
            ))}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ProjectContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          project={projects.find(p => p.id === contextMenu.projectId)!}
          onClose={handleCloseContextMenu}
          onRename={() => startRename(contextMenu.projectId, projects.find(p => p.id === contextMenu.projectId)!.name)}
          onDuplicate={() => {
            onDuplicateProject(contextMenu.projectId);
            handleCloseContextMenu();
          }}
          onDelete={() => {
            onDeleteProject(contextMenu.projectId);
            handleCloseContextMenu();
          }}
          onExportJson={() => {
            onExportProject(contextMenu.projectId, 'json');
            handleCloseContextMenu();
          }}
          onExportZip={() => {
            onExportProject(contextMenu.projectId, 'zip');
            handleCloseContextMenu();
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Project Card (Grid View)
// =============================================================================

interface ProjectCardProps {
  project: ProjectMetadata;
  isRenaming: boolean;
  newName: string;
  onNewNameChange: (name: string) => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  formatDate: (timestamp: number) => string;
  formatSize: (bytes: number) => string;
}

function ProjectCard({
  project,
  isRenaming,
  newName,
  onNewNameChange,
  onConfirmRename,
  onCancelRename,
  onOpen,
  onContextMenu,
  formatDate,
  formatSize,
}: ProjectCardProps) {
  return (
    <div
      className="group bg-gray-800 hover:bg-gray-750 rounded-xl p-4 cursor-pointer transition-all border border-gray-700 hover:border-gray-600"
      onClick={onOpen}
      onContextMenu={onContextMenu}
    >
      {/* Thumbnail placeholder */}
      <div className="aspect-video bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg mb-3 flex items-center justify-center">
        <Music className="w-12 h-12 text-gray-600" />
      </div>

      {/* Project info */}
      <div className="space-y-1">
        {isRenaming ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => onNewNameChange(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') onConfirmRename();
                if (e.key === 'Escape') onCancelRename();
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
              className="flex-1 px-2 py-1 bg-gray-700 border border-blue-500 rounded text-sm text-white focus:outline-none"
            />
          </div>
        ) : (
          <h3 className="font-medium text-white truncate">{project.name}</h3>
        )}
        
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDate(project.modifiedAt)}
          </span>
          <span>{formatSize(project.size)}</span>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>{project.trackCount} tracks</span>
          <span>•</span>
          <span>{project.assetCount} assets</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Project List Item (List View)
// =============================================================================

interface ProjectListItemProps extends ProjectCardProps {}

function ProjectListItem({
  project,
  isRenaming,
  newName,
  onNewNameChange,
  onConfirmRename,
  onCancelRename,
  onOpen,
  onContextMenu,
  formatDate,
  formatSize,
}: ProjectListItemProps) {
  return (
    <div
      className="group flex items-center gap-4 p-3 bg-gray-800 hover:bg-gray-750 rounded-lg cursor-pointer transition-all border border-gray-700 hover:border-gray-600"
      onClick={onOpen}
      onContextMenu={onContextMenu}
    >
      <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
        <Music className="w-5 h-5 text-gray-500" />
      </div>

      <div className="flex-1 min-w-0">
        {isRenaming ? (
          <input
            type="text"
            value={newName}
            onChange={(e) => onNewNameChange(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') onConfirmRename();
              if (e.key === 'Escape') onCancelRename();
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="px-2 py-1 bg-gray-700 border border-blue-500 rounded text-sm text-white focus:outline-none w-full"
          />
        ) : (
          <h3 className="font-medium text-white truncate">{project.name}</h3>
        )}
        
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{project.trackCount} tracks</span>
          <span>{project.assetCount} assets</span>
          <span>{formatSize(project.size)}</span>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        {formatDate(project.modifiedAt)}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onContextMenu(e);
        }}
        className="p-2 text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
    </div>
  );
}

// =============================================================================
// Context Menu
// =============================================================================

interface ProjectContextMenuProps {
  x: number;
  y: number;
  project: ProjectMetadata;
  onClose: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExportJson: () => void;
  onExportZip: () => void;
}

function ProjectContextMenu({
  x,
  y,
  project,
  onClose,
  onRename,
  onDuplicate,
  onDelete,
  onExportJson,
  onExportZip,
}: ProjectContextMenuProps) {
  // Adjust position if menu would go off screen
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 250);

  return (
    <div
      className="fixed z-50 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <div className="px-3 py-2 border-b border-gray-700">
        <p className="text-sm font-medium text-white truncate">{project.name}</p>
        <p className="text-xs text-gray-500">v{project.version}</p>
      </div>

      <button
        onClick={onRename}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
      >
        <Edit2 className="w-4 h-4" />
        Rename
      </button>

      <button
        onClick={onDuplicate}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
      >
        <Copy className="w-4 h-4" />
        Duplicate
      </button>

      <div className="border-t border-gray-700 my-1" />

      <button
        onClick={onExportJson}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
      >
        <FileJson className="w-4 h-4" />
        Export JSON
      </button>

      <button
        onClick={onExportZip}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
      >
        <Archive className="w-4 h-4" />
        Export ZIP
      </button>

      <div className="border-t border-gray-700 my-1" />

      <button
        onClick={onDelete}
        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-700 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        Delete
      </button>
    </div>
  );
}

export default ProjectBrowser;
