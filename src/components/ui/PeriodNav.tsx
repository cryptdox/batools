import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface PeriodNavProps {
  label: string | null;
  onPrev: () => void;
  onNext: () => void;
  nextDisabled: boolean;
}

export const PeriodNav = ({ label, onPrev, onNext, nextDisabled }: PeriodNavProps) => {
  if (!label) return null;
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" className="rounded-full w-9 h-9 p-0 flex items-center justify-center" onClick={onPrev}>
        <ChevronLeft size={18} />
      </Button>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-[10rem] text-center">{label}</span>
      <Button variant="ghost" size="sm" className="rounded-full w-9 h-9 p-0 flex items-center justify-center" onClick={onNext} disabled={nextDisabled}>
        <ChevronRight size={18} />
      </Button>
    </div>
  );
};
