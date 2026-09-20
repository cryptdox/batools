import { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { getDhakaTimeOfDay } from '../../lib/dhakaTime';

interface TimeEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (timeString: string | null) => void;
  initialTime?: string | null;  // ISO string
}

export const TimeEditor = ({ isOpen, onClose, onSave, initialTime }: TimeEditorProps) => {
  const [time, setTime] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialTime) {
        setTime(getDhakaTimeOfDay(initialTime).slice(0, 5));
      } else {
        setTime('');
      }
    }
  }, [isOpen, initialTime]);

  const handleSave = () => {
    if (!time) {
      onSave(null);
      return;
    }
    
    // We assume the date is the same as the initialTime's date, or today's date if null.
    // The parent creates the final ISO string, so we'll just pass '{HH:mm}' or format it properly.
    // But since the parent might want a full ISO string to update the DB, let's construct it.
    
    // Actually, passing back the HH:mm is sufficient if the parent combines it with selectedDate.
    onSave(time); // "HH:mm"
  };

  const handleClear = () => {
    setTime('');
    onSave(null);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change Entry Time">
      <div className="space-y-4">
        <Input 
          type="time" 
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="text-lg py-6 text-center tracking-widest"
        />
        
        <div className="flex justify-between gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
          <Button variant="danger" onClick={handleClear}>
            Clear Time
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Time
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
