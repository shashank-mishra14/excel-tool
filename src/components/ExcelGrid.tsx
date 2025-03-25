'use client';
import { useExcelStore } from '@/stores/store';
import { read, utils } from 'xlsx';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  ColumnFiltersState,
  FilterFn,
  CellContext,
} from '@tanstack/react-table';
import { useState, useMemo, useCallback, memo } from 'react';
import { rankItem } from '@tanstack/match-sorter-utils';

interface ExcelRow {
  [key: string]: string | number;
  id: string;
}

const columnHelper = createColumnHelper<ExcelRow>();

const EditableCell = memo(({ 
  value, 
  isEditing, 
  onEdit, 
  onChange, 
  onKeyDown 
}: { 
  value: string | number;
  isEditing: boolean;
  onEdit: () => void;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}) => {
  return (
    <div
      className={`-m-3 p-3 ${
        isEditing 
          ? 'bg-blue-50 ring-2 ring-blue-500' 
          : 'hover:bg-gray-50'
      }`}
      onClick={onEdit}
      tabIndex={0}
      role="gridcell"
    >
      {isEditing ? (
        <input
          type="text"
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
          onKeyDown={onKeyDown}
        />
      ) : (
        <span className="block truncate">{value}</span>
      )}
    </div>
  );
});

EditableCell.displayName = 'EditableCell';

const fuzzyFilter: FilterFn<ExcelRow> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value);
  addMeta({ itemRank });
  return itemRank.passed;
};

export const ExcelGrid = () => {
  const { rows, columns, setData, updateCell } = useExcelStore();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnKey: string } | null>(null);

  // Process Excel file with proper error handling
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = utils.sheet_to_json<string[]>(worksheet, { header: 1 });

        // Enhanced header detection
        const headerRowIndex = jsonData.findIndex(row => 
          row.some(cell => String(cell).toLowerCase().includes('hs code'))
        );
        
        if (headerRowIndex === -1) throw new Error('Header row not found');
        
        const headers = jsonData[headerRowIndex]
          .map(String)
          .map(header => ({
            original: header,
            clean: header
              .toLowerCase()
              .replace(/[^a-z0-9]/gi, '')
              .replace(/\s+/g, '_')
          }));

        // Ensure unique column keys
        const uniqueHeaders = headers.reduce((acc, header) => {
          let count = 1;
          let key = header.clean;
          while (acc.has(key)) {
            key = `${header.clean}_${count++}`;
          }
          acc.set(key, header.original);
          return acc;
        }, new Map<string, string>());

        const processedRows = jsonData.slice(headerRowIndex + 1).map((row, index) => {
          const rowData: ExcelRow = { id: `row-${index}` };
          Array.from(uniqueHeaders.entries()).forEach(([key], idx) => {
            rowData[key] = row[idx] ?? '';
          });
          return rowData;
        });

        setData(processedRows, Array.from(uniqueHeaders.values()));
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error processing Excel file. Please check the format.');
    }
  }, [setData]);

  const handleKeyDown = (e: React.KeyboardEvent, info: CellContext<ExcelRow, string | number>) => {
    const row = info.row.original;
    const currentIndex = info.row.index;
    const currentColumn = info.column.id;
    
    switch (e.key) {
      case 'Enter':
        if (editingCell) {
          setEditingCell(null);
          // Move to next row
          const nextRow = table.getRowModel().rows[currentIndex + 1];
          if (nextRow) {
            setEditingCell({ rowId: nextRow.original.id, columnKey: currentColumn });
          }
        } else {
          setEditingCell({ rowId: row.id, columnKey: currentColumn });
        }
        e.preventDefault();
        break;
      case 'Tab':
        if (editingCell) {
          setEditingCell(null);
          // Move to next column
          const columns = table.getAllColumns();
          const currentColIndex = columns.findIndex(col => col.id === currentColumn);
          const nextColumn = columns[currentColIndex + 1];
          if (nextColumn) {
            setEditingCell({ rowId: row.id, columnKey: nextColumn.id });
            e.preventDefault();
          }
        }
        break;
      case 'Escape':
        if (editingCell) {
          setEditingCell(null);
          e.preventDefault();
        }
        break;
    }
  };

  const tableColumns = useMemo(() => {
    return columns.map((col) => {
      const cleanKey = col
        .toLowerCase()
        .replace(/[^a-z0-9]/gi, '')
        .replace(/\s+/g, '_');

      return columnHelper.accessor(cleanKey, {
        header: ({ column }) => (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold whitespace-nowrap">{col}</span>
              <button
                onClick={() => column.toggleSorting()}
                className="p-1 hover:bg-gray-200 rounded"
              >
                {{
                  asc: '↑',
                  desc: '↓',
                }[column.getIsSorted() as string] ?? '↕'}
              </button>
            </div>
            <input
              type="text"
              placeholder="Filter..."
              className="px-2 py-1 text-sm border rounded w-24 bg-white"
              value={(column.getFilterValue() ?? '') as string}
              onChange={e => column.setFilterValue(e.target.value)}
            />
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          const isEditing = editingCell?.rowId === row.id && editingCell?.columnKey === cleanKey;
          const value = info.getValue();

          return (
            <EditableCell
              value={value}
              isEditing={isEditing}
              onEdit={() => setEditingCell({ rowId: row.id, columnKey: cleanKey })}
              onChange={(newValue) => updateCell(info.row.index, cleanKey, newValue)}
              onKeyDown={(e) => handleKeyDown(e, info)}
            />
          );
        },
        size: 150,
        enableSorting: true,
        enableColumnFilter: true,
        filterFn: fuzzyFilter,
      });
    });
  }, [columns, editingCell, updateCell, handleKeyDown]);

  const table = useReactTable({
    data: rows as ExcelRow[],
    columns: tableColumns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    filterFns: {
      fuzzy: fuzzyFilter,
    },
    enableColumnFilters: true,
    enableSorting: true,
  });

  return (
    <div className="p-4 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <label className="inline-block">
          <span className="px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600 transition-colors">
            Choose File
          </span>
          <input
            type="file"
            onChange={handleFileUpload}
            accept=".xlsx,.xls"
            className="hidden"
          />
        </label>
        {rows.length > 0 && (
          <span className="ml-4 text-sm text-gray-600">
            {rows.length} rows loaded
          </span>
        )}
      </div>

      {rows.length > 0 ? (
        <div className="border border-gray-300 rounded-lg shadow-sm overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        colSpan={header.colSpan}
                        className="sticky top-0 bg-gray-100 text-left p-3 border-b border-r border-gray-300 font-semibold text-gray-700"
                        style={{ 
                          minWidth: '150px',
                          width: header.getSize()
                        }}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white">
                {table.getRowModel().rows.map(row => (
                  <tr 
                    key={row.id} 
                    className="hover:bg-gray-50 transition-colors"
                  >
                    {row.getVisibleCells().map(cell => (
                      <td
                        key={cell.id}
                        className="p-3 border-b border-r border-gray-200 text-gray-800"
                        style={{ 
                          minWidth: '150px',
                          width: cell.column.getSize()
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center p-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <p className="text-gray-500">Upload an Excel file to begin</p>
        </div>
      )}
    </div>
  );
};