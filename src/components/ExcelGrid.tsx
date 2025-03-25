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
import { useState } from 'react';

interface ExcelRow {
  [key: string]: string | number;
}

export const ExcelGrid = () => {
  const { rows, columns, setData, updateCell } = useExcelStore();
  const columnHelper = createColumnHelper<ExcelRow>();
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnKey: string } | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(new Set());
  const [draggedValue, setDraggedValue] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: string[][] = utils.sheet_to_json(worksheet, { header: 1 });

      // Specific handling for Commercial_Invoice.xlsx structure
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
  };

  const handleDragStart = (value: string) => {
    setDraggedValue(value);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (rowIndex: number, columnKey: string) => {
    if (draggedValue !== null) {
      updateCell(rowIndex, columnKey, draggedValue);
      setDraggedValue(null);
    }
  };

  const toggleRowSelection = (rowId: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
  };

  const toggleColumnSelection = (columnKey: string) => {
    const newSelected = new Set(selectedColumns);
    if (newSelected.has(columnKey)) {
      newSelected.delete(columnKey);
    } else {
      newSelected.add(columnKey);
    }
    setSelectedColumns(newSelected);
  };

  const tableColumns = columns.map((col) => {
    const cleanKey = col.toLowerCase().replace(/[^a-z0-9]/gi, '');
    return columnHelper.accessor(cleanKey, {
      header: (info) => (
        <div className="flex items-center gap-2">
          <span>{col}</span>
          <input
            type="text"
            placeholder="Filter..."
            className="text-sm p-1 border rounded"
            value={(info.column.getFilterValue() as string) ?? ''}
            onChange={(e) => info.column.setFilterValue(e.target.value)}
          />
          <button
            onClick={() => toggleColumnSelection(cleanKey)}
            className={`p-1 rounded ${selectedColumns.has(cleanKey) ? 'bg-blue-100' : ''}`}
          >
            Select
          </button>
        </div>
      ),
      cell: (info) => {
        const isEditing = editingCell?.rowIndex === info.row.index && editingCell?.columnKey === cleanKey;
        const value = info.getValue();
        const isSelected = selectedRows.has(info.row.original.id as number);

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
              }}
              className="w-full p-1 border rounded"
              autoFocus
            />
          );
        }

        return (
          <div
            draggable
            onDragStart={() => handleDragStart(String(value))}
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(info.row.index, cleanKey)}
            onClick={() => setEditingCell({ rowIndex: info.row.index, columnKey: cleanKey })}
            className={`cursor-pointer hover:bg-gray-50 p-1 rounded ${isSelected ? 'bg-blue-50' : ''}`}
          >
            {value}
          </div>
        );
      },
      enableSorting: true,
      enableResizing: true,
      size: 150,
    });
  });

  const table = useReactTable({
    data: rows,
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

  return (
    <div className="p-4">
      <input
        type="file"
        onChange={handleFileUpload}
        accept=".xlsx, .xls"
        className="mb-4 p-2 border rounded"
      />
      
      {rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse border border-gray-300">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  <th className="border border-gray-300 p-2 bg-gray-100 w-12">
                    <button
                      onClick={() => {
                        const allIds = rows.map(row => row.id as number);
                        setSelectedRows(new Set(allIds));
                      }}
                      className="p-1 rounded hover:bg-gray-200"
                    >
                      Select All
                    </button>
                  </th>
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="border border-gray-300 p-2 bg-gray-100"
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
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className={selectedRows.has(row.original.id as number) ? 'bg-blue-50' : ''}>
                  <td className="border border-gray-300 p-2">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(row.original.id as number)}
                      onChange={() => toggleRowSelection(row.original.id as number)}
                      className="w-4 h-4"
                    />
                  </td>
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="border border-gray-300 p-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-gray-500 text-center p-8">
          Upload an Excel file to begin
        </div>
      )}
    </div>
  );
};