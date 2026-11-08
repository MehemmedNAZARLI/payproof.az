import { Avatar } from "@/components/ui/avatar";
import { TaskStatusBadge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/card";
import { ListGroup, ListItem } from "@/components/ui/list";
import type { Schemas } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";

// Open tasks, read-only: assigning and changing tasks happens on the web.
export function TasksList({ tasks }: { tasks: Schemas["Task"][] }) {
  const open = tasks.filter((x) => x.status !== "RESOLVED");
  if (open.length === 0) return null;
  return (
    <section aria-labelledby="tasks-title">
      <SectionHeader id="tasks-title" title={t.detail.tasks} />
      <ListGroup label={t.detail.tasks}>
        {open.map((task) => (
          <ListItem
            key={task.id}
            multiline
            leading={<Avatar user={task.assignee} />}
            title={`${task.number} · ${t.rule.short[task.rule_id] ?? task.rule_id}`}
            subtitle={t.detail.taskDue(task.assignee.full_name, formatDate(task.due_date))}
            trailing={<TaskStatusBadge status={task.status} />}
          />
        ))}
      </ListGroup>
    </section>
  );
}
