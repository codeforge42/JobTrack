
export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  password: string;
  companies: Company[];
}

export interface Company {
  id: string;
  name: string;
  website?: string | null;
  selector?: string | null;
  linkedin?: string | null;
  notes: string;
  period: string;
  last_scan_date: Date | null;
  jobs: Job[];
}

export interface Job {
  id: string;
  title: string;
  link: string;
  postedDate: string | null;
  description: string | null;
}

export interface ScanConfig {
  scanFrequency: '12h' | '24h' | '48h' | '80h';
  openAiApiKey: string;
}
