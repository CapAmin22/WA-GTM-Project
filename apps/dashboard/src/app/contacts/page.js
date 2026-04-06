import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';
import ContactsClient from './components/ContactsClient';

export const metadata = {
  title: 'Contact Manager — WA GTM Engine',
  description: 'Manage contacts, tags, and blacklist.',
};

export default async function ContactsPage({ searchParams }) {
  const supabase = await createClient();
  const page = parseInt(searchParams?.page || '1', 10);
  const size = 50;

  // Simple pagination
  const { data: contacts, error, count } = await supabase
    .from('contacts')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * size, page * size - 1);

  return (
    <div className="app-layout">
      <Sidebar activePath="/contacts" />
      <main className="main-content">
        <div className="page-container">
          <ContactsClient 
            initialContacts={contacts || []} 
            totalCount={count || 0}
            currentPage={page}
            error={error?.message}
          />
        </div>
      </main>
    </div>
  );
}
