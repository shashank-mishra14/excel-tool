import { create } from 'zustand';

interface ExcelStore {
  rows: any[];
  columns: string[];
  setData: (rows: any[], columns: string[]) => void;
  updateCell: (rowIndex: number, columnKey: string, value: any) => void;
}

export const useExcelStore = create<ExcelStore>((set) => ({
  rows: [],
  columns: [],
  setData: (rows, columns) => set({ rows, columns }),
  updateCell: (rowIndex, columnKey, value) => 
    set((state) => {
      const newRows = [...state.rows];
      const row = newRows[rowIndex];
      
      // Update cell value
      row[columnKey] = value;
  
      // Auto-calculate formulas
      if (['rateinusd_6', 'totalnoofboxes_7', 'totalqty_8'].includes(columnKey)) {
        const rate = parseFloat(row['rateinusd_6']) || 0;
        const boxes = parseFloat(row['totalnoofboxes_7']) || 0;
        const qty = parseFloat(row['totalqty_8']) || 0;
        
        row['productvalueinusd_9'] = rate * boxes * qty;
        row['discount_15'] = Math.min(row['productvalueinusd_9'] * 0.15, 50);
        row['netamount_16'] = row['productvalueinusd_9'] - row['discount_15'];
      }
  
      return { rows: newRows };
    }),
}));