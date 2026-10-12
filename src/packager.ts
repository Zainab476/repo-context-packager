import { formatJson, formatMarkdown } from "./formatters.js";
import type { ContextPackage, OmittedFile, RankedFile, OutputFormat } from "./types.js";

type PackageMetadata = Omit<
  ContextPackage,
  "files" | "omittedFiles" | "estimatedTokens" | "maxTokens"
>;

export interface PackageOptions {
  format: OutputFormat;
  maxTokens?: number;
}

function render(context: ContextPackage, format: OutputFormat): string {
  return format === "json" ? formatJson(context) : formatMarkdown(context);
}

export function estimateTokenCount(context: ContextPackage, format: OutputFormat): number {
  let estimate = 0;

  while (true) {
    const nextEstimate = Math.ceil(
      render({ ...context, estimatedTokens: estimate }, format).length / 4,
    );
    if (nextEstimate === estimate) {
      return estimate;
    }
    estimate = nextEstimate;
  }
}

function toOmittedFile(file: RankedFile): OmittedFile {
  return {
    path: file.relativePath,
    score: file.score,
    reason: "Omitted to stay within the --max-tokens budget.",
  };
}

function createPackage(
  metadata: PackageMetadata,
  files: RankedFile[],
  omittedFiles: OmittedFile[],
  options: PackageOptions,
): ContextPackage {
  const context: ContextPackage = {
    ...metadata,
    files,
    omittedFiles,
    estimatedTokens: 0,
    maxTokens: options.maxTokens,
  };

  context.estimatedTokens = estimateTokenCount(context, options.format);
  return context;
}

export function packageContext(
  metadata: PackageMetadata,
  rankedFiles: RankedFile[],
  options: PackageOptions,
): ContextPackage {
  if (options.maxTokens === undefined) {
    return createPackage(metadata, rankedFiles, [], options);
  }

  const selectedFiles: RankedFile[] = [];
  let result = createPackage(
    metadata,
    selectedFiles,
    rankedFiles.map(toOmittedFile),
    options,
  );

  for (const [index, file] of rankedFiles.entries()) {
    const candidateFiles = [...selectedFiles, file];
    const candidate = createPackage(
      metadata,
      candidateFiles,
      rankedFiles.slice(index + 1).map(toOmittedFile),
      options,
    );
    if (candidate.estimatedTokens > options.maxTokens) {
      break;
    }

    selectedFiles.push(file);
    result = candidate;
  }

  return result;
}
