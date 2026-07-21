---
trigger: always_on
globs: 'docs/plan/**/*.md', src/**
---

---

description: Use this instructions whenever a bug is found and is trying to solve it.
applyTo: 'Use this instructions whenever a bug is found and is trying to solve it.' 'docs/plan/**/*.md', 'src/**' # when provided, instructions will automatically be added to the request context when the pattern matches an attached file
---

<!-- Tip: Use /create-instructions in chat to generate content with agent assistance -->
<!--  -->

You should update all plan files describing the bug, exploring the code, defining probable cause, code analysis, what will be attempted to fix it. Answer if what was changed didn't solve the problem, and, if not, what was learned from it (another code analysis).

## Bug description

<bug>
<description>

- use #tool:askQuestions to ask what was the bug, it's characteristics, what was the console output.
- **Define possible points of failure:** this step needs: description of the bug, code exploration and code analysis, defining probable cause, writing it down, updating the docs files.

  **FORMATTING RULE**: When writing down probable causes (e.g., in `docs/plan/task-bugs.md`), you MUST use the standard "Probable Cause Candidates" format with task list checkboxes.
  Example:
  ```markdown
  - **Probable Cause Candidates**:
    1. First possible cause description.
        - [ ] (Attempt 1: description of attempt. Result: outcome)
    2. Second possible cause description.
        - [x] (Attempt 2: description. Result: Failed)
  ```

  What do you need from the user to explore each of them (e.g. console outputs from the app during usage)?

  What do you need to explore to achieve your task? Accessing the main app files in its [directory](/opt/Obsidian/resources)? What is needed to implement to better explore the bug? Which is the path trace of what's happening? Can we somehow catch this failure point on the app's devtools?
- Look at the macro. Are the functions independent of each other? Did you path traced them?
</description>

<fixing>
<update-memory>

Update memory.
</update-memory>
<attempting>

**define what will be attempted to fix:**

After the last step, <recall> recall the code analysis and the code exploration</recall> done to define what are the probable causes and how we'll be solving it.

It's important that this is explictly wrote into a markdown file, so we can know what and how it was attempted.

</attempting>

<repeat>

If it didn't work: cycle must be redone from ```<description>``` and ```<attempting>```.

It's important that this step is done keeping register of what was learned from that approach.
</repeat>

</bug>
