import { useState, useEffect } from 'react';
import { tmUser } from '../../lib/taskManagerUser';
import { useLanguage } from '../../lib/LanguageContext';
import { supabase } from '../../lib/supabase';
import type { ToDoTask, TaskTag } from '../../types/taskManager';
import { FilterPanel } from '../../components/taskManager/taskStore/FilterPanel';
import { CreateForm } from '../../components/taskManager/taskStore/CreateForm';
import { TypeView } from '../../components/taskManager/taskStore/TypeView';
import { DoneModal } from '../../components/taskManager/taskStore/DoneModal';
import { ConfirmModal } from '../../components/taskManager/taskStore/ConfirmModal';

export function TaskStorePage() {
  const user = tmUser;
  const { t } = useLanguage();

  const [tasks, setTasks] = useState<ToDoTask[]>([]);
  const [tags, setTags] = useState<TaskTag[]>([]);
  const [archived, setArchived] = useState<boolean>(false);
  const [selectedTag, setSelectedTag] = useState('all');
  const [editingTask, setEditingTask] = useState<ToDoTask | null>(null);
  const [deletingTask, setDeletingTask] = useState<ToDoTask | null>(null);
  const [doneTask, setDoneTask] = useState<ToDoTask | null>(null);
  const [, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadTags();
      loadTasks();
    }
  }, [user]);

  const loadTags = async () => {
    try {
      const { data, error } = await supabase
        .from('tm_task_tag')
        .select('*')
        .eq('user_id', user!.id);

      if (!error && data) {
        setTags(data);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tm_to_do_task')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_on', { ascending: false });

      if (!error && data) {
        setTasks(data);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const handleSaveTask = async (task: Partial<ToDoTask>) => {
    if (!user) return;
    setLoading(true);

    try {
      if (editingTask) {
        const { error } = await supabase
          .from('tm_to_do_task')
          .update(task)
          .eq('id', editingTask.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tm_to_do_task')
          .insert([{ ...task, user_id: user.id, archived: false }]);
        if (error) throw error;
      }
      await loadTasks();
      setEditingTask(null);
    } catch (error) {
      console.error('Error saving task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('tm_to_do_task')
        .delete()
        .eq('id', taskId);
      if (error) throw error;
      await loadTasks();
      setDeletingTask(null);
    } catch (error) {
      console.error('Error deleting task:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDone = async (task: ToDoTask, data: { date: string; period: 'morning' | 'day' | 'night', submit_type: 'complete' | 'complete_full', note?: string; }) => {
    setLoading(true);
    try {
      let task_description = `[${data.submit_type === 'complete_full' ? 'Complete' : task.to_do_type != 'progress' ? 'Complete' : 'Update'}] ${task.description}${data?.note && ` [${data?.note}] `}`
      const newTask = {
        task: task_description,
        task_period: data.period,
        date: data.date,
        task_tag: task.task_tag,
        user_id: user!.id,
      };
      const { error: taskError } = await supabase
        .from('tm_task')
        .insert([newTask]);
      if (taskError) throw taskError;

      if (task.to_do_type === 'one_time' || (task.to_do_type === 'progress' && data?.submit_type === "complete_full")) {
        const { error: deleteError } = await supabase
          .from('tm_to_do_task')
          .delete()
          .eq('id', task.id);
        if (deleteError) throw deleteError;
      }
      await loadTasks();
      setDoneTask(null);
    } catch (error) {
      console.error('Error marking task as done:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = selectedTag === 'all'
    ? tasks
    : tasks.filter(task => task.task_tag === selectedTag && task.archived == archived);


  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">{t('taskStore.title')}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">{t('taskStore.subtitle')}</p>
        </div>
      </div>
      <div>
        {/* <h1 className="text-3xl font-bold mb-8 text-gray-800 dark:text-white">{t('nav.taskStore')}</h1> */}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <FilterPanel
              tags={tags}
              selectedTag={selectedTag}
              onTagChange={setSelectedTag}
              archived={archived}
              setArchived={setArchived}
            />
          </div>

          <div className="lg:col-span-3 space-y-6">
            <CreateForm
              editingTask={editingTask}
              tags={tags}
              onSave={handleSaveTask}
              onCancel={() => setEditingTask(null)}
            />

            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
              <h2 className="text-xl font-semibold mb-6 text-gray-800 dark:text-white">{t('taskStore.tasks')} ({filteredTasks.length})</h2>

              <div className="space-y-8">
                <TypeView
                  type="one_time"
                  tasks={filteredTasks}
                  tags={tags}
                  onEdit={setEditingTask}
                  onDelete={(task) => setDeletingTask(task)}
                  onDone={(task) => setDoneTask(task)}
                />

                <TypeView
                  type="always"
                  tasks={filteredTasks}
                  tags={tags}
                  onEdit={setEditingTask}
                  onDelete={(task) => setDeletingTask(task)}
                  onDone={(task) => setDoneTask(task)}
                />

                <TypeView
                  type="progress"
                  tasks={filteredTasks}
                  tags={tags}
                  onEdit={setEditingTask}
                  onDelete={(task) => setDeletingTask(task)}
                  onDone={(task) => setDoneTask(task)}
                />

                {filteredTasks.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">{t('taskManager.noTasks')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {doneTask && (
        <DoneModal
          task={doneTask}
          onSubmit={(data) => handleMarkDone(doneTask, data)}
          onClose={() => setDoneTask(null)}
        />
      )}

      {deletingTask && (
        <ConfirmModal
          title={t('taskStore.deleteTask')}
          message={t('taskStore.deleteConfirmation')}
          onConfirm={() => handleDeleteTask(deletingTask.id)}
          onClose={() => setDeletingTask(null)}
        />
      )}
    </div>
  );
}
