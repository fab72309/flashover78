export interface NewsPost {
  id: string;
  title: string;
  content: string;
  imageUrl: string;
  readBy: string[];
  createdAt: Date;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  observations?: string;
  location?: string;
  formateurs?: string[];
  date: Date;
  createdAt: Date;
}

export interface Resource {
  id: string;
  title: string;
  category: 'SDIS78' | 'GDO_GTO' | 'LECTURES';
  fileUrl: string;
  createdAt: Date;
}