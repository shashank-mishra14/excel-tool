import { ExcelGrid } from '@/components/ExcelGrid';

export default function Home() {
  return (
    <main className="min-h-screen p-24">
      <h1 className="text-3xl font-bold mb-8">Excel-like Tool</h1>
      <ExcelGrid />
    </main>
  );
}