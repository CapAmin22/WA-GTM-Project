import './globals.css';

export const metadata = {
  title: 'WA GTM Engine — Dashboard',
  description: 'WhatsApp Go-To-Market Engine. Manage WhatsApp accounts, monitor connections, and scale messaging dynamically.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
