export declare function extensionOfTocLine(line: string): string | null;
export declare function extensionEntryLines(tocText: string): string[];
export declare function schemasInToc(tocText: string): Set<string>;
export declare function parseExtensionSchemas(sqlText: string): Map<string, string>;

export declare function filterUnavailableExtensions(
  tocText: string,
  options?: {
    availableExtensions?: Set<string>;
    extensionSchemas?: Map<string, string>;
    hostableSchemas?: Set<string> | null;
    required?: Set<string>;
  },
): {
  keptLines: string[];
  skipped: { name: string; reason: string }[];
  missingRequired: { name: string; reason: string }[];
};
