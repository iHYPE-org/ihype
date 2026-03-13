export const ARTIST_UPLOAD_POLICY_EFFECTIVE_DATE = 'March 11, 2026';

export type ArtistUploadPolicySection = {
  title: string;
  paragraphs: readonly string[];
  bullets?: readonly string[];
  closing?: string;
};

export const artistUploadPolicySections: readonly ArtistUploadPolicySection[] = [
  {
    title: '1. Purpose of the Platform',
    paragraphs: [
      'iHYPE.org is a digital platform that enables independent artists to upload media that can be curated by authorized promoters into streaming-only shows.',
      'The platform is intended to promote music discovery and allow promoters to assemble streaming programs featuring uploaded artist content.',
      'iHYPE does not claim ownership of uploaded works.'
    ]
  },
  {
    title: '2. Ownership of Content',
    paragraphs: [
      'Artists retain full ownership and copyright of all media uploaded to iHYPE.org.',
      'Uploading content to the Platform does not transfer ownership to iHYPE or to any promoter.',
      'Artists represent and warrant that they:'
    ],
    bullets: [
      'Own the rights to the uploaded content, or',
      'Have obtained all required permissions and licenses necessary to upload the content under this Policy.'
    ]
  },
  {
    title: '3. Grant of Limited License',
    paragraphs: [
      'By uploading media to iHYPE.org, the Artist grants iHYPE a non-exclusive, worldwide, royalty-free limited license to:'
    ],
    bullets: [
      'Host, store, and display the media on the Platform.',
      'Allow authorized promoters to include the media in streaming-only shows created within iHYPE.',
      'Stream the media as part of those shows through iHYPE or its authorized players.',
      'Display metadata, artwork, and attribution related to the media.'
    ],
    closing:
      'This license does not permit downloading, resale, redistribution, or derivative works outside the iHYPE streaming environment.'
  },
  {
    title: '4. Streaming-Only Use',
    paragraphs: [
      'Uploaded media may only be used for streaming playback within iHYPE shows.',
      'Promoters may not:'
    ],
    bullets: [
      'Download the media',
      'Distribute the media outside iHYPE',
      'Sell or sublicense the media',
      'Edit, remix, or alter the media without permission from the Artist.'
    ],
    closing: 'All use must occur strictly within the iHYPE platform.'
  },
  {
    title: '5. Advertising Restrictions',
    paragraphs: [
      'iHYPE may display music-only advertisements within streaming shows.',
      'Permitted advertisements are limited to:'
    ],
    bullets: [
      'Promotion of musical artists',
      'Music releases',
      'Concerts or music-related events',
      'Music services, labels, or music platforms'
    ],
    closing:
      'Advertisements may not include non-music commercial advertising, unrelated products, or unrelated services. Artist media will not be used directly within advertisements unless the artist provides separate permission.'
  },
  {
    title: '6. Promoter Rights and Restrictions',
    paragraphs: [
      'Authorized promoters may:'
    ],
    bullets: [
      'Curate artist media into streaming shows',
      'Arrange playlists or themed programming',
      'Provide hosting or commentary around the streamed content'
    ],
    closing:
      'Promoters may not claim ownership of artist content, export or redistribute artist media, modify the media without permission, or use the media outside the iHYPE platform.'
  },
  {
    title: '7. Artist Removal Rights',
    paragraphs: [
      'Artists may remove their uploaded media from the Platform at any time.',
      'Once media is removed:'
    ],
    bullets: [
      'The media will no longer be available for inclusion in any new shows created by promoters.',
      'Promoters will be restricted from adding the removed media to future shows.'
    ],
    closing:
      'However, any shows created prior to the removal of the media may continue to stream and remain available for playback on the Platform. These previously created shows may continue to operate as originally produced but may not be modified to add the removed media to new programming.'
  },
  {
    title: '8. Attribution',
    paragraphs: [
      'iHYPE and promoters must provide reasonable attribution when media is streamed, including:'
    ],
    bullets: [
      'Artist name',
      'Title of the work (if provided)',
      'Any additional metadata supplied by the Artist.'
    ]
  },
  {
    title: '9. Prohibited Content',
    paragraphs: [
      'Artists may not upload media that:'
    ],
    bullets: [
      'Infringes on copyright or intellectual property rights',
      'Contains unlawful or illegal material',
      'Violates applicable laws',
      'Violates iHYPE community standards.'
    ],
    closing: 'iHYPE reserves the right to remove content that violates these rules.'
  },
  {
    title: '10. Monetization',
    paragraphs: [
      'iHYPE may support monetization features such as:'
    ],
    bullets: [
      'Music-related advertisements',
      'Sponsorship of streaming shows',
      'Ticketed digital music events'
    ],
    closing: 'Any revenue programs involving artist content may be governed by separate agreements.'
  },
  {
    title: '11. Termination',
    paragraphs: [
      'iHYPE may suspend or terminate accounts that violate this Policy.',
      'Upon termination:'
    ],
    bullets: [
      'The limited license granted to iHYPE ends',
      'Previously created streaming shows may remain accessible for playback.'
    ]
  },
  {
    title: '12. Policy Updates',
    paragraphs: [
      'iHYPE may update this Policy periodically. Continued use of the Platform after updates constitutes acceptance of the revised terms.'
    ]
  },
  {
    title: '13. Contact',
    paragraphs: [
      'Email: legal@ihype.org',
      'Website: https://ihype.org'
    ]
  }
] as const;
