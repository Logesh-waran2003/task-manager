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
import { Trash2, Sun, Moon, Briefcase, User, Layers } from "lucide-react";

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

const profileOptions = [
  { key: "all", icon: <Layers className="w-5 h-5" />, tooltip: "All" },
  { key: "work", icon: <Briefcase className="w-5 h-5" />, tooltip: "Work" },
  { key: "personal", icon: <User className="w-5 h-5" />, tooltip: "Personal" },
];
const profileKeys = ["work", "personal"];

export default function KanbanBoard() {
  const defaultKanbanData: KanbanData = initialData;
  const [profiles, setProfiles] = useState<{ [key: string]: KanbanData }>({});
  const [activeProfile, setActiveProfile] = useState("all");

  // Load profiles from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("kanban-profiles");
    if (stored) {
      const parsed = JSON.parse(stored);
      // Only keep 'work' and 'personal'
      setProfiles({
        work: parsed.work || initialData,
        personal: parsed.personal || initialData,
      });
    } else {
      setProfiles({
        work: initialData,
        personal: initialData,
      });
    }
    const storedActive = localStorage.getItem("kanban-active-profile");
    if (storedActive && ["all", ...profileKeys].includes(storedActive)) {
      setActiveProfile(storedActive);
    }
  }, []);

  // Save profiles and active profile to localStorage
  useEffect(() => {
    localStorage.setItem("kanban-profiles", JSON.stringify(profiles));
    localStorage.setItem("kanban-active-profile", activeProfile);
  }, [profiles, activeProfile]);

  // When switching profiles, just update activeProfile
  function switchProfile(profile: string) {
    setActiveProfile(profile);
  }

  // Merged data for 'All' view
  function getMergedData(): KanbanData {
    // Merge columns by id, merge tasks, and merge taskIds for each column
    const merged: KanbanData = {
      columns: {
        todo: { id: "todo", title: "To Do", taskIds: [] },
        inprogress: { id: "inprogress", title: "In Progress", taskIds: [] },
        done: { id: "done", title: "Done", taskIds: [] },
      },
      tasks: {},
      columnOrder: ["todo", "inprogress", "done"],
    };
    for (const profile of profileKeys) {
      const data = profiles[profile];
      if (!data) continue;
      for (const colId of merged.columnOrder) {
        merged.columns[colId].taskIds.push(
          ...data.columns[colId].taskIds.map((tid) => `${profile}__${tid}`)
        );
      }
      for (const [tid, task] of Object.entries(data.tasks)) {
        merged.tasks[`${profile}__${tid}`] = {
          ...task,
          id: `${profile}__${tid}`,
        };
      }
    }
    return merged;
  }

  // Add, move, delete logic for 'All'
  function updateProfileData(profile: string, newData: KanbanData) {
    setProfiles((prev) => ({ ...prev, [profile]: newData }));
  }

  const data =
    activeProfile === "all"
      ? getMergedData()
      : profiles[activeProfile] || defaultKanbanData;
  const setData = (newData: KanbanData) => {
    if (activeProfile === "all") return; // not used in 'all' mode
    updateProfileData(activeProfile, newData);
  };

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
  const [showCommandBar, setShowCommandBar] = useState(false);
  const [undoInfo, setUndoInfo] = useState<{
    task: Task;
    columnId: string;
    index: number;
    profile?: string;
  } | null>(null);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("kanban-board-data");
    if (saved) {
      try {
        setData(JSON.parse(saved));
      } catch {}
    }
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem("kanban-board-data", JSON.stringify(data));
  }, [data]);

  // On mount, sync dark mode with localStorage
  useEffect(() => {
    // Only run on client
    const stored = localStorage.getItem("kanban-dark-mode");
    const dark =
      stored !== null
        ? stored === "true"
        : document.documentElement.classList.contains("dark");
    setIsDark(dark);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("kanban-dark-mode", String(isDark));
  }, [isDark, mounted]);

  function onDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }
    if (activeProfile === "all") {
      // draggableId is in the form 'profile__taskid'
      const [profile, ...rest] = draggableId.split("__");
      if (profile !== "work" && profile !== "personal") return;
      const realTaskId = rest.join("__");
      const data = profiles[profile];
      if (!data) return;
      const start = data.columns[source.droppableId];
      const finish = data.columns[destination.droppableId];
      if (start === finish) {
        const newTaskIds = Array.from(start.taskIds);
        newTaskIds.splice(source.index, 1);
        newTaskIds.splice(destination.index, 0, realTaskId);
        const newColumn = {
          ...start,
          taskIds: newTaskIds,
        };
        updateProfileData(profile, {
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
      finishTaskIds.splice(destination.index, 0, realTaskId);
      const newFinish = {
        ...finish,
        taskIds: finishTaskIds,
      };
      updateProfileData(profile, {
        ...data,
        columns: {
          ...data.columns,
          [newStart.id]: newStart,
          [newFinish.id]: newFinish,
        },
      });
      return;
    }
    // Add a small delay to ensure proper positioning after drop
    setTimeout(() => {
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
    }, 10);
  }

  // Command bar open/close and keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ctrl+K or Cmd+K to open command bar
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandBar(true);
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
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when command bar opens
  useEffect(() => {
    if (showCommandBar) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [showCommandBar]);

  // Add state for destination profile when adding in 'All'
  const [addTaskProfile, setAddTaskProfile] = useState<
    "work" | "personal" | null
  >(null);

  function handleAddTaskFromCommandBar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newTask.trim()) return;
    const profile = activeProfile === "all" ? addTaskProfile : activeProfile;
    if (profile !== "work" && profile !== "personal") return;
    if (!profiles[profile]) return; // extra safety for linter
    const id = `task-${Date.now()}`;
    updateProfileData(profile, {
      ...profiles[profile],
      tasks: { ...profiles[profile].tasks, [id]: { id, content: newTask } },
      columns: {
        ...profiles[profile].columns,
        todo: {
          ...profiles[profile].columns.todo,
          taskIds: [id, ...profiles[profile].columns.todo.taskIds],
        },
      },
    });
    setNewTask("");
    setShowCommandBar(false);
    setAddTaskProfile(null);
  }

  // Close command bar with Esc
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setShowCommandBar(false);
    }
    if (showCommandBar) {
      window.addEventListener("keydown", handleEsc);
      return () => window.removeEventListener("keydown", handleEsc);
    }
  }, [showCommandBar]);

  function handleDeleteTask(taskId: string, columnId: string) {
    if (activeProfile === "all") {
      // taskId is in the form 'profile__taskid'
      const [profile, ...rest] = taskId.split("__");
      if (profile !== "work" && profile !== "personal") return;
      const realTaskId = rest.join("__");
      const data = profiles[profile];
      if (!data) return;
      const newTasks = { ...data.tasks };
      const deletedTask = newTasks[realTaskId];
      delete newTasks[realTaskId];
      const oldIndex = data.columns[columnId].taskIds.indexOf(realTaskId);
      const newColumn = {
        ...data.columns[columnId],
        taskIds: data.columns[columnId].taskIds.filter(
          (id) => id !== realTaskId
        ),
      };
      setUndoInfo({ task: deletedTask, columnId, index: oldIndex, profile });
      setShowUndo(true);
      if (undoTimeout.current) clearTimeout(undoTimeout.current);
      undoTimeout.current = setTimeout(() => setShowUndo(false), 5000);
      updateProfileData(profile, {
        ...data,
        tasks: newTasks,
        columns: { ...data.columns, [columnId]: newColumn },
      });
      return;
    }
    // Implement delete for work/personal profiles
    if (activeProfile === "work" || activeProfile === "personal") {
      const data = profiles[activeProfile];
      if (!data) return;
      const newTasks = { ...data.tasks };
      const deletedTask = newTasks[taskId];
      delete newTasks[taskId];
      const oldIndex = data.columns[columnId].taskIds.indexOf(taskId);
      const newColumn = {
        ...data.columns[columnId],
        taskIds: data.columns[columnId].taskIds.filter((id) => id !== taskId),
      };
      setUndoInfo({
        task: deletedTask,
        columnId,
        index: oldIndex,
        profile: activeProfile,
      });
      setShowUndo(true);
      if (undoTimeout.current) clearTimeout(undoTimeout.current);
      undoTimeout.current = setTimeout(() => setShowUndo(false), 5000);
      setData({
        ...data,
        tasks: newTasks,
        columns: { ...data.columns, [columnId]: newColumn },
      });
    }
  }

  function handleUndoDelete() {
    if (!undoInfo) return;
    const { profile, task, columnId, index } = undoInfo;
    if (profile !== "work" && profile !== "personal") return;
    const data = profiles[profile];
    if (!data) return;
    const newTasks = { ...data.tasks, [task.id]: task };
    const newTaskIds = [...data.columns[columnId].taskIds];
    newTaskIds.splice(index, 0, task.id);
    const newColumn = {
      ...data.columns[columnId],
      taskIds: newTaskIds,
    };
    updateProfileData(profile, {
      ...data,
      tasks: newTasks,
      columns: { ...data.columns, [columnId]: newColumn },
    });
    setShowUndo(false);
    setUndoInfo(null);
    if (undoTimeout.current) clearTimeout(undoTimeout.current);
  }

  function toggleDarkMode() {
    setIsDark((prev) => {
      const next = !prev;
      if (next) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      localStorage.setItem("kanban-dark-mode", String(next));
      return next;
    });
  }

  // Add undo shortcut (Ctrl+Z or Cmd+Z)
  useEffect(() => {
    function handleUndoShortcut(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (showUndo && undoInfo) {
          e.preventDefault();
          handleUndoDelete();
        }
      }
    }
    window.addEventListener("keydown", handleUndoShortcut);
    return () => window.removeEventListener("keydown", handleUndoShortcut);
  }, [showUndo, undoInfo]);

  // Add Space+1/2/3 shortcut to switch profiles (hold Space, then press 1/2/3)
  useEffect(() => {
    let spaceHeld = false;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.code === "Space") {
        spaceHeld = true;
      }
      if (spaceHeld) {
        if (e.key === "1") {
          switchProfile("all");
          e.preventDefault();
        } else if (e.key === "2") {
          switchProfile("work");
          e.preventDefault();
        } else if (e.key === "3") {
          switchProfile("personal");
          e.preventDefault();
        }
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        spaceHeld = false;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-2">
          {profileOptions.map((opt) => (
            <Tooltip key={opt.key}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => switchProfile(opt.key)}
                  className={`rounded-full p-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400
                    ${
                      activeProfile === opt.key
                        ? "bg-blue-500 text-white"
                        : "bg-transparent text-muted-foreground hover:bg-muted/30"
                    }
                  `}
                  aria-label={opt.tooltip}
                >
                  {opt.icon}
                </button>
              </TooltipTrigger>
              <TooltipContent>{opt.tooltip}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <h1 className="text-3xl font-bold text-center">Task Board</h1>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                aria-label="Toggle dark mode"
              >
                {isDark ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isDark ? "Light mode" : "Dark mode"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCommandBar(true)}
                className="hidden sm:inline-flex"
              >
                <span className="font-mono text-xs">Ctrl+K</span> Add Task
              </Button>
            </TooltipTrigger>
            <TooltipContent>Shortcut: Ctrl+K or Cmd+K</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {/* Command Bar Modal */}
      {showCommandBar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <form
            onSubmit={handleAddTaskFromCommandBar}
            className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl p-6 flex flex-col items-center w-full max-w-md"
          >
            <Input
              ref={inputRef}
              className="w-full text-lg bg-neutral-100/80 dark:bg-neutral-800/60 border-2 border-neutral-200 dark:border-neutral-700 shadow-inner focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:border-blue-400 transition-all"
              placeholder="Add a new task... (Enter to add, Esc to close)"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              aria-label="Add a new task"
            />
            {activeProfile === "all" && (
              <div className="flex gap-2 mt-3">
                <Button
                  type="button"
                  variant={addTaskProfile === "work" ? "default" : "outline"}
                  onClick={() => setAddTaskProfile("work")}
                >
                  Work
                </Button>
                <Button
                  type="button"
                  variant={
                    addTaskProfile === "personal" ? "default" : "outline"
                  }
                  onClick={() => setAddTaskProfile("personal")}
                >
                  Personal
                </Button>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <Button
                type="submit"
                className="text-base px-6 py-2 rounded-md"
                disabled={activeProfile === "all" && !addTaskProfile}
              >
                Add
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCommandBar(false);
                  setAddTaskProfile(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}
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
                      className={`min-h-[340px] flex flex-col transition-all duration-200 border-2 shadow-md rounded-b-xl
                        bg-white/80 dark:bg-gray-800/80 p-0
                        ${
                          snapshot.isDraggingOver
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                            : "border-transparent"
                        }
                        hide-scrollbar`}
                    >
                      <CardHeader
                        className={`rounded-t-xl p-4 ${
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
                                    "box-shadow 0.2s, background 0.2s, opacity 0.2s, transform 0.2s",
                                  zIndex: snapshot.isDragging ? 1000 : 1,
                                  opacity: snapshot.isDragging ? 1 : undefined,
                                  transform: snapshot.isDragging
                                    ? `${provided.draggableProps.style?.transform} scale(1.02)`
                                    : provided.draggableProps.style?.transform,
                                }}
                                className={`group min-h-[48px] p-3 rounded-lg bg-white/90 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm select-none flex items-center gap-2 mb-2
                                  ${
                                    snapshot.isDragging
                                      ? "shadow-2xl bg-blue-100 dark:bg-blue-900"
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
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteTask(task.id, column.id)
                                  }
                                  className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity text-lg text-red-500 hover:text-red-700 focus:outline-none"
                                  aria-label="Delete task"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
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
            <span className="cursor-help">Ctrl/Cmd+K</span>
          </TooltipTrigger>
          <TooltipContent>Show add task bar</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="cursor-help">1/2/3</span>
          </TooltipTrigger>
          <TooltipContent>Scroll to column</TooltipContent>
        </Tooltip>
      </div>
      {showUndo && undoInfo && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-4 animate-in fade-in">
          <span>Task deleted</span>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleUndoDelete}
            className="bg-white text-neutral-900 hover:bg-gray-200"
          >
            Undo
          </Button>
        </div>
      )}
    </div>
  );
}
