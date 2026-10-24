import { useEffect } from 'react';
import DOMPurify from 'dompurify';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Bold, Italic, List, ListOrdered, Heading3, Code, Quote, Undo2, Redo2 } from 'lucide-react';

// Rich text, stored as HTML: the TipTap editor, a sanitised viewer, and the
// helpers that let older plain-text values (and `<b>…</b>` markup) be edited
// and shown the same way.

/** Text saved before descriptions became rich text: plain lines become paragraphs; HTML passes through. */
export const asRichHtml = (text: string | null | undefined): string => {
  if (!text) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  const esc = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text.split(/\n{2,}/).map(par => `<p>${esc(par).replace(/\n/g, '<br>')}</p>`).join('');
};

/** One-line plain text of a rich value, for list previews. */
export const richPlainText = (html: string | null | undefined): string => {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = DOMPurify.sanitize(html.replace(/<\/(p|li|h\d|blockquote)>/gi, '</$1> '));
  return (div.textContent ?? '').replace(/\s+/g, ' ').trim();
};

/** Stored rich text, sanitised before it reaches the DOM. */
export const RichView = ({ html, className = '' }: { html: string | null; className?: string }) =>
  html ? <div className={`ac-rich text-sm text-gray-700 dark:text-gray-300 ${className}`} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} /> : null;

/** Rich text editor (TipTap); reports HTML, '' when empty. */
export const RichEditor = ({ value, onChange, placeholder }: { value: string; onChange: (html: string) => void; placeholder?: string }) => {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [3] } })],
    content: asRichHtml(value),
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? '' : e.getHTML()),
    editorProps: { attributes: { 'data-placeholder': placeholder ?? '', class: 'px-3 py-2' } },
  });

  // Clearing from outside (after a submit) resets the editor too.
  useEffect(() => {
    if (editor && value === '' && !editor.isEmpty) editor.commands.clearContent();
  }, [editor, value]);

  if (!editor) return null;
  const btn = (active: boolean) =>
    `p-1.5 rounded-md ${active ? 'bg-primary/15 text-primary' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'}`;
  const tools: { icon: typeof Bold; run: () => void; active: boolean; label: string }[] = [
    { icon: Bold, run: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold'), label: 'Bold' },
    { icon: Italic, run: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic'), label: 'Italic' },
    { icon: Heading3, run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), active: editor.isActive('heading'), label: 'Heading' },
    { icon: List, run: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList'), label: 'Bullet list' },
    { icon: ListOrdered, run: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList'), label: 'Numbered list' },
    { icon: Code, run: () => editor.chain().focus().toggleCodeBlock().run(), active: editor.isActive('codeBlock'), label: 'Code' },
    { icon: Quote, run: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote'), label: 'Quote' },
    { icon: Undo2, run: () => editor.chain().focus().undo().run(), active: false, label: 'Undo' },
    { icon: Redo2, run: () => editor.chain().focus().redo().run(), active: false, label: 'Redo' },
  ];
  return (
    <div className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="flex flex-wrap gap-0.5 p-1 border-b border-gray-200 dark:border-gray-700">
        {tools.map(({ icon: Icon, run, active, label }) => (
          <button key={label} type="button" className={btn(active)} onClick={run} title={label} aria-label={label}>
            <Icon size={15} />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} className="ac-rich text-sm text-gray-900 dark:text-gray-100" />
    </div>
  );
};
