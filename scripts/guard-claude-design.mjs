import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

function assertIncludes(relativePath, requiredText, reason) {
  const file = read(relativePath);

  if (!file.includes(requiredText)) {
    throw new Error(`${relativePath} is missing "${requiredText}". ${reason}`);
  }
}

function assertNotIncludes(relativePath, removedText, reason) {
  const file = read(relativePath);

  if (file.includes(removedText)) {
    throw new Error(`${relativePath} still includes "${removedText}". ${reason}`);
  }
}

function assertMissing(relativePath, reason) {
  if (existsSync(path.join(root, relativePath))) {
    throw new Error(`${relativePath} should not exist. ${reason}`);
  }
}

function assertRolePage(relativePath, roleKey) {
  const file = read(relativePath);
  const requiredSnippets = [
    "import { ProfileDirectoryPage } from '@/components/ProfileDirectoryPage';",
    "import { RoleModuleSubheader } from '@/components/RoleModuleSubheader';",
    `resolveDiscoverModule('${roleKey}'`,
    '<ProfileDirectoryPage',
    '<RoleModuleSubheader'
  ];

  for (const snippet of requiredSnippets) {
    if (!file.includes(snippet)) {
      throw new Error(
        `${relativePath} is missing "${snippet}". Role landing pages must keep the Claude-style wrapper and the working module subheader.`
      );
    }
  }
}

assertIncludes(
  'src/components/ProfileDirectoryPage.tsx',
  'signed-landing-schema',
  'The signed-in role pages should keep the newer Claude-derived visual shell.'
);
assertNotIncludes(
  'src/components/ProfileDirectoryPage.tsx',
  'signed-landing-hero',
  'The redundant signed-in role hero/signal overview should stay removed from all role lanes.'
);
assertIncludes(
  'src/app/globals.css',
  '.signed-landing-schema',
  'Do not drop the scoped CSS block that prevents the old dark directory shell from returning.'
);
assertIncludes(
  'src/app/globals.css',
  'Extend the current dark scheme through authenticated role landing pages.',
  'Signed-in pages should keep the current visual scheme instead of drifting back to obsolete light skins.'
);
assertNotIncludes(
  'src/components/ProfileDirectoryPage.tsx',
  'signed-role-signal-grid',
  'The redundant signed-in signal cards should not render above selected modules.'
);
assertIncludes(
  'src/lib/role-landing-content.ts',
  'publicRoleCards',
  'Shared role-card copy should stay centralized for the homepage and role landing schema.'
);
assertIncludes(
  'src/app/auth/landing/page.tsx',
  'getDefaultLandingPathForUser',
  'Auth landing must preserve role-aware redirects instead of hardcoding a legacy page.'
);
assertIncludes(
  'src/app/auth/landing/page.tsx',
  'resolveRequestedModule',
  'Old discovery/search URLs should be able to route signed-in users into their role tool hub.'
);
assertIncludes(
  'src/lib/account-routing.ts',
  'getRoleLandingPathForType',
  'Role-aware login should land users on their role lane with a selected module.'
);
assertIncludes(
  'src/lib/account-routing.ts',
  "module: DiscoverModuleId = 'tool-hub'",
  'Post-login role lanes should open on the consolidated Tool Hub by default.'
);
assertIncludes(
  'src/components/AdminPerspective.tsx',
  '/fans?module=tool-hub',
  'Admin QA mode should open role lanes on the consolidated Tool Hub.'
);
assertIncludes(
  'src/components/AdminPerspective.tsx',
  'getPerspectiveForPathname',
  'Admin QA mode should keep the header selector synchronized with the role lane being viewed.'
);
assertIncludes(
  'src/app/admin/page.tsx',
  'QA role perspectives',
  'The admin console should keep direct QA links for each signed-in role lane.'
);
assertIncludes(
  'src/components/DiscoverModulePanels.tsx',
  'recommendation-stat-strip',
  'Stats should be merged into Recommendation Engine instead of staying as a separate role module.'
);
assertIncludes(
  'src/components/DiscoverModulePanels.tsx',
  'DiscoverToolHubPanel',
  'Signed-in landing should have a consolidated Tool Hub for all role tools.'
);
assertIncludes(
  'src/app/promoters/page.tsx',
  'Show Creator stays separate',
  'Promoter landing Tool Hub should consolidate tools without absorbing Show Creator.'
);
assertIncludes(
  'src/components/VisualDropStudio.tsx',
  'Desktop drop + phone upload',
  'The customization engine should keep the drag-and-drop visual studio for graphics, media, and links.'
);
assertIncludes(
  'src/components/ProfilePageEditor.tsx',
  'VisualDropStudio',
  'Shared profile customization should keep the drag-and-drop design board instead of the old upload-only control.'
);
assertIncludes(
  'src/components/ArtistPageBuilder.tsx',
  'Place artist graphics, video, and links',
  'Artist page customization should keep the easier drag-and-drop visual layout.'
);
assertIncludes(
  'src/components/PromoterPageBuilder.tsx',
  'Place promoter graphics, video, and links',
  'Promoter page customization should keep the easier drag-and-drop visual layout.'
);
assertIncludes(
  'src/components/VenuePageBuilder.tsx',
  'Place venue graphics, video, and links',
  'Venue page customization should keep the easier drag-and-drop visual layout.'
);
assertIncludes(
  'src/app/globals.css',
  '.visual-drop-studio',
  'The drag-and-drop page customization studio needs its polished visual styling.'
);
assertIncludes(
  'src/components/DiscoverModulePanels.tsx',
  'recommendation-stat-card',
  'Merged stats should render inside Recommendation Engine cards.'
);
assertNotIncludes(
  'src/components/DiscoverModulePanels.tsx',
  'DiscoverStatsPanel',
  'The old standalone Stats panel should not come back.'
);
['src/app/my/fan/page.tsx', 'src/app/my/artist/page.tsx', 'src/app/my/promoter/page.tsx', 'src/app/my/venue/page.tsx'].forEach((pagePath) => {
  assertNotIncludes(
    pagePath,
    'module=stats',
    'Signed-in role pages should route stats into Recommendation Engine instead of a separate tab.'
  );
});
assertIncludes(
  'src/app/globals.css',
  '.recommendation-stat-strip',
  'Merged stats need schema-scoped styling inside Recommendation Engine.'
);
assertIncludes(
  'src/lib/account-routing.ts',
  "return '/promoters';",
  'Promoter users should land in the promoter lane.'
);
assertIncludes(
  'src/lib/discover-modules.ts',
  "id: 'tool-hub'",
  'Each role lane should expose the consolidated Tool Hub in the subheader.'
);
assertIncludes(
  'src/lib/discover-modules.ts',
  "id: 'recommendation-engine'",
  'Each role lane should expose the recommendation engine in the subheader.'
);
assertNotIncludes(
  'src/lib/discover-modules.ts',
  "id: 'discover'",
  'Discover should be merged into Recommendation Engine instead of remaining as a separate role module.'
);
assertNotIncludes(
  'src/lib/discover-modules.ts',
  "id: 'stats'",
  'Stats should be merged into Recommendation Engine instead of remaining as a separate role module.'
);
assertIncludes(
  'src/lib/discover-modules.ts',
  "id: 'ticket-hub'",
  'Role lanes should expose the ticket hub where ticket activity is available.'
);
assertIncludes(
  'src/lib/discover-modules.ts',
  "id: 'event-creator'",
  'Venue recommendation links need a selectable Event Creator module.'
);
assertIncludes(
  'src/components/AuthScreens.tsx',
  'auth-signal-page',
  'Sign in, register, and reset should use the current dark signal auth schema.'
);
assertIncludes(
  'src/app/page.tsx',
  'ihype-home-page',
  'The public start page must keep the current dark iHYPE launch scheme, not an obsolete static fallback.'
);
assertIncludes(
  'src/components/PublicFeaturePage.tsx',
  'ihype-feature-page',
  'Public HYPE and Tickets pages should share the approved launch schema instead of static HTML schemas.'
);
assertIncludes(
  'src/app/hype/page.tsx',
  'PublicFeaturePage',
  'The HYPE page should be a Next.js route, not a rewrite to obsolete static HTML.'
);
assertIncludes(
  'src/components/DiscoverModulePanels.tsx',
  'recommendation-engine-signal-map',
  'Discovery search, globe, and spotlight information should live inside Recommendation Engine.'
);
assertIncludes(
  'src/components/DiscoverModulePanels.tsx',
  'recommendation-engine-panel',
  'Recommendation Engine must use the signed-in visual schema instead of the obsolete discover-page card styling.'
);
assertIncludes(
  'src/components/DiscoverModulePanels.tsx',
  'HypeQueue',
  'Recommendation Engine should include the guided HYPE Queue so new listens can feed the HYPE engine.'
);
assertIncludes(
  'src/lib/hype-queue.ts',
  'buildHypeQueue',
  'HYPE Queue recommendations should stay centralized instead of being duplicated across role pages.'
);
assertIncludes(
  'src/components/HypeQueue.tsx',
  'Not for me',
  'HYPE Queue should keep lightweight listener controls for relevance feedback.'
);
assertIncludes(
  'src/app/globals.css',
  '.signed-landing-schema .recommendation-engine-panel',
  'Recommendation Engine needs schema-scoped CSS so old discover styles cannot bleed through.'
);
assertIncludes(
  'src/app/globals.css',
  '.hype-queue',
  'HYPE Queue needs polished shared styling inside the Recommendation Engine.'
);
assertIncludes(
  'src/app/tickets/page.tsx',
  'PublicFeaturePage',
  'The Tickets page should be a Next.js route, not a rewrite to obsolete static HTML.'
);
assertIncludes(
  'src/app/page.tsx',
  'One platform. Four roles.',
  'The public homepage should keep the current role-card layout from the approved new visual direction.'
);
assertIncludes(
  'src/components/HeaderPrimaryNav.tsx',
  'Tickets',
  'The current header should keep the new Home/HYPE/Tickets navigation.'
);
assertNotIncludes(
  'src/components/HeaderPrimaryNav.tsx',
  '/discover',
  'The public Discover page has been deleted and should not remain in the primary nav.'
);
// NavPrimaryLinks is the updated component (adds aria-current active state); either is valid
if (!readFileSync('src/app/layout.tsx', 'utf8').includes('HeaderPrimaryNav') &&
    !readFileSync('src/app/layout.tsx', 'utf8').includes('NavPrimaryLinks')) {
  throw new Error('src/app/layout.tsx is missing nav component. Root layout should render the current nav instead of the old centered player header.');
}
assertIncludes(
  'src/app/layout.tsx',
  'suppressHydrationWarning',
  'Accessibility preferences can update document classes and language after hydration without false warnings.'
);
assertIncludes(
  'src/app/layout.tsx',
  'Primary site header',
  'The shared header needs a clear accessible label across all pages.'
);
assertIncludes(
  'src/components/HeaderAuthLinks.tsx',
  'AccessibilityControls',
  'The header should use the persistent accessibility panel instead of a one-off contrast toggle.'
);
assertIncludes(
  'src/components/AppProviders.tsx',
  'RouteAccessibilityAnnouncer',
  'Route changes should be announced for screen reader users across the app.'
);
assertIncludes(
  'src/components/AccessibilityControls.tsx',
  'ihype-accessibility-settings',
  'Accessibility preferences should persist across pages on the same device.'
);
assertIncludes(
  'src/components/AccessibilityControls.tsx',
  'Page language for assistive tech',
  'Language controls should update document metadata for assistive technology.'
);
assertIncludes(
  'src/app/globals.css',
  '.a11y-panel',
  'The accessibility menu needs shared styling across the current site schema.'
);
assertIncludes(
  'src/app/globals.css',
  'html.a11y-reduce-motion',
  'Reduced motion should be available as a persistent site-wide accessibility setting.'
);
assertIncludes(
  'src/app/globals.css',
  '@media (prefers-reduced-motion: reduce)',
  'System-level reduced motion preferences should apply across the full app.'
);
assertIncludes(
  'middleware.ts',
  'legacyRouteRedirects',
  'Legacy static pages should redirect into the maintained Next.js routes instead of showing obsolete schemas.'
);
assertIncludes(
  'src/components/AuthScreens.tsx',
  'auth-optional-details',
  'Signup should keep optional profile fields tucked away so onboarding stays short.'
);
assertIncludes(
  'src/components/DiscoverModulePanels.tsx',
  'discover-empty-state',
  'Empty modules need polished beta-ready empty states with clear next actions.'
);
assertIncludes(
  'public/sw.js',
  'ihype-v7-schema-lock',
  'The service worker cache should evict older static schema pages after deployment.'
);

for (const legacyStaticPage of [
  'public/ihype-forgot.html',
  'public/ihype-governance.html',
  'public/ihype-investor.html',
  'public/ihype-media.html',
  'public/ihype-show.html'
]) {
  assertMissing(
    legacyStaticPage,
    'Old static Claude/import pages caused live-site schema drift and should stay removed.'
  );
}

assertRolePage('src/app/fans/page.tsx', 'fans');
assertRolePage('src/app/artists/page.tsx', 'artists');
assertRolePage('src/app/promoters/page.tsx', 'promoters');
assertRolePage('src/app/venues/page.tsx', 'venues');

for (const rolePage of [
  'src/app/fans/page.tsx',
  'src/app/artists/page.tsx',
  'src/app/promoters/page.tsx',
  'src/app/venues/page.tsx'
]) {
  assertIncludes(
    rolePage,
    'isAdminSession',
    'Admin QA sessions should be able to render each role lane without needing an owned profile of that type.'
  );
}

console.log('Claude design guard passed: current visual schema and role routing are intact.');
