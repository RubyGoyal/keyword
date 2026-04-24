import './globals.css';

export const metadata = {
  title: 'Embee Keyword Lab',
  description: 'Internal keyword research tool for embee.co.in — SEO, AEO, and GEO intelligence for the Indian market',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
