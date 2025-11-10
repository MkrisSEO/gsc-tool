import * as fs from 'fs';
import * as path from 'path';

export type ConditionOperator = 'contains' | 'equals' | 'regex' | 'batch';
export type ConditionType = 'inclusion' | 'exclusion';

export interface Condition {
  type: ConditionType;
  operator: ConditionOperator;
  value: string | string[];
}

export interface ContentGroup {
  id: string;
  name: string;
  siteUrl: string;
  conditions: Condition[];
  createdAt: string;
  updatedAt: string;
  urlCount: number;
  matchedUrls: string[];
}

const DATA_DIR = path.join(process.cwd(), 'data');
const CONTENT_GROUPS_FILE = path.join(DATA_DIR, 'content-groups.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize file if it doesn't exist
if (!fs.existsSync(CONTENT_GROUPS_FILE)) {
  fs.writeFileSync(CONTENT_GROUPS_FILE, JSON.stringify([], null, 2));
}

export function getAllContentGroups(): ContentGroup[] {
  try {
    const content = fs.readFileSync(CONTENT_GROUPS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to read content groups:', error);
    return [];
  }
}

export function getContentGroupsBySite(siteUrl: string): ContentGroup[] {
  const all = getAllContentGroups();
  return all.filter((g) => g.siteUrl === siteUrl);
}

export function getContentGroupById(id: string): ContentGroup | null {
  const all = getAllContentGroups();
  return all.find((g) => g.id === id) || null;
}

export function createContentGroup(group: ContentGroup): ContentGroup {
  const all = getAllContentGroups();
  all.push(group);
  fs.writeFileSync(CONTENT_GROUPS_FILE, JSON.stringify(all, null, 2));
  console.log('✅ [Content Groups] Created:', group.id, group.name);
  return group;
}

export function updateContentGroup(id: string, updates: Partial<ContentGroup>): ContentGroup | null {
  const all = getAllContentGroups();
  const index = all.findIndex((g) => g.id === id);
  
  if (index === -1) {
    return null;
  }

  all[index] = { 
    ...all[index], 
    ...updates, 
    id,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(CONTENT_GROUPS_FILE, JSON.stringify(all, null, 2));
  console.log('✅ [Content Groups] Updated:', id);
  return all[index];
}

export function deleteContentGroup(id: string): boolean {
  const all = getAllContentGroups();
  const filtered = all.filter((g) => g.id !== id);
  
  if (filtered.length === all.length) {
    return false;
  }

  fs.writeFileSync(CONTENT_GROUPS_FILE, JSON.stringify(filtered, null, 2));
  console.log('✅ [Content Groups] Deleted:', id);
  return true;
}

export function generateContentGroupId(): string {
  return `cg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Test if a URL matches a condition
 */
export function urlMatchesCondition(url: string, condition: Condition): boolean {
  const { operator, value } = condition;

  switch (operator) {
    case 'contains':
      return url.includes(value as string);
    
    case 'equals':
      return url === value;
    
    case 'regex':
      try {
        const regex = new RegExp(value as string);
        return regex.test(url);
      } catch {
        return false;
      }
    
    case 'batch':
      const values = Array.isArray(value) ? value : [value];
      return values.some((v) => url === v || url.includes(v));
    
    default:
      return false;
  }
}

/**
 * Test if a URL matches all conditions in a content group
 */
export function urlMatchesGroup(url: string, group: ContentGroup): boolean {
  const inclusionConditions = group.conditions.filter((c) => c.type === 'inclusion');
  const exclusionConditions = group.conditions.filter((c) => c.type === 'exclusion');

  // Must match at least one inclusion condition (if any exist)
  if (inclusionConditions.length > 0) {
    const matchesInclusion = inclusionConditions.some((c) => urlMatchesCondition(url, c));
    if (!matchesInclusion) return false;
  }

  // Must NOT match any exclusion condition
  const matchesExclusion = exclusionConditions.some((c) => urlMatchesCondition(url, c));
  if (matchesExclusion) return false;

  return true;
}

/**
 * Filter URLs by content group conditions
 */
export function filterUrlsByGroup(urls: string[], group: ContentGroup): string[] {
  return urls.filter((url) => urlMatchesGroup(url, group));
}

