/**
 * IndexedDB 持久化层
 *
 * 数据库: model-card-db
 *   - object store: projects
 *     - keyPath: id
 *     - index: by-updated (updatedAt)
 *
 * 用 idb 库封装 Promise API（原生 IndexedDB 是 callback hell）
 */

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Project } from './project';

interface ModelCardDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
    indexes: { 'by-updated': number };
  };
}

const DB_NAME = 'model-card-db';
const DB_VERSION = 1;
const STORE = 'projects';

let dbPromise: Promise<IDBPDatabase<ModelCardDB>> | null = null;

function getDB(): Promise<IDBPDatabase<ModelCardDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ModelCardDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('by-updated', 'updatedAt');
        }
      },
    });
  }
  return dbPromise;
}

// ============== CRUD ==============

export async function saveProject(project: Project): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE, 'readwrite');
  await tx.store.put({ ...project, updatedAt: Date.now() });
  await tx.done;
}

export async function getProject(id: string): Promise<Project | undefined> {
  const db = await getDB();
  return db.get(STORE, id);
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDB();
  // 按 updatedAt 倒序
  const projects = await db.getAllFromIndex(STORE, 'by-updated');
  return projects.reverse();
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE, id);
}

export async function getMostRecentProject(): Promise<Project | undefined> {
  const all = await listProjects();
  return all[0];
}

// 草稿用的设置（存当前打开的项目 ID）
export function saveCurrentProjectId(id: string): void {
  localStorage.setItem('model-card:currentProjectId', id);
}

export function getCurrentProjectId(): string | null {
  return localStorage.getItem('model-card:currentProjectId');
}
