import { create } from 'zustand';

interface ExcelRow {
  [key: string]: string | number;
}

interface ExcelStore {
  rows: ExcelRow[];
  columns: string[];
  setData: (rows: ExcelRow[], columns: string[]) => void;
  updateCell: (rowIndex: number, columnKey: string, value: string | number) => void;
}

export const useExcelStore = create<ExcelStore>((set) => ({
  rows: [],
  columns: [],
  setData: (rows, columns) => set({ rows, columns }),
  updateCell: (rowIndex, columnKey, value) => 
    set((state) => {
      const newRows = [...state.rows];
      const cleanKey = columnKey.toLowerCase().replace(/[^a-z0-9]/gi, '');
      
      newRows[rowIndex] = { 
        ...newRows[rowIndex], 
        [cleanKey]: value 
      };
      
      // Auto calculations for specific columns
      if (['rateinusd', 'totalnoofboxes', 'totalqty'].includes(cleanKey)) {
        const rate = parseFloat(String(newRows[rowIndex].rateinusd)) || 0;
        const boxes = parseFloat(String(newRows[rowIndex].totalnoofboxes)) || 0;
        const qty = parseFloat(String(newRows[rowIndex].totalqty)) || 0;
        
        const amount = rate * boxes * qty;
        const discount = Math.min(amount * 0.15, 50);
        const netAmount = amount - discount;
        
        newRows[rowIndex].productvalueinusd = amount;
        newRows[rowIndex].discount = discount;
        newRows[rowIndex].netamount = netAmount;
      }
      
      return { rows: newRows };
    }),
}));