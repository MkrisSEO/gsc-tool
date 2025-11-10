import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

interface GoogleUpdate {
  id: string;
  date: string;
  completionDate?: string;
  name: string;
  type: string;
  description: string;
  source: string;
  articleLinks?: string[];
}

const UPDATES_FILE = path.join(process.cwd(), 'data', 'google-updates.json');

function getAllUpdates(): GoogleUpdate[] {
  try {
    if (!fs.existsSync(UPDATES_FILE)) {
      console.warn('Google updates file not found');
      return [];
    }
    const content = fs.readFileSync(UPDATES_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to read Google updates:', error);
    return [];
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const type = searchParams.get('type');

  let updates = getAllUpdates();

  // Filter by date range if provided
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    updates = updates.filter((update) => {
      const updateDate = new Date(update.date);
      return updateDate >= start && updateDate <= end;
    });
  }

  // Filter by type if provided
  if (type) {
    updates = updates.filter((update) => update.type === type);
  }

  // Sort by date (newest first)
  updates.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return NextResponse.json({ updates });
}

