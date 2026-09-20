import { useEffect, useMemo, useState } from 'react';
import {
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfDay, endOfDay,
  addDays, subDays, addWeeks, subWeeks, addMonths, subMonths,
  isToday, isFuture, isSameWeek, isSameMonth, isAfter, format,
} from 'date-fns';
import type { FilterPreset } from '../components/ui/DateRangeFilter';

export function usePeriodNav(preset: FilterPreset, customFrom: string, customTo: string) {
  const [periodAnchor, setPeriodAnchor] = useState(new Date());

  useEffect(() => {
    setPeriodAnchor(new Date());
  }, [preset]);

  const shiftPeriod = (direction: 1 | -1) => {
    setPeriodAnchor(prev => {
      switch (preset) {
        case 'daily':
          return direction === 1 ? addDays(prev, 1) : subDays(prev, 1);
        case 'weekly':
          return direction === 1 ? addWeeks(prev, 1) : subWeeks(prev, 1);
        case 'monthly':
          return direction === 1 ? addMonths(prev, 1) : subMonths(prev, 1);
        default:
          return prev;
      }
    });
  };

  const dateRange = useMemo(() => {
    switch (preset) {
      case 'daily':
        return { from: startOfDay(periodAnchor), to: endOfDay(periodAnchor) };
      case 'weekly':
        return { from: startOfWeek(periodAnchor), to: endOfWeek(periodAnchor) };
      case 'monthly':
        return { from: startOfMonth(periodAnchor), to: endOfMonth(periodAnchor) };
      case 'custom':
        return { from: startOfDay(new Date(customFrom)), to: endOfDay(new Date(customTo)) };
      default:
        return null;
    }
  }, [preset, periodAnchor, customFrom, customTo]);

  const isNextPeriodDisabled = useMemo(() => {
    const now = new Date();
    switch (preset) {
      case 'daily':
        return isToday(periodAnchor) || isFuture(periodAnchor);
      case 'weekly':
        return isSameWeek(periodAnchor, now) || isAfter(startOfWeek(periodAnchor), now);
      case 'monthly':
        return isSameMonth(periodAnchor, now) || isAfter(startOfMonth(periodAnchor), now);
      default:
        return true;
    }
  }, [preset, periodAnchor]);

  const periodLabel = useMemo(() => {
    switch (preset) {
      case 'daily':
        return format(periodAnchor, 'MMMM d, yyyy');
      case 'weekly':
        return `${format(startOfWeek(periodAnchor), 'MMM d')} - ${format(endOfWeek(periodAnchor), 'MMM d, yyyy')}`;
      case 'monthly':
        return format(periodAnchor, 'MMMM yyyy');
      default:
        return null;
    }
  }, [preset, periodAnchor]);

  return { dateRange, shiftPeriod, isNextPeriodDisabled, periodLabel };
}
