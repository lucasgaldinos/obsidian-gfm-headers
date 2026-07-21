---
trigger: always_on
---

---

description: Describe when these instructions should be loaded by the agent based on task context
applyTo: '*'
---

1. Every time a task is completed inside the plan, it should be properly reviewed and the user must confirm its validation. The model should use #AskQuestions to confirm the task is done.

   All files inside [plan folder](../../docs/plan/) should be updated. When updating bug trackers (e.g. `task-bugs.md`), strictly adhere to the standardized formatting for "Probable Cause Candidates" using `- [ ]` checkboxes to track attempts and results.
2. Whenever a new task is created, it should be linked to its relative objectives, tasks, validation steps, etc. This must be done using markdown links.

   Example:

   ```text

   "task 1 - given [objective 1](<path/to/objective.ts>#header-of-objective) or [objective 2](<path/to/objective#L<line-number-start>-L<line-number-end)"
   "as was shown in [task 2](<path-to-task-2>#task-header)"
   ```

3. Prefer using mcp tools not related for using the terminal. You may use terminal tools only when necessary.
