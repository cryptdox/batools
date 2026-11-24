import { AlertTriangle, Scale } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { isText } from '../../lib/islamicStudio';

const arabicStyle = { fontFamily: '"Amiri", "Scheherazade New", "Noto Naskh Arabic", serif' };

type Text = unknown;
type Block = {
  type: string; text?: Text; title?: Text; ar?: string; pron?: Text; meaning?: Text; label?: Text; ref?: Text; tone?: string;
  items?: Text[]; head?: Text[]; rows?: Text[][]; views?: { label: Text; text: Text; evidence?: Text }[]; check?: boolean;
};

/**
 * A guide's blocks as a reviewer reads them (supabase/data/guides/FORMAT.md).
 * Blocks marked "check" have a reference a scholar should confirm; they are
 * outlined in amber.
 */
export const IsGuidePreview = ({ blocks }: { blocks: unknown }) => {
  const { t, language } = useLanguage();
  const tx = (v: Text) => isText(v, language);
  const list = Array.isArray(blocks) ? (blocks as Block[]) : [];
  let step = 0;
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm">
      {list.map((b, i) => {
        const check = b.check ? 'ring-2 ring-warning/60 rounded-lg p-2' : '';
        let body = null;
        switch (b.type) {
          case 'heading': step = 0; body = <h4 className="font-semibold text-base text-primary">{tx(b.text)}</h4>; break;
          case 'text': body = <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{tx(b.text)}</p>; break;
          case 'step':
            step += 1;
            body = <p><span className="font-semibold">{step}. {tx(b.title)}</span> <span className="text-gray-700 dark:text-gray-300">{tx(b.text)}</span></p>;
            break;
          case 'arabic':
            body = (
              <div className="space-y-1 rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
                {Boolean(b.label) && <p className="text-xs font-semibold text-gray-500">{tx(b.label)}</p>}
                <p dir="rtl" lang="ar" className="text-2xl leading-loose" style={arabicStyle}>{b.ar}</p>
                {Boolean(b.pron) && <p className="italic text-gray-600 dark:text-gray-400">{tx(b.pron)}</p>}
                {Boolean(b.meaning) && <p>{tx(b.meaning)}</p>}
                {Boolean(b.ref) && <p className="text-xs text-gray-500">{tx(b.ref)}</p>}
              </div>
            );
            break;
          case 'list': body = <ul className="list-disc ps-5 space-y-0.5">{(b.items ?? []).map((it, j) => <li key={j}>{tx(it)}</li>)}</ul>; break;
          case 'table':
            body = (
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead><tr>{(b.head ?? []).map((h, j) => <th key={j} className="border border-gray-200 dark:border-gray-700 px-2 py-1 text-left">{tx(h)}</th>)}</tr></thead>
                  <tbody>{(b.rows ?? []).map((row, j) => <tr key={j}>{row.map((c, k) => <td key={k} className="border border-gray-200 dark:border-gray-700 px-2 py-1">{tx(c)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            );
            break;
          case 'note': body = <p className={`rounded-lg p-2 ${b.tone === 'warn' ? 'bg-danger/10' : 'bg-primary/10'}`}>{tx(b.text)}</p>; break;
          case 'differ':
            body = (
              <div className="space-y-1 rounded-lg border border-warning/40 p-2">
                <p className="flex items-center gap-1 font-semibold"><Scale size={14} /> {tx(b.title)}</p>
                {(b.views ?? []).map((v, j) => (
                  <p key={j}><span className="font-semibold">{tx(v.label)}:</span> {tx(v.text)}{v.evidence ? <span className="text-xs text-gray-500"> — {tx(v.evidence)}</span> : null}</p>
                ))}
              </div>
            );
            break;
          case 'ref': body = <p className="text-xs text-gray-500">{tx(b.text)}</p>; break;
          default: body = <pre className="text-xs text-gray-500 whitespace-pre-wrap">{JSON.stringify(b)}</pre>;
        }
        return (
          <div key={i} className={check}>
            {b.check && <p className="mb-1 flex items-center gap-1 text-xs text-warning"><AlertTriangle size={12} /> {t('is.guides.check')}</p>}
            {body}
          </div>
        );
      })}
    </div>
  );
};
