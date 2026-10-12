export type FileCategory =
  | "entrypoint"
  | "schema"
  | "route"
  | "config"
  | "test"
  | "source"
  | "documentation";

export type OutputFormat = "markdown" | "json";

export interface CliOptions {
  target: string;
  task?: string;
  diff: boolean;
  format: OutputFormat;
  maxTokens?: number;
  help: boolean;
}

export interface FileCandidate {
  absolutePath: string;
  relativePath: string;
  name: string;
  extension: string;
  content: string;
  sizeBytes: number;
  categories: FileCategory[];
  changed: boolean;
}

export interface RankedFile extends FileCandidate {
  score: number;
  reasons: string[];
}

export interface ScanResult {
  root: string;
  files: FileCandidate[];
  scannedCount: number;
  excludedCount: number;
  gitAvailable: boolean;
  changedPaths: string[];
  projectHints: string[];
  warnings: string[];
}

export interface OmittedFile {
  path: string;
  score: number;
  reason: string;
}

export interface ContextPackage {
  projectName: string;
  task?: string;
  scannedCount: number;
  excludedCount: number;
  gitAvailable: boolean;
  changedCount: number;
  projectHints: string[];
  files: RankedFile[];
  omittedFiles: OmittedFile[];
  estimatedTokens: number;
  maxTokens?: number;
}
