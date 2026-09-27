import { useState, useEffect } from 'react';
import { tmUser } from '../../lib/taskManagerUser';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import type { TaskType, TaskTag } from '../../types/taskManager';
import Notification from '../../components/taskManager/Notification';
import ConfirmPopup from '../../components/taskManager/ConfirmPopup';

const predefinedColors = [
  '#00a8ff', '#9c88ff', '#fbc531', '#4cd137', '#487eb0',
  '#0097e6', '#8c7ae6', '#e1b12c', '#44bd32', '#40739e',
  '#e84118', '#f5f6fa', '#7f8fa6', '#273c75', '#353b48',
  '#c23616', '#dcdde1', '#718093', '#192a56', '#2f3640'
];

export function AdministrationPage() {
  const user = tmUser;
  const { t } = useLanguage();

  const [types, setTypes] = useState<TaskType[]>([]);
  const [tags, setTags] = useState<TaskTag[]>([]);

  const [editingType, setEditingType] = useState<TaskType | null>(null);
  const [typeName, setTypeName] = useState('');
  const [typeColor, setTypeColor] = useState(predefinedColors[0]);

  const [editingTag, setEditingTag] = useState<TaskTag | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState(predefinedColors[0]);

  const [show, setShow] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"success" | "error" | "info" | "warning">();
  const [duration, setDuration] = useState(4000)

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string>("");
  const [confirmHandler, setConfirmHandler] = useState<(() => void) | null>(null);

  const setNotification = (message: string, type: "success" | "error" | "info" | "warning" = "success", duration: number = 4000) => {
    setShow(true)
    setMessage(message)
    setType(type)
    setDuration(duration)
    setTimeout(() => setShow(false), duration)
  }

  const setConfirm = (onConfirm: () => void, message: string = "Are you sure?") => {
    setConfirmHandler(() => onConfirm); // store callback
    setConfirmMessage(message);
    setIsConfirmOpen(true);
  };

  const handleConfirm = () => {
    confirmHandler && confirmHandler();
    setIsConfirmOpen(false);
  };

  const handleCancel = () => setIsConfirmOpen(false);

  useEffect(() => {
    if (user) {
      loadTypes();
      loadTags();
    }
  }, [user]);

  const loadTypes = async () => {
    const { data, error } = await supabase
      .from('tm_task_type')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTypes(data);
    }
  };

  const loadTags = async () => {
    const { data, error } = await supabase
      .from('tm_task_tag')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setTags(data);
    }
  };

  const handleCreateOrUpdateType = async () => {
    if (!typeName.trim()) return;

    const typeData = {
      name: typeName,
      color: typeColor,
      user_id: user!.id
    };

    if (editingType) {
      const { error } = await supabase
        .from('tm_task_type')
        .update(typeData)
        .eq('id', editingType.id);
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      });
      if (!error) {
        loadTypes();
        resetTypeForm();
      }
    } else {
      const { error } = await supabase
        .from('tm_task_type')
        .insert([typeData]);
      const targetId = "task_type"
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        console.warn(`Element with id "${targetId}" not found.`);
      }
      setNotification("Successfully created!")
      if (!error) {
        loadTypes();
        resetTypeForm();
      }
    }
  };

  const handleEditType = (type: TaskType) => {
    setEditingType(type);
    setTypeName(type.name);
    setTypeColor(type.color);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteType = async (id: string) => {
    const { error } = await supabase
      .from('tm_task_type')
      .delete()
      .eq('id', id);

    setNotification("Successfully deleted!", "info")
    if (!error) {
      loadTypes();
    }
  };

  const resetTypeForm = () => {
    setEditingType(null);
    setTypeName('');
    setTypeColor(predefinedColors[0]);
  };

  const handleCreateOrUpdateTag = async () => {
    if (!tagName.trim()) return;

    const tagData = {
      name: tagName,
      color: tagColor,
      user_id: user!.id
    };

    if (editingTag) {
      const { error } = await supabase
        .from('tm_task_tag')
        .update(tagData)
        .eq('id', editingTag.id);
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      });

      if (!error) {
        loadTags();
        resetTagForm();
      }
    } else {
      const { error } = await supabase
        .from('tm_task_tag')
        .insert([tagData]);
      const targetId = "task_tag"
      const element = document.getElementById(targetId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        console.warn(`Element with id "${targetId}" not found.`);
      }
      setNotification("Successfully created!")
      if (!error) {
        loadTags();
        resetTagForm();
      }
    }
  };

  const handleEditTag = (tag: TaskTag) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteTag = async (id: string) => {
    const { error } = await supabase
      .from('tm_task_tag')
      .delete()
      .eq('id', id);

    setNotification("Successfully deleted!", "info")
    if (!error) {
      loadTags();
    }
  };

  const resetTagForm = () => {
    setEditingTag(null);
    setTagName('');
    setTagColor(predefinedColors[0]);
  };

  // The Task Types panel is commented out in the JSX below -- it arrived that way
  // from the standalone app, and the source table had no rows. The state and
  // handlers are kept so the panel can be switched back on by uncommenting the
  // markup, rather than having to be rebuilt; these references exist only to
  // satisfy the stricter noUnusedLocals in this project.
  void types; void handleEditType; void handleDeleteType; void handleCreateOrUpdateType;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{t('admin.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('admin.subtitle')}</p>
        </div>
      </div>
      <div>
        {/* <h1 className="text-4xl font-bold mb-8 text-gray-800 dark:text-white text-center">
          {t('admin.title')}
        </h1> */}

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
        {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-8"> */}
          {/* <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-white">
                {editingType ? t('admin.editType') : t('admin.createType')}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin.name')}
                  </label>
                  <input
                    type="text"
                    value={typeName}
                    onChange={(e) => setTypeName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#00a8ff] transition-all"
                    placeholder={t('admin.name')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin.color')}
                  </label>
                  <div className="grid grid-cols-10 gap-2">
                    {predefinedColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setTypeColor(color)}
                        className={`w-10 h-10 rounded-lg transition-all transform hover:scale-110 ${typeColor === color ? 'ring-4 ring-offset-2 ring-gray-400 dark:ring-gray-600' : ''
                          }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleCreateOrUpdateType}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#00a8ff] to-[#0097e6] text-white rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300"
                  >
                    {editingType ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    {t('admin.save')}
                  </button>
                  {editingType && (
                    <button
                      onClick={resetTypeForm}
                      className="flex items-center gap-2 px-6 py-3 bg-gray-500 text-white rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300"
                    >
                      <X className="w-5 h-5" />
                      {t('admin.cancel')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6" id="task_type">
              <h2 className="text-2xl font-semibold mb-6 text-gray-800 dark:text-white">
                {t('admin.taskTypes')} ({types.length})
              </h2>

              {types.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  {t('admin.noTypes')}
                </p>
              ) : (
                <div className="space-y-3">
                  {types.map((type) => (
                    <div
                      key={type.id}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-all duration-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg"
                            style={{ backgroundColor: type.color }}
                          />
                          <span className="text-gray-800 dark:text-white font-medium">
                            {type.name}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditType(type)}
                            className="p-2 text-[#00a8ff] hover:bg-[#00a8ff] hover:text-white rounded-lg transition-all transform hover:scale-110"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setConfirm(() => handleDeleteType(type.id))}
                            className="p-2 text-[#e84118] hover:bg-[#e84118] hover:text-white rounded-lg transition-all transform hover:scale-110"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div> */}

          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-white">
                {editingTag ? t('admin.editTag') : t('admin.createTag')}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin.name')}
                  </label>
                  <input
                    type="text"
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#9c88ff] transition-all"
                    placeholder={t('admin.name')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('admin.color')}
                  </label>
                  <div className="grid grid-cols-10 gap-2">
                    {predefinedColors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setTagColor(color)}
                        className={`w-8 h-8 rounded-lg transition-all transform hover:scale-110 ${tagColor === color ? 'ring-4 ring-offset-2 ring-gray-400 dark:ring-gray-600' : ''
                          }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleCreateOrUpdateTag}
                    className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-[#9c88ff] to-[#8c7ae6] text-white rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300"
                  >
                    {editingTag ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    {t('admin.save')}
                  </button>
                  {editingTag && (
                    <button
                      onClick={resetTagForm}
                      className="flex items-center gap-2 px-6 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300"
                    >
                      <X className="w-5 h-5" />
                      {t('admin.cancel')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6" id="task_tag">
              <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-white">
                {t('admin.taskTags')} ({tags.length})
              </h2>

              {tags.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  {t('admin.noTags')}
                </p>
              ) : (
                <div className="space-y-3">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-all duration-300"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="text-gray-800 dark:text-white font-medium">
                            {tag.name}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditTag(tag)}
                            className="p-2 text-[#9c88ff] hover:bg-[#9c88ff] hover:text-white rounded-lg transition-all transform hover:scale-110"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => {
                              setConfirmHandler(() => setConfirm(() => handleDeleteTag(tag.id)))
                            }}
                            className="p-2 text-[#e84118] hover:bg-[#e84118] hover:text-white rounded-lg transition-all transform hover:scale-110"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {show && (
        <Notification
          message={message}
          type={type}
          duration={duration}
        />
      )}
      <ConfirmPopup
        isOpen={isConfirmOpen}
        message={confirmMessage}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}
