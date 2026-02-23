import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'RFID Asset Tracking',
  description: 'Real-time RFID asset onboarding and movement tracking',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <header style={{
          padding: '16px 40px',
          backgroundColor: 'white',
          borderBottom: '1px solid #ecf0f1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80px'
        }}>
          <img 
            src="/logo.png" 
            alt="EMOS95 Intelligence Logo" 
            style={{ maxHeight: '60px', objectFit: 'contain' }}
          />
        </header>
        <main style={{ padding: '20px' }}>
          {children}
        </main>
      </body>
    </html>
  );
}
