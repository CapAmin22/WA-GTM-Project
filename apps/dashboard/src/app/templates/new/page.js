import Sidebar from '@/components/Sidebar';
import TemplateEditor from '../components/TemplateEditor';

export const metadata = {
  title: 'New Template — WA GTM Engine',
  description: 'Create a new Spintax template.',
};

export default function NewTemplatePage() {
  return (
    <div className="app-layout">
      <Sidebar activePath="/templates" />
      <main className="main-content">
        <div className="page-container">
          <TemplateEditor />
        </div>
      </main>
    </div>
  );
}
