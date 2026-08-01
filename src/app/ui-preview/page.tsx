import 'maplibre-gl/dist/maplibre-gl.css';
import { notFound } from 'next/navigation';
import { ModuleDeckMockup, type DeckViewer } from './ModuleDeckMockup';

const previewViewer: DeckViewer = {
  name: 'Alpha fan',
  role: 'Fan account',
  roles: ['fan'],
  metrics: {
    fan: [['HYPE balance', '24'], ['Discovery adds', '12'], ['Shows attended', '3'], ['Songs heard', '148'], ['HYPES sent', '31'], ['Playlists', '4']],
  },
};

export default async function UiPreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string }>;
}) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const mode = (await searchParams)?.mode;

  return <ModuleDeckMockup production={mode === 'live'} viewer={mode === 'live' ? previewViewer : undefined} />;
}
