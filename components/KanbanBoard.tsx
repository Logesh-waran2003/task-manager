"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";

type Task = {
  id: string;
  content: string;
};

type Column = {
  id: string;
  title: string;
  taskIds: string[];
};

type KanbanData = {
  columns: Record<string, Column>;
  tasks: Record<string, Task>;
  columnOrder: string[];
};

const columnColors: Record<string, string> = {
  todo: "bg-gradient-to-r from-blue-400/80 to-blue-600/80 text-white",
  inprogress: "bg-gradient-to-r from-yellow-400/80 to-yellow-600/80 text-white",
  done: "bg-gradient-to-r from-green-400/80 to-green-600/80 text-white",
};

const initialData: KanbanData = {
  columns: {
    todo: {
      id: "todo",
      title: "To Do",
      taskIds: ["task-1", "task-2"],
    },
    inprogress: {
      id: "inprogress",
      title: "In Progress",
      taskIds: ["task-3"],
    },
    done: {
      id: "done",
      title: "Done",
      taskIds: [],
    },
  },
  tasks: {
    "task-1": { id: "task-1", content: "Design UI" },
    "task-2": { id: "task-2", content: "Set up database" },
    "task-3": { id: "task-3", content: "Implement drag and drop" },
  },
  columnOrder: ["todo", "inprogress", "done"],
};

// Define the column keys as a union type
// Use only as a type, not a value
// type ColumnKey = typeof columnKeys[number];
type ColumnKey = "todo" | "inprogress" | "done";

export default function KanbanBoard() {
  const [data, setData] = useState<KanbanData>(initialData);
  const [newTask, setNewTask] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Use a type-safe mapping for refs, allowing null
  const columnRefs: Record<
    ColumnKey,
    React.RefObject<HTMLDivElement | null>
  > = {
    todo: useRef<HTMLDivElement>(null),
    inprogress: useRef<HTMLDivElement>(null),
    done: useRef<HTMLDivElement>(null),
  };

  function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }
    const start = data.columns[source.droppableId];
    const finish = data.columns[destination.droppableId];
    if (start === finish) {
      const newTaskIds = Array.from(start.taskIds);
      newTaskIds.splice(source.index, 1);
      newTaskIds.splice(destination.index, 0, draggableId);
      const newColumn = {
        ...start,
        taskIds: newTaskIds,
      };
      setData({
        ...data,
        columns: {
          ...data.columns,
          [newColumn.id]: newColumn,
        },
      });
      return;
    }
    // Moving from one column to another
    const startTaskIds = Array.from(start.taskIds);
    startTaskIds.splice(source.index, 1);
    const newStart = {
      ...start,
      taskIds: startTaskIds,
    };
    const finishTaskIds = Array.from(finish.taskIds);
    finishTaskIds.splice(destination.index, 0, draggableId);
    const newFinish = {
      ...finish,
      taskIds: finishTaskIds,
    };
    setData({
      ...data,
      columns: {
        ...data.columns,
        [newStart.id]: newStart,
        [newFinish.id]: newFinish,
      },
    });
  }

  function handleAddTask(e?: React.FormEvent<HTMLFormElement>) {
    if (e) e.preventDefault();
    if (!newTask.trim()) return;
    const id = `task-${Date.now()}`;
    setData((prev) => {
      const newTasks = { ...prev.tasks, [id]: { id, content: newTask } };
      const newTodo = {
        ...prev.columns.todo,
        taskIds: [id, ...prev.columns.todo.taskIds],
      };
      return {
        ...prev,
        tasks: newTasks,
        columns: { ...prev.columns, todo: newTodo },
      };
    });
    setNewTask("");
    inputRef.current?.focus();
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd/Ctrl+Enter to add task
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        handleAddTask();
      }
      // 1/2/3 to focus columns
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === "1")
        columnRefs.todo.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      if (e.key === "2")
        columnRefs.inprogress.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      if (e.key === "3")
        columnRefs.done.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      // "t" to focus input
      if (e.key === "t") inputRef.current?.focus();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
        <h1 className="text-3xl font-bold text-center">Kanban Board</h1>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.focus()}
              className="hidden sm:inline-flex"
            >
              <span className="font-mono text-xs">t</span> Focus Input
            </Button>
          </TooltipTrigger>
          <TooltipContent>Shortcut: t</TooltipContent>
        </Tooltip>
      </div>
      <form onSubmit={handleAddTask} className="flex gap-2 mb-6 justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Input
              ref={inputRef}
              className="max-w-md text-lg bg-neutral-100/80 dark:bg-neutral-900/60 border-2 border-neutral-200 dark:border-neutral-700 shadow-inner focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:border-blue-400 transition-all"
              placeholder="Add a new task... (Cmd/Ctrl+Enter)"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              aria-label="Add a new task"
            />
          </TooltipTrigger>
          <TooltipContent>Shortcut: Cmd/Ctrl+Enter</TooltipContent>
        </Tooltip>
        <Button type="submit" className="text-base px-6 py-2 rounded-md">
          Add
        </Button>
      </form>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {data.columnOrder.map((columnId) => {
            const column = data.columns[columnId];
            const tasks = column.taskIds.map(
              (taskId: string) => data.tasks[taskId]
            );
            // Cast columnId to ColumnKey for type safety
            const colKey = columnId as ColumnKey;
            return (
              <div key={column.id} ref={columnRefs[colKey]}>
                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <Card
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[340px] flex flex-col transition-all duration-200 border-2 shadow-md ${
                        snapshot.isDraggingOver
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                          : "border-transparent bg-white dark:bg-gray-800"
                      }`}
                    >
                      <CardHeader
                        className={`rounded-t-xl p-4 mb-2 ${
                          columnColors[column.id]
                        }`}
                      >
                        <CardTitle className="text-lg font-semibold tracking-tight">
                          {column.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 flex flex-col gap-3 p-4">
                        {tasks.map((task: Task, idx: number) => (
                          <Draggable
                            draggableId={task.id}
                            index={idx}
                            key={task.id}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                style={{
                                  ...provided.draggableProps.style,
                                  transition:
                                    "box-shadow 0.2s, background 0.2s, opacity 0.2s",
                                }}
                                className={`min-h-[48px] p-3 rounded-lg bg-white/90 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm select-none flex items-center gap-2
                                  ${
                                    snapshot.isDragging
                                      ? "shadow-2xl z-10 bg-blue-100 dark:bg-blue-900 opacity-90"
                                      : ""
                                  }
                                `}
                              >
                                <span
                                  {...provided.dragHandleProps}
                                  className="w-4 h-4 mr-2 flex items-center justify-center cursor-grab active:cursor-grabbing"
                                  aria-label="Drag handle"
                                >
                                  <svg
                                    width="16"
                                    height="16"
                                    fill="none"
                                    viewBox="0 0 16 16"
                                  >
                                    <circle cx="8" cy="3" r="1.5" fill="#888" />
                                    <circle cx="8" cy="8" r="1.5" fill="#888" />
                                    <circle
                                      cx="8"
                                      cy="13"
                                      r="1.5"
                                      fill="#888"
                                    />
                                  </svg>
                                </span>
                                <span className="flex-1 text-base font-medium text-neutral-800 dark:text-neutral-100">
                                  {task.content}
                                </span>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </CardContent>
                    </Card>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
      <div className="mt-8 flex flex-wrap gap-4 justify-center text-xs text-muted-foreground">
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">Cmd/Ctrl+Enter</span>
          </TooltipTrigger>
          <TooltipContent>Add task</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">t</span>
          </TooltipTrigger>
          <TooltipContent>Focus input</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">1/2/3</span>
          </TooltipTrigger>
          <TooltipContent>Scroll to column</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
