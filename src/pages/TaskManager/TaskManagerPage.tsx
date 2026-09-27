import { useState, useEffect } from 'react';
import { tmUser } from '../../lib/taskManagerUser';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import type { Task, TaskTag, TaskPeriod } from '../../types/taskManager';
import ConfirmPopup from '../../components/taskManager/ConfirmPopup';
import Notification from '../../components/taskManager/Notification';

export function TaskManagerPage() {
  const user = tmUser;
  const { t } = useLanguage();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<TaskTag[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dateRangeType, setDateRangeType] = useState<'day' | 'week' | 'month'>('day');
  const [selectedPeriod, setSelectedPeriod] = useState<TaskPeriod | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');

  const [persistTask, setPersistTask] = useState<boolean>(false);
  const [persistDate, setPersistDate] = useState<boolean>(false);
  const [persistPeriod, setPersistPeriod] = useState<boolean>(false);
  const [persistTag, setPersistTag] = useState<boolean>(false);

  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskText, setTaskText] = useState('');
  const [taskPeriod, setTaskPeriod] = useState<TaskPeriod>('morning');
  const [taskTag, setTaskTag] = useState<string>('');
  const [taskDate, setTaskDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [show, setShow] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<"success" | "error" | "info" | "warning">();
  const [duration, setDuration] = useState(4000)

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string>("");
  const [confirmHandler, setConfirmHandler] = useState<(() => void) | null>(null);

  const [inProgress, setInProgress] = useState(false);

  const changeDateByDays = (days: number) => {
    if (!taskDate) return;

    const date = new Date(taskDate);
    date.setDate(date.getDate() + days);

    setTaskDate(date.toISOString().split('T')[0]);
  };

  const setNotification = (message: string, type: "success" | "error" | "info" | "warning" = "success", duration: number = 4000) => {
    setShow(true)
    setMessage(message)
    setType(type)
    setDuration(duration)
    setTimeout(() => setShow(false), duration)
  }

  const setConfirm = (onConfirm: () => void, message: string = "Are you sure?") => {
    setConfirmHandler(() => onConfirm);
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
      loadTags();
      loadTasks();
    }
  }, [user]);

  const loadTags = async () => {
    const { data, error } = await supabase
      .from('tm_task_tag')
      .select('*')
      .eq('user_id', user!.id);

    if (!error && data) setTags(data);
  };

  const loadTasks = async () => {
    const { data, error } = await supabase
      .from('tm_task')
      .select('*')
      .eq('user_id', user!.id)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });

    if (!error && data) setTasks(data);
  };

  const resetForm = () => {
    setEditingTask(null);
    !persistTask && setTaskText('');
    !persistPeriod && setTaskPeriod('morning');
    !persistTag && setTaskTag('');
    !persistDate && setTaskDate(new Date().toISOString().split('T')[0]);
  };

  const handleCreateOrUpdate = async () => {
    if (!taskText.trim()) return;
    setInProgress(true)

    const taskData = {
      task: taskText,
      task_period: taskPeriod,
      task_tag: taskTag || null,
      date: taskDate,
      user_id: user!.id
    };

    if (editingTask) {
      const { error } = await supabase
        .from('tm_task')
        .update(taskData)
        .eq('id', editingTask.id);

      setNotification("Successfully updated!")
      if (!error) {
        loadTasks();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('tm_task')
        .insert([taskData]);

      setNotification("Successfully created!")
      if (!error) {
        loadTasks();
        resetForm();
      }
    }
    setInProgress(false)
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setTaskText(task.task);
    setTaskPeriod(task.task_period);
    setTaskTag(task.task_tag || '');
    setTaskDate(task.date);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('tm_task')
      .delete()
      .eq('id', id);

    setNotification("Successfully deleted!", "info")
    if (!error) loadTasks();
  };

  // -------------------
  // Date Range Helpers
  // -------------------
  const getRangeDisplay = () => {
    const date = new Date(selectedDate);
    if (dateRangeType === 'day') {
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
    if (dateRangeType === 'week') {
      const startOfWeek = new Date(date);
      startOfWeek.setDate(date.getDate() - date.getDay()); // Sunday
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      return `${startOfWeek.toLocaleDateString()} - ${endOfWeek.toLocaleDateString()}`;
    }
    if (dateRangeType === 'month') {
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      return `${startOfMonth.toLocaleDateString()} - ${endOfMonth.toLocaleDateString()}`;
    }
  };

  const incrementRange = () => {
    const date = new Date(selectedDate);
    const today = new Date();
    if (dateRangeType === 'day') {
      date.setDate(date.getDate() + 1);
      if (date <= today) setSelectedDate(date.toISOString().split('T')[0]);
    } else if (dateRangeType === 'week') {
      date.setDate(date.getDate() + 7);
      if (date <= today) setSelectedDate(date.toISOString().split('T')[0]);
    } else if (dateRangeType === 'month') {
      date.setMonth(date.getMonth() + 1);
      if (date <= today) setSelectedDate(date.toISOString().split('T')[0]);
    }
  };

  const decrementRange = () => {
    const date = new Date(selectedDate);
    if (dateRangeType === 'day') {
      date.setDate(date.getDate() - 1);
    } else if (dateRangeType === 'week') {
      date.setDate(date.getDate() - 7);
    } else if (dateRangeType === 'month') {
      date.setMonth(date.getMonth() - 1);
    }
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  // -------------------
  // Filter tasks based on range, period, tag
  // -------------------
  const filteredTasks = tasks.filter(task => {
    const taskDateObj = new Date(task.date);
    const selectedDateObj = new Date(selectedDate);

    let inRange = false;
    if (dateRangeType === 'day') {
      inRange = task.date === selectedDate;
    } else if (dateRangeType === 'week') {
      const startOfWeek = new Date(selectedDateObj);
      startOfWeek.setDate(selectedDateObj.getDate() - selectedDateObj.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      inRange = taskDateObj >= startOfWeek && taskDateObj <= endOfWeek;
    } else if (dateRangeType === 'month') {
      const startOfMonth = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), 1);
      const endOfMonth = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth() + 1, 0);
      inRange = taskDateObj >= startOfMonth && taskDateObj <= endOfMonth;
    }

    const periodMatch = selectedPeriod === 'all' || task.task_period === selectedPeriod;
    const tagMatch = selectedTag === 'all' || task.task_tag === selectedTag;

    return inRange && periodMatch && tagMatch;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{t('taskManager.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('taskManager.subtitle')}</p>
        </div>
      </div>
      <div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 lg:sticky lg:top-0 space-y-6">
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white">
                {t('taskManager.filters')}
              </h2>
              {/* --- Date Range Filter --- */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setDateRangeType('day');
                      }}
                      className="w-9 h-9 opacity-0 absolute inset-0 cursor-pointer"
                    />
                    <div className="w-9 h-9 flex items-center justify-center bg-gray-200 dark:bg-gray-700 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all cursor-pointer">
                      📅
                    </div>
                  </div>
                  {['day', 'week', 'month'].map(type => (
                    <button
                      key={type}
                      onClick={() => setDateRangeType(type as 'day' | 'week' | 'month')}
                      className={`px-3 py-1 rounded-lg font-semibold transition-all ${dateRangeType === type
                        ? 'bg-[#00a8ff] text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                        }`}
                    >
                      {t(`taskManager.${type}`)}
                    </button>
                  ))}
                </div>

                <div className="flex items-center mt-2">
                  <button
                    onClick={decrementRange}
                    className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-l-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                  >
                    ◀
                  </button>

                  <div className="flex-1 text-center px-4 py-2 border-t border-b border-gray-300 dark:border-gray-600 bg-gradient-to-r from-[#00a8ff] to-[#9c88ff] text-white font-semibold shadow-md">
                    {getRangeDisplay()}
                  </div>

                  <button
                    onClick={incrementRange}
                    className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-r-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
                  >
                    ▶
                  </button>
                </div>
              </div>

              {/* --- Scrollable Filters (Period + Tag) --- */}
              <div
                className="overflow-y-auto"
                style={{
                  maxHeight: 'calc(100% - 10rem)', // adjust depending on header + date filter height
                }}
              >
                {/* --- Period Filter --- */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('taskManager.period')}
                  </label>
                  <div className="space-y-2">
                    {['all', 'morning', 'day', 'night'].map((period) => (
                      <label key={period} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="period"
                          checked={selectedPeriod === period}
                          onChange={() => setSelectedPeriod(period as TaskPeriod | 'all')}
                          className="w-4 h-4 text-[#00a8ff] focus:ring-[#00a8ff]"
                        />
                        <span className="text-gray-700 dark:text-gray-300 capitalize">
                          {t(`taskManager.${period}`)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* --- Tag Filter --- */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('taskManager.tag')}
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="tag"
                        checked={selectedTag === 'all'}
                        onChange={() => setSelectedTag('all')}
                        className="w-4 h-4 text-[#00a8ff] focus:ring-[#00a8ff]"
                      />
                      <span className="text-gray-700 dark:text-gray-300">
                        {t('taskManager.all')}
                      </span>
                    </label>
                    {tags.map((tag) => (
                      <label key={tag.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="tag"
                          checked={selectedTag === tag.id}
                          onChange={() => setSelectedTag(tag.id)}
                          className="w-4 h-4 text-[#00a8ff] focus:ring-[#00a8ff]"
                        />
                        <span
                          className="px-3 py-1 rounded-full text-white text-sm font-medium"
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* --- Tasks + Create Form --- */}
          <div className="lg:col-span-2 space-y-6">
            {/* --- Create/Update Task --- */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-white">
                {editingTask ? t('taskManager.updateTask') : t('taskManager.createTask')}
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('taskManager.taskDescription')}
                  </label>
                  <textarea
                    value={taskText}
                    onChange={(e) => setTaskText(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#00a8ff] transition-all"
                    rows={1}
                    placeholder={t('taskManager.taskDescription')}
                  />
                  <label className="flex items-center space-x-2 mt-2">
                    <input
                      type="checkbox"
                      checked={persistTask}
                      onChange={(e) => setPersistTask(e.target.checked)}
                      className="w-4 h-4 text-[#00a8ff] focus:ring-[#00a8ff]"
                    />
                    <span className="text-sm text-gray-800 dark:text-gray-200">{t('taskManager.persistTask')}</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('taskManager.period')}
                    </label>
                    <select
                      value={taskPeriod}
                      onChange={(e) => setTaskPeriod(e.target.value as TaskPeriod)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#00a8ff] transition-all"
                    >
                      <option value="morning">{t('taskManager.morning')}</option>
                      <option value="day">{t('taskManager.day')}</option>
                      <option value="night">{t('taskManager.night')}</option>
                    </select>
                    <label className="flex items-center space-x-2 mt-2">
                      <input type="checkbox" checked={persistPeriod} onChange={(e) => setPersistPeriod(e.target.checked)} />
                      <span className="text-sm text-gray-800 dark:text-gray-200">{t('taskManager.persistPeriod')}</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('taskManager.tag')}
                    </label>
                    <select
                      value={taskTag}
                      onChange={(e) => setTaskTag(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#00a8ff] transition-all"
                    >
                      <option value="">{t('taskManager.selectTag')}</option>
                      {tags.map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center space-x-2 mt-2">
                      <input type="checkbox" checked={persistTag} onChange={(e) => setPersistTag(e.target.checked)} />
                      <span className="text-sm text-gray-800 dark:text-gray-200">{t('taskManager.persistTag')}</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('taskManager.date')}
                    </label>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => changeDateByDays(-1)}
                        className="px-1 py-1 border rounded-lg bg-gray-100 dark:bg-gray-700"
                      >
                        ←
                      </button>

                      <input
                        type="date"
                        value={taskDate}
                        onChange={(e) => setTaskDate(e.target.value)}
                        className="flex-1 px-4 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#00a8ff] transition-all"
                      />

                      <button
                        type="button"
                        onClick={() => changeDateByDays(1)}
                        className="px-1 py-1 border rounded-lg bg-gray-100 dark:bg-gray-700"
                      >
                        →
                      </button>
                    </div>

                    <label className="flex items-center space-x-2 mt-2">
                      <input
                        type="checkbox"
                        checked={persistDate}
                        onChange={(e) => setPersistDate(e.target.checked)}
                      />
                      <span className="text-sm text-gray-800 dark:text-gray-200">
                        {t('taskManager.persistDate')}
                      </span>
                    </label>
                  </div>
                </div>

                <div className={`flex gap-3 ${inProgress && 'pointer-events-none'}`}>
                  <button
                    onClick={handleCreateOrUpdate}
                    className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-[#4cd137] to-[#44bd32] text-white rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300"
                  >
                    {editingTask ? <Save className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                    {editingTask ? t('taskManager.save') : t('taskManager.createTask')}
                  </button>
                  {editingTask && (
                    <button
                      onClick={resetForm}
                      className="flex items-center gap-2 px-6 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300"
                    >
                      <X className="w-5 h-5" />
                      {t('taskManager.cancel')}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* --- Task List --- */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6" id="tasks">
              <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-white">
                Tasks ({filteredTasks.length})
              </h2>

              {filteredTasks.length === 0 ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  {t('taskManager.noTasks')}
                </p>
              ) : (
                <div className="space-y-6">
                  {[
                    { key: 'morning', color: 'text-yellow-500' },
                    { key: 'day', color: 'text-green-500' },
                    { key: 'night', color: 'text-purple-500' }
                  ].map(({ key, color }) => {
                    const tasksByPeriod = filteredTasks.filter(task => task.task_period === key);
                    if (!tasksByPeriod.length) return null;

                    return (
                      <div key={key}>
                        <h3 className={`text-xl font-semibold mb-4 capitalize ${color}`}>
                          {t(`taskManager.${key}`)}
                        </h3>
                        <div className="space-y-3">
                          {tasksByPeriod.map((task) => {
                            const tag = tags.find(t => t.id === task.task_tag);
                            return (
                              <div
                                key={task.id}
                                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-md transition-all duration-300 transform hover:scale-102"
                              >
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex-1">
                                    <p className="text-gray-800 dark:text-white font-medium mb-2">
                                      {task.task}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      <span className="px-3 py-1 bg-[#00a8ff] text-white text-xs rounded-full">
                                        {task.date}
                                      </span>
                                      {tag && (
                                        <span
                                          className="px-3 py-1 text-white text-xs rounded-full"
                                          style={{ backgroundColor: tag.color }}
                                        >
                                          {tag.name}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleEdit(task)}
                                      className="p-2 text-[#00a8ff] hover:bg-[#00a8ff] hover:text-white rounded-lg transition-all transform hover:scale-110"
                                    >
                                      <Edit2 className="w-5 h-5" />
                                    </button>
                                    <button
                                      onClick={() => setConfirm(() => handleDelete(task.id))}
                                      className="p-2 text-[#e84118] hover:bg-[#e84118] hover:text-white rounded-lg transition-all transform hover:scale-110"
                                    >
                                      <Trash2 className="w-5 h-5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
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
