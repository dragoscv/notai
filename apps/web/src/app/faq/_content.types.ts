import type React from 'react';

export interface FaqItem {
  q: string;
  a: React.ReactNode;
}

export interface FaqSection {
  title: string;
  items: FaqItem[];
}

export interface FaqSchemaItem {
  question: string;
  answer: string;
}

export interface FaqContent {
  pageTitle: string;
  pageSubtitle: string;
  stillStuckTitle: string;
  stillStuck: React.ReactNode;
  sections: FaqSection[];
  schemaItems: FaqSchemaItem[];
}
