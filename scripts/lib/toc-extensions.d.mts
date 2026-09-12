export declare function extensionOfTocLine(line: string): string | null;

export declare function filterUnavailableExtensions(
  tocText: string,
  availableExtensions: Set<string>,
  required?: Set<string>,
): { keptLines: string[]; skipped: string[]; missingRequired: string[] };
