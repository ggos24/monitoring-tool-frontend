"use client";

import { useSearchParams } from "next/navigation";

import { EditorBadge, EditorGate, useEditorName } from "@/components/review/editor-gate";
import { Labelling } from "@/components/review/labelling";
import { TaskList } from "@/components/review/task-list";
import { parseTask } from "@/lib/review";

/** /review — the task list; /review?batch=&query=&part= — one task. */
export function ReviewPanel() {
  const [editor, setEditor, ready] = useEditorName();
  const task = parseTask(useSearchParams());
  if (!ready) return null;
  if (!editor) return <EditorGate onSubmit={setEditor} />;
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <EditorBadge name={editor} onChange={() => setEditor(null)} />
      </div>
      {task ? (
        <Labelling
          key={`${task.batchId}-${task.query}-${task.part}`}
          editor={editor}
          batchId={task.batchId}
          queryNumber={task.query}
          part={task.part}
        />
      ) : (
        <TaskList editor={editor} />
      )}
    </div>
  );
}
