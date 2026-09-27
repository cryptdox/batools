import { Edit, Trash2, CheckCircle } from 'lucide-react';
import type { ToDoTask, TaskTag } from '../../../types/taskManager';

interface TaskItemProps {
  task: ToDoTask;
  tags: TaskTag[];
  onEdit: (task: ToDoTask) => void;
  onDelete: (task: ToDoTask) => void;
  onDone: (task: ToDoTask) => void;
}

export function TaskItem({ task, tags, onEdit, onDelete, onDone }: TaskItemProps) {
  const getTagColor = (tagId: string | null) => {
    const tag = tags.find((t) => t.id === tagId);
    return tag?.color || '#666';
  };

  const getTagName = (tagId: string | null) => {
    const tag = tags.find((t) => t.id === tagId);
    return tag?.name || '';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white break-words">{task.description}</h3>
          {task.note && (
            <div
              className="text-xs text-gray-500 dark:text-gray-400 mt-2 border-l-2 border-gray-300 pl-2"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {task.note}
            </div>
          )}

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full capitalize">
              {task.to_do_type}
            </span>
            {task.task_tag && (
              <span
                className="px-3 py-1 text-white text-xs rounded-full"
                style={{ backgroundColor: getTagColor(task.task_tag) }}
              >
                {getTagName(task.task_tag)}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {new Date(task.created_on).toLocaleDateString()}
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => onEdit(task)}
            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900 rounded-full transition"
            title="Edit"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button
            onClick={() => onDelete(task)}
            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900 rounded-full transition"
            title="Delete"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => onDone(task)}
            className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900 rounded-full transition"
            title="Mark as Done"
          >
            <CheckCircle className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
