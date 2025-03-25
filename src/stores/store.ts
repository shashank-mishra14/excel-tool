import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface ExcelRow {
  [key: string]: string | number;
}

interface ExcelStore {
  rows: ExcelRow[];
  columns: string[];
  setData: (rows: ExcelRow[], columns: string[]) => void;
  updateCell: (rowIndex: number, columnKey: string, value: string | number) => void;
  getProcessedRows: () => ExcelRow[];
}

const calculateRowValues = (row: ExcelRow): ExcelRow => {
  const rate = parseFloat(String(row.rateinusd)) || 0;
  const boxes = parseFloat(String(row.totalnoofboxes)) || 0;
  const qty = parseFloat(String(row.totalqty)) || 0;
  
  const amount = rate * boxes * qty;
  const discount = Math.min(amount * 0.15, 50);
  const netAmount = amount - discount;
  
  return {
    ...row,
    productvalueinusd: amount,
    discount: discount,
    netamount: netAmount
  };
};

export const useExcelStore = create<ExcelStore>()(
  devtools(
    (set, get) => ({
      rows: [],
      columns: [],
      setData: (rows, columns) => {
        // Process all rows at once
        const processedRows = rows.map(row => calculateRowValues(row));
        set({ rows: processedRows, columns });
      },
      updateCell: (rowIndex, columnKey, value) => {
        set((state) => {
          const newRows = [...state.rows];
          const cleanKey = columnKey.toLowerCase().replace(/[^a-z0-9]/gi, '');
          
          // Only update if the value has changed
          if (newRows[rowIndex][cleanKey] === value) {
            return state;
          }

          newRows[rowIndex] = { 
            ...newRows[rowIndex], 
            [cleanKey]: value 
          };
          
          // Recalculate only if the updated field affects calculations
          if (['rateinusd', 'totalnoofboxes', 'totalqty'].includes(cleanKey)) {
            newRows[rowIndex] = calculateRowValues(newRows[rowIndex]);
          }
          
          return { rows: newRows };
        });
      },
      getProcessedRows: () => {
        const state = get();
        return state.rows;
      }
    }),
    { name: 'excel-store' }
  )
);