import { createClient } from '@/lib/supabase/server';
import Sidebar from '@/components/Sidebar';
import TemplateEditor from '../../components/TemplateEditor';
import { notFound } from 'next/navigation';

export const metadata = {
  title: 'Edit Template — WA GTM Engine',
  description: 'Edit an existing Spintax template.',
};

export default async function EditTemplatePage({ params }) {
  const supabase = await createClient();
  const { id } = await params;

  const { data: template, error } = await supabase
    .from('message_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !template) {
    return notFound();
  }

  return (
    <div className="app-layout">
      <Sidebar activePath="/templates" />
      <main className="main-content">
        <div className="page-container">
          <TemplateEditor initialData={template} />
        </div>
      </main>
    </div>
  );
}
