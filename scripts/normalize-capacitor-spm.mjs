import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packageFile = resolve('ios/App/CapApp-SPM/Package.swift');
const source = readFileSync(packageFile, 'utf8');
const normalized = source.replace(/path: "([^"]+)"/g, (_match, packagePath) => (
  `path: "${packagePath.replaceAll('\\', '/')}"`
));

if (normalized !== source) {
  writeFileSync(packageFile, normalized);
  console.log('Normalized Capacitor Swift package paths for macOS/Xcode.');
}
