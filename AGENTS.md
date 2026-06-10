<claude-mem-context>
# Memory Context

# [skill-eval-github] recent context, 2026-06-10 4:30pm GMT+8

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 20 obs (2,268t read) | 174,451t work | 99% savings

### Jun 10, 2026
531 3:38p 🔵 Eval test grade loop document is 719 lines
532 " 🔵 Eval-test-grade-loop document details Skill Creator full workflow
533 " 🔵 Full grading and improvement pipeline documented in 719-line reference
534 3:39p 🔵 Skill Creator reference implementation has 5307 lines across 15 files
535 " 🔵 Skill Creator schemas define 8 JSON data contracts
536 3:42p 🔵 Grader agent uses strict evidence-based assertion grading with eval critique
537 " 🔵 Blind comparator uses 1-5 rubric scoring across content and structure dimensions
538 " 🔵 Post-hoc analyzer bridges blind comparison with actionable skill improvements
539 " 🔵 Python scripts architecture revealed — claude -p subprocess pattern
540 3:43p 🔵 run_eval.py detects skill triggering via stream event monitoring
541 " 🔵 run_loop.py orchestrates automated description optimization with train/test split
542 " 🔵 improve_description.py uses claude -p subprocess for iterative prompt engineering
543 " 🔵 aggregate_benchmark.py supports two directory layouts and validates field names
**544** " 🔵 **quick_validate.py enforces strict frontmatter validation rules**
~31t 🔍 4,619

545 " 🔵 package_skill.py validates before packaging and supports exclusion patterns
546 " 🔵 utils.py parses SKILL.md frontmatter with YAML multiline support
**547** 3:49p 🔵 **generate_review.py serves zero-dependency HTML review viewer with two modes**
~37t 🔍 10,757

**548** " 🔵 **viewer.html implements single-page eval review with benchmark tab**
~32t 🔍 10,757

**549** " 🔵 **eval_review.html provides interactive eval set editing UI**
~32t 🔍 10,757

**550** 4:10p ⚖️ **Desktop client architecture decisions**
The user provided three architectural requirements to the primary Claude session: (1) desktop client should use Tauri instead of Electron due to Electron being too heavy, (2) the application should use workspace isolation with permission prompts rather than container-level isolation, and (3) core features need to run locally while multi-model support is gated as an advanced mode. These decisions set the technical direction for the project being built.
~251t ⚖️ 5,562


Access 174k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>