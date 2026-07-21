---
description: Describe when these instructions should be loaded by the agent based on task context
applyTo: '*'
---

1. Every time a task is completed inside the plan, it should be properly reviewed and the user must confirm its validation. The model should use #AskQuestions to confirm the task is done.

   All files inside [plan folder](../../docs/plan/) should be updated.
2. Whenever a new task is created, it should be linked to its relative objectives, tasks, validation steps, etc. This must be done using markdown links.

   Example:

   ```text
   "task 1 - given [objective 1](<path/to/obective#header-of-objective>) or [objective 2](<path/to/objective#L<objective-line-number-start>-L<L<objective-line-number-end>>)"
   ```

3. Prefer using mcp tools not related for using the terminal. You may use terminal tools only when necessary.
