import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Time Tracker V2',
    short_name: 'TimeTracker',
    description: 'แอปพลิเคชันสำหรับลงเวลาเข้า-ออกงาน',
    start_url: '/',
    display: 'standalone', // ทำให้แอปเปิดมาแบบไม่มีแถบ URL ด้านบน (Native feel)
    background_color: '#ffffff',
    theme_color: '#000000',
    icons: [
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}