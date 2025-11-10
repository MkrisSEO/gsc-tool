import * as fs from 'fs';
import * as path from 'path';

export interface Annotation {
  id: string;
  date: string;
  title: string;
  description: string;
  scope: 'all' | 'specific' | 'content_group';
  urls?: string[];
  contentGroupId?: string;
  createdAt: string;
  createdBy: string;
  siteUrl: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const ANNOTATIONS_FILE = path.join(DATA_DIR, 'annotations.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize file if it doesn't exist
if (!fs.existsSync(ANNOTATIONS_FILE)) {
  fs.writeFileSync(ANNOTATIONS_FILE, JSON.stringify([], null, 2));
}

export function getAllAnnotations(): Annotation[] {
  try {
    const content = fs.readFileSync(ANNOTATIONS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to read annotations:', error);
    return [];
  }
}

export function getAnnotationsBySite(siteUrl: string): Annotation[] {
  const all = getAllAnnotations();
  return all.filter((a) => a.siteUrl === siteUrl);
}

export function getAnnotationById(id: string): Annotation | null {
  const all = getAllAnnotations();
  return all.find((a) => a.id === id) || null;
}

export function createAnnotation(annotation: Annotation): Annotation {
  const all = getAllAnnotations();
  all.push(annotation);
  fs.writeFileSync(ANNOTATIONS_FILE, JSON.stringify(all, null, 2));
  console.log('✅ [Annotations Storage] Created annotation:', annotation.id);
  return annotation;
}

export function updateAnnotation(id: string, updates: Partial<Annotation>): Annotation | null {
  const all = getAllAnnotations();
  const index = all.findIndex((a) => a.id === id);
  
  if (index === -1) {
    return null;
  }

  all[index] = { ...all[index], ...updates, id }; // Preserve ID
  fs.writeFileSync(ANNOTATIONS_FILE, JSON.stringify(all, null, 2));
  console.log('✅ [Annotations Storage] Updated annotation:', id);
  return all[index];
}

export function deleteAnnotation(id: string): boolean {
  const all = getAllAnnotations();
  const filtered = all.filter((a) => a.id !== id);
  
  if (filtered.length === all.length) {
    return false; // Not found
  }

  fs.writeFileSync(ANNOTATIONS_FILE, JSON.stringify(filtered, null, 2));
  console.log('✅ [Annotations Storage] Deleted annotation:', id);
  return true;
}

export function generateAnnotationId(): string {
  return `ann_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

