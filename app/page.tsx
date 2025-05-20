import Image from "next/image";
import KanbanBoard from "../components/KanbanBoard";

export default function Home() {
  return (
    <div className="min-h-screen p-8 sm:p-20 font-[family-name:var(--font-geist-sans)] bg-gray-50 dark:bg-gray-900">
      <main className="flex flex-col items-center">
        <KanbanBoard />
      </main>
    </div>
  );
}
