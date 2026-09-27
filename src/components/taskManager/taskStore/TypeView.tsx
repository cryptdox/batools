import type { ToDoTask, TaskTag } from '../../../types/taskManager';
import { TaskItem } from './TaskItem';

interface TypeViewProps {
  type: 'one_time' | 'always' | 'progress';
  tasks: ToDoTask[];
  tags: TaskTag[];
  onEdit: (task: ToDoTask) => void;
  onDelete: (task: ToDoTask) => void;
  onDone: (task: ToDoTask) => void;
}

export function TypeView({ type, tasks, tags, onEdit, onDelete, onDone }: TypeViewProps) {
  const typeTasks = tasks.filter((task) => task.to_do_type === type && !task.archived);

  if (typeTasks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold capitalize text-gray-900 dark:text-white border-b pb-2">
        {type.replace('_', ' ')}
      </h3>
      <div className="space-y-3">
        {typeTasks.map((task) => (
          <TaskItem
            key={task.id}
            task={task}
            tags={tags}
            onEdit={onEdit}
            onDelete={onDelete}
            onDone={onDone}
          />
        ))}
      </div>
    </div>
  );
}
