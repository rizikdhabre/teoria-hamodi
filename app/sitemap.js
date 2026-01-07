export default function sitemap() {
  const baseUrl = 'https://theory-hamodi.com';

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/contactUs`,
      lastModified: new Date(),
    },
  ];
}
