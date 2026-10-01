export type ContentModule = 'knowledge' | 'practices' | 'activities' | 'project';

export interface ContentNode {
  id: string;
  type: 'directory' | 'document';
  title: string;
  description: string;
  documentPath?: string;
  children: ContentNode[];
}

export interface ContentDocument {
  path: string;
  title: string;
  description: string;
  markdown: string;
  module: ContentModule;
}

export interface ContentData {
  roots: ContentNode[];
  documents: Record<string, ContentDocument>;
}
