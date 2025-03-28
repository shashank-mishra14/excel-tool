import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ExcelRow {
  [key: string]: string | number;
  id: string;
}

interface ExcelStore {
  rows: ExcelRow[];
  columns: string[];
  setData: (rows: ExcelRow[], columns: string[]) => void;
  updateCell: (rowIndex: number, columnKey: string, value: string | number) => void;
}

// Helper function to calculate row values
const calculateRowValues = (row: ExcelRow): ExcelRow => {
  const rate = parseFloat(String(row['rateinusd_6'])) || 0;
  const boxes = parseFloat(String(row['totalnoofboxes_7'])) || 0;
  const qty = parseFloat(String(row['totalqty_8'])) || 0;
  
  return {
    ...row,
    'productvalueinusd_9': rate * boxes * qty,
    'discount_15': Math.min(rate * boxes * qty * 0.15, 50),
    'netamount_16': rate * boxes * qty - Math.min(rate * boxes * qty * 0.15, 50)
  };
};

export const useExcelStore = create<ExcelStore>()(
  devtools(
    (set) => ({
      rows: [],
      columns: [],
      setData: (rows: ExcelRow[], columns: string[]) => set({ rows, columns }),
      updateCell: (rowIndex: number, columnKey: string, value: string | number) => 
        set((state: ExcelStore) => {
          const row = state.rows[rowIndex];
          
          // Skip update if value hasn't changed
          if (row[columnKey] === value) {
            return state;
          }

          // Create new row with updated value
          const updatedRow = {
            ...row,
            [columnKey]: value
          };

          // Only recalculate if necessary
          if (['rateinusd_6', 'totalnoofboxes_7', 'totalqty_8'].includes(columnKey)) {
            const newRow = calculateRowValues(updatedRow);
            const newRows = [...state.rows];
            newRows[rowIndex] = newRow;
            return { rows: newRows };
          }

          // Simple update for non-calculated fields
          const newRows = [...state.rows];
          newRows[rowIndex] = updatedRow;
          return { rows: newRows };
        }),
    }),
    { name: 'excel-store' }
  )
);