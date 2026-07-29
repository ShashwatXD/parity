import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Parity · MCP Studio',
  description: 'Airbnb-style MCP workspace with a blue accent',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
