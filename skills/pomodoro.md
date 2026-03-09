---
name: pomodoro
description: Simple Pomodoro timer for focused work sessions with session tracking and productivity analytics. Use when users request focus timers, ask about productivity patterns, or want to track work sessions over time.
license: MIT
allowed-tools:
  - execute_shell
---

# Pomodoro Timer Skill

## Overview

A 25-minute timer for focused work sessions that saves every session to SQLite. Enables history tracking, productivity analytics, and pattern recognition over time.

**This is a System Skill** - it provides handles to operate a personal data system. As commands run and sessions accumulate, context builds and compounds. The system learns patterns and provides increasingly valuable insights through an OODA loop of observation, orientation, decision, and action.

## Mental Model: The OODA Loop

Operating this skill involves running a continuous cycle:

1. **Observe** → Check current status (`npx tsx src/scripts/pomodoro/cli.ts status`) and review history (`npx tsx src/scripts/pomodoro/cli.ts history`)
2. **Orient** → Analyze patterns in the data (`npx tsx src/scripts/pomodoro/cli.ts stats -p week`)
3. **Decide** → Determine optimal actions (e.g., "Morning sessions have 95% completion - schedule deep work then")
4. **Act** → Start sessions (`npx tsx src/scripts/pomodoro/cli.ts start`), provide recommendations, celebrate milestones

Each cycle builds on accumulated data, making insights more valuable over time.

## Dependencies

- Binary location: `npx tsx src/scripts/pomodoro/cli.ts` from the root of the project
- Database: Auto-created at `~/.claude/skills/pomodoro/pomodoro.db` on first run

## Quick Decision Tree

```
User task → What kind of request?
   ├─ Start focused work → Check status first, then start session
   ├─ Check current timer → Use status command
   ├─ Review productivity → Use stats command (day/week/month/year)
   ├─ View past sessions → Use history command
   └─ Stop early → Use stop command
```

## Core Commands

### Starting a Session

Begin a Pomodoro session:

```bash
# Traditional 25-minute Pomodoro
npx tsx src/scripts/pomodoro/cli.ts start -t "Refactor authentication module"

# Custom durations and cycles
npx tsx src/scripts/pomodoro/cli.ts start -t "Quick review" -w 5 -b 3 -c 2
npx tsx src/scripts/pomodoro/cli.ts start -t "Deep focus" -w 50 -b 10 -c 1

# Flash cards (rapid cycles)
npx tsx src/scripts/pomodoro/cli.ts start -t "Flash cards" -w 2 -b 1 -c 5
```

**Options:**
- `-w <minutes>` - Work duration (default: 25)
- `-b <minutes>` - Break duration (default: 5)
- `-c <count>` - Number of work+break rounds (default: 1)

**JSON output example:**
```bash
npx tsx src/scripts/pomodoro/cli.ts start -t "Write docs" --json
# Returns: {"status": "started", "task": "Write docs", ...}
```

### Checking Status

See if a timer is running:

```bash
npx tsx src/scripts/pomodoro/cli.ts status
npx tsx src/scripts/pomodoro/cli.ts status --json  # For programmatic use
```

### Viewing History

Review past sessions:

```bash
npx tsx src/scripts/pomodoro/cli.ts history -d 7    # Last 7 days
npx tsx src/scripts/pomodoro/cli.ts history -d 30   # Last 30 days
npx tsx src/scripts/pomodoro/cli.ts history --json  # For programmatic use
```

### Analyzing Productivity

Get insights from accumulated data:

```bash
npx tsx src/scripts/pomodoro/cli.ts stats -p day     # Today's stats
npx tsx src/scripts/pomodoro/cli.ts stats -p week    # This week
npx tsx src/scripts/pomodoro/cli.ts stats -p month   # This month
npx tsx src/scripts/pomodoro/cli.ts stats -p year    # This year
npx tsx src/scripts/pomodoro/cli.ts stats --json     # For programmatic use
```

### Stopping Early

End the current session before completion:

```bash
npx tsx src/scripts/pomodoro/cli.ts stop
```

Use when interruptions occur or task completes early. Session marked as incomplete in database.

## Essential Workflows

### Starting Focused Work

To help a user start a Pomodoro session:

1. **Check for active session**: `npx tsx src/scripts/pomodoro/cli.ts status`
2. **If clear, start with appropriate options**:
   - Traditional: `npx tsx src/scripts/pomodoro/cli.ts start -t "Deep work on authentication"`
   - Custom: `npx tsx src/scripts/pomodoro/cli.ts start -t "Sprint planning" -w 15 -b 5 -c 3`
3. **Confirm to user**: "25-minute Pomodoro started for [task name]. Timer running."

### Daily Review

To provide daily productivity summary:

1. **Fetch today's data**: `npx tsx src/scripts/pomodoro/cli.ts stats -p day --json`
2. **Parse and present insights**:
   - "Completed 6 Pomodoros today (3.0 hours of focus time)"
   - "5/6 sessions completed - 83% completion rate"
   - "Most work on: Refactoring, Documentation"
   - "Productive hours: 9-11 AM"

### Common Pitfalls

- **Starting When Session Already Active**: Only one session can run at a time. Run `npx tsx src/scripts/pomodoro/cli.ts status` before starting a new one.
- **Non-Descriptive Task Names**: Descriptive names enable better analytics.
- **Interrupting Long-Running Sessions**: Use the stop command to record partial sessions if you must interrupt.

## Binary Location

- **Path**: `src/scripts/pomodoro/cli.ts` from your project's root folder (`Gravity Claw`). 
- **Always use**: `npx tsx src/scripts/pomodoro/cli.ts`
