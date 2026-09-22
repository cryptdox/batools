import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../../lib/LanguageContext';
import type { Vocabulary, LanguageCode, PartOfSpeech } from '../../../types/taskManager';
import { supabase } from '../../../lib/supabase';

interface VocabFormProps {
  editingVocab?: Vocabulary | null;
  addingVocabulary?: Vocabulary | null;
  onSave: (vocab: Partial<Vocabulary>) => void;
  onCancel?: () => void;
  loading?: boolean;
}

export function VocabForm({ editingVocab, addingVocabulary, onSave, onCancel, loading }: VocabFormProps) {
  const [id, setId] = useState(0);
  const [text, setText] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [partOfSpeech, setPartOfSpeech] = useState('');
  const [sentences, setSentences] = useState('');
  const [note, setNote] = useState('');
  const [languageCode, setLanguageCode] = useState<LanguageCode>('en');
  const [isDraft, setIsDraft] = useState(false);
  const [searchResults, setSearchResults] = useState<Vocabulary[]>([]);
  // const [isSearching, setIsSearching] = useState(false);
  // const [searchError, setSearchError] = useState<string | null>(null);
  // const [isInputFocused, setIsInputFocused] = useState(false);
  // const inputRef = useRef<HTMLInputElement | null>(null);
  // const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);


  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef(null);


  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: any) => {
      if (wrapperRef.current && !(wrapperRef.current as any).contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);



  const { t } = useLanguage();
  // const shouldShowSearch = !editingVocab && !addingVocabulary;

  useEffect(() => {
    if (editingVocab) {
      setText(editingVocab.text);
      setPhonetic(editingVocab.phonetic || '');
      setPartOfSpeech(editingVocab.part_of_speech || '');
      setSentences(editingVocab.sentences ? JSON.stringify(editingVocab.sentences) : '');
      setNote(editingVocab.note || '');
      setLanguageCode(editingVocab.language_code);
      setIsDraft(editingVocab.is_draft);
    } else {
      resetForm();
    }
  }, [editingVocab]);

  const resetForm = () => {
    setText('');
    setPhonetic('');
    setPartOfSpeech('');
    setSentences('');
    setNote('');
    setLanguageCode('en');
    setIsDraft(false);
    setSearchResults([]);
  };

  useEffect(() => {
    // if (!shouldShowSearch || text.trim().length < 2) {
    //   setIsSearching(false);
    //   setSearchResults([]);
    //   setSearchError(null);
    //   return;
    // }

    // let isCancelled = false;
    // setIsSearching(true);
    // setSearchError(null);

    const handler = setTimeout(async () => {
      try {
        const { data } =
          await supabase
            .from('tm_vocabulary')
            .select('*')
            .eq('language_code', languageCode)
            .ilike('text', `%${text.trim()}%`)
            .limit(8);

        // if (!isCancelled) {
        //   if (error) throw error;

        if(id){
          resetForm()
          setId(0)
        }
        setSearchResults(data || []);
        if (data && !showDropdown && !id) {
          setShowDropdown(true)
        }

        //   setSearchError(null);
        // }
      } catch (error) {
        // if (!isCancelled) {
        //   console.error('Error searching vocabulary:', error);
        //   setSearchError('Something went wrong while searching');
        // }
      } finally {
        // if (!isCancelled) {
        //   setIsSearching(false);
        // }
      }
    }, 300);

    return () => {
      // isCancelled = true;
      clearTimeout(handler);
    };
    // }, [text, languageCode, shouldShowSearch]);
  }, [text, languageCode]);

  const handleSelectSuggestion = (vocab: Vocabulary) => {
    setId(vocab?.id)
    setText(vocab.text);
    setPhonetic(vocab.phonetic || '');
    setPartOfSpeech(vocab.part_of_speech || '');
    setSentences(vocab.sentences ? vocab.sentences.join('\n') : '');
    setNote(vocab.note || '');
    setLanguageCode(vocab.language_code);
    setIsDraft(vocab.is_draft);
    setSearchResults([]);
    setShowDropdown(false);
    // setSearchError(null);
    // setIsInputFocused(false);
    // if (blurTimeoutRef.current) {
    //   clearTimeout(blurTimeoutRef.current);
    // }
    // inputRef.current?.blur();
  };

  // useEffect(() => {
  //   return () => {
  //     if (blurTimeoutRef.current) {
  //       clearTimeout(blurTimeoutRef.current);
  //     }
  //   };
  // }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;



    const sentencesArray = sentences.trim() ? sentences.split('\n').filter(s => s.trim()) : [];
    if (!id) {
      onSave({
        ...(editingVocab || {}),
        text,
        phonetic: phonetic || null,
        part_of_speech: partOfSpeech as PartOfSpeech | null,
        sentences: sentencesArray.length > 0 ? sentencesArray : null,
        note: note || null,
        language_code: languageCode,
        is_draft: isDraft,
      });

      if (!editingVocab) {
        resetForm();
      }
    } else{
    // Create a new vocab entry in supabase, mapping with id and addingVocabulary.id
    if (addingVocabulary && addingVocabulary.id) {
      (async () => {
        try {
          const { error } = await supabase
            .from('tm_vocabulary_map')
            .insert([
              {
                target_id: id,
                source_id: addingVocabulary.id
              }
            ]);
          if (error) {
            console.error("Error mapping vocab ids:", error);
            // Optionally: handle error UI feedback
          } else {
            // Optionally: show success / continue flow
          }
        } catch (err) {
          console.error("Unexpected error mapping vocab ids:", err);
        }
      })();
    }
    }
  };

  console.log("searchResults: ", searchResults, showDropdown)
  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
      <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
        {editingVocab ? t('vocabulary.editVocab') : t('vocabulary.createVocab')}
      </h2>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              {t('vocabulary.language')}
            </label>
            <select
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value as LanguageCode)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            >
              <option value="en">English</option>
              <option value="bn">Bangla</option>
            </select>
          </div>
          {!addingVocabulary ? (
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                {t('vocabulary.text')}
              </label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
          ) : (
            <div ref={wrapperRef} className="relative w-full">
              <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Vocabulary
              </label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onFocus={() => setShowDropdown(searchResults.length > 0)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Type a word..."
              />

              {showDropdown && searchResults.length > 0 && (
                <ul className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
                  {searchResults.map((item, index) => (
                    <li
                      key={index}
                      className="px-3 py-2 hover:bg-blue-100 dark:hover:bg-gray-600 cursor-pointer"
                      onClick={() => {
                        // setText(item.text);
                        handleSelectSuggestion(item)
                      }}
                    >
                      <span className='dark:text-white'>{item.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              {t('vocabulary.phonetic')}
            </label>
            <input
              type="text"
              value={phonetic}
              onChange={(e) => setPhonetic(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              {t('vocabulary.partOfSpeech')}
            </label>
            <input
              type="text"
              value={partOfSpeech}
              onChange={(e) => setPartOfSpeech(e.target.value)}
              placeholder="noun, verb, adjective..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t('vocabulary.sentences')}
          </label>
          <textarea
            value={sentences}
            onChange={(e) => setSentences(e.target.value)}
            placeholder={t('vocabulary.sentences')}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            rows={1}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('vocabulary.sentencesHint')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t('vocabulary.note')}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
            rows={1}
          />
        </div>

        <label className="flex items-center">
          <input
            type="checkbox"
            checked={isDraft}
            onChange={(e) => setIsDraft(e.target.checked)}
            className="mr-2"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">{t('vocabulary.isDraft')}</span>
        </label>

        <div className="flex justify-end space-x-2 pt-4">
          {(editingVocab || addingVocabulary) && (
            <button
              type="button"
              onClick={() => {
                onCancel?.();
                resetForm();
              }}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
            >
              {t('vocabulary.cancel')}
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {addingVocabulary ? t('vocabulary.add') : t('vocabulary.save')}
          </button>
        </div>
      </div>
    </form>
  );
}
