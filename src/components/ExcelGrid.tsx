// src/components/ExcelGrid.tsx
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
} from '@tanstack/react-table';
import { useState, useMemo, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

interface ExcelRow {
  [key: string]: string | number;
}

const ROW_HEIGHT = 40;

export const ExcelGrid = () => {
  const { rows, columns, setData, updateCell, getProcessedRows } = useExcelStore();
  const columnHelper = createColumnHelper<ExcelRow>();
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnKey: string } | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [draggedValue, setDraggedValue] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Memoize processed rows
  const processedRows = useMemo(() => getProcessedRows(), [getProcessedRows]);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: string[][] = utils.sheet_to_json(worksheet, { header: 1 });

      const headerRowIndex = 18;
      const dataStartRow = 19;
      
      const headers = jsonData[headerRowIndex].map(String);
      const processedRows = jsonData.slice(dataStartRow).map((row, index) => {
        const rowData: ExcelRow = { id: index + 1 };
        headers.forEach((header, idx) => {
          const cleanHeader = header
            .replace(/[\n\r]/g, '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/gi, '');
            
          rowData[cleanHeader] = row[idx] || '';
        });
        return rowData;
      });

      setData(processedRows, headers);
    };
    reader.readAsArrayBuffer(file);
  }, [setData]);

  const handleDragStart = useCallback((e: React.DragEvent, value: string) => {
    setIsDragging(true);
    setDraggedValue(value);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add('bg-blue-50');
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.currentTarget.classList.remove('bg-blue-50');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, rowIndex: number, columnKey: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove('bg-blue-50');
    setIsDragging(false);
    
    if (draggedValue !== null) {
      updateCell(rowIndex, columnKey, draggedValue);
      setDraggedValue(null);
    }
  }, [draggedValue, updateCell]);

  const toggleRowSelection = useCallback((rowId: number) => {
    setSelectedRows(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(rowId)) {
        newSelected.delete(rowId);
      } else {
        newSelected.add(rowId);
      }
      return newSelected;
    });
  }, []);

  const toggleColumnSelection = useCallback((columnKey: string) => {
    setSelectedColumns(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(columnKey)) {
        newSelected.delete(columnKey);
      } else {
        newSelected.add(columnKey);
      }
      return newSelected;
    });
  }, []);

  const tableColumns = useMemo(() => columns.map((col) => {
    const cleanKey = col.toLowerCase().replace(/[^a-z0-9]/gi, '');
    return columnHelper.accessor(cleanKey, {
      header: (info) => (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-gray-800">{col}</span>
            <button
              onClick={() => info.column.toggleSorting()}
              className="p-1 hover:bg-gray-300 rounded text-gray-700"
            >
              {info.column.getIsSorted() === 'asc' ? '↑' : info.column.getIsSorted() === 'desc' ? '↓' : '↕'}
            </button>
          </div>
          <input
            type="text"
            placeholder="Filter..."
            className="text-sm p-1 border border-gray-300 rounded w-24 text-gray-800 placeholder-gray-400"
            value={(info.column.getFilterValue() as string) ?? ''}
            onChange={(e) => info.column.setFilterValue(e.target.value)}
          />
          <button
            onClick={() => toggleColumnSelection(cleanKey)}
            className={`p-1 rounded text-sm font-medium ${
              selectedColumns.has(cleanKey) 
                ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                : 'text-gray-700 hover:bg-gray-300'
            }`}
          >
            {selectedColumns.has(cleanKey) ? 'Selected' : 'Select'}
          </button>
        </div>
      ),
      cell: (info) => {
        const isEditing = editingCell?.rowIndex === info.row.index && editingCell?.columnKey === cleanKey;
        const value = info.getValue();
        const isSelected = selectedRows.has(info.row.original.id as number);
        const isCalculated = ['productvalueinusd', 'discount', 'netamount'].includes(cleanKey);

        if (isEditing) {
          return (
            <input
              type="text"
              value={String(value)}
              onChange={(e) => {
                updateCell(info.row.index, cleanKey, e.target.value);
                setEditingCell(null);
              }}
              onBlur={() => setEditingCell(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setEditingCell(null);
                }
                if (e.key === 'Escape') {
                  setEditingCell(null);
                }
              }}
              className="w-full p-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
              autoFocus
            />
          );
        }

        return (
          <div
            draggable={!isCalculated}
            onDragStart={(e) => handleDragStart(e, String(value))}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, info.row.index, cleanKey)}
            onClick={() => !isCalculated && setEditingCell({ rowIndex: info.row.index, columnKey: cleanKey })}
            className={`
              cursor-pointer p-1 rounded transition-colors text-gray-800
              ${isSelected ? 'bg-blue-50' : ''}
              ${isDragging ? 'bg-blue-100' : ''}
              ${isCalculated ? 'bg-gray-50 cursor-not-allowed text-gray-600' : 'hover:bg-gray-50'}
            `}
          >
            {value}
          </div>
        );
      },
      enableSorting: true,
      enableResizing: true,
      size: 150,
    });
  }), [columns, editingCell, selectedRows, selectedColumns, isDragging, handleDragStart, handleDragOver, handleDragLeave, handleDrop, toggleColumnSelection, updateCell]);

  const table = useReactTable({
    data: processedRows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
  });

  const virtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div className="p-4 bg-white rounded-lg shadow-lg">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="relative">
            <input
              type="file"
              onChange={handleFileUpload}
              accept=".xlsx, .xls"
              className="hidden"
            />
            <span className="px-4 py-2 bg-blue-500 text-white rounded-lg cursor-pointer hover:bg-blue-600 transition-colors">
              Upload Excel File
            </span>
          </label>
          {rows.length > 0 && (
            <div className="text-sm text-gray-600">
              {rows.length} rows loaded
            </div>
          )}
        </div>
      </div>
      
      {rows.length > 0 ? (
        <div className="overflow-x-auto border border-gray-300 rounded-lg shadow-sm">
          <div ref={containerRef} className="relative" style={{ height: '600px', overflow: 'auto' }}>
            <table className="min-w-full border-collapse bg-white">
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id} className="bg-gray-100">
                    <th className="border border-gray-300 p-2 bg-gray-200 w-12">
                      <button
                        onClick={() => {
                          const allIds = rows.map(row => row.id as number);
                          setSelectedRows(new Set(allIds));
                        }}
                        className="p-1 rounded hover:bg-gray-300 text-sm font-medium text-gray-700"
                      >
                        Select All
                      </button>
                    </th>
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        className="border border-gray-300 p-2 bg-gray-200"
                        style={{ width: header.getSize() }}
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
              <tbody style={{ position: 'relative', height: `${virtualizer.getTotalSize()}px` }}>
                {virtualRows.map(virtualRow => {
                  const row = table.getRowModel().rows[virtualRow.index];
                  return (
                    <tr 
                      key={`row-${row.original.id}`}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                        height: `${virtualRow.size}px`,
                      }}
                      className={`
                        ${selectedRows.has(row.original.id as number) ? 'bg-blue-50' : 'bg-white'}
                        hover:bg-gray-50 transition-colors
                      `}
                    >
                      <td className="border border-gray-300 p-2">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(row.original.id as number)}
                          onChange={() => toggleRowSelection(row.original.id as number)}
                          className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                        />
                      </td>
                      {row.getVisibleCells().map(cell => (
                        <td 
                          key={`cell-${row.original.id}-${cell.column.id}`}
                          className="border border-gray-300 p-2"
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center p-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <div className="text-gray-700 text-lg mb-4">
            No data loaded yet
          </div>
          <div className="text-gray-500 text-sm">
            Upload an Excel file to begin
          </div>
        </div>
      )}
    </div>
  );
};