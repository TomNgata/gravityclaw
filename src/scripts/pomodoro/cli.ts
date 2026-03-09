import { PomodoroDatabase } from "./db.js";
import { PomodoroTimer } from "./timer.js";

// Utility for simple colors
const colors = {
  red: (str: string) => `\x1b[31m${str}\x1b[0m`,
  green: (str: string) => `\x1b[32m${str}\x1b[0m`,
  yellow: (str: string) => `\x1b[33m${str}\x1b[0m`,
  blue: (str: string) => `\x1b[34m${str}\x1b[0m`,
  cyan: (str: string) => `\x1b[36m${str}\x1b[0m`,
  bold: (str: string) => `\x1b[1m${str}\x1b[0m`,
  dim: (str: string) => `\x1b[2m${str}\x1b[0m`,
};

// Global instances
let db: PomodoroDatabase;
let timer: PomodoroTimer;
let activeSessionId: number | null = null;

// Initialize database
async function initDatabase(): Promise<void> {
  db = new PomodoroDatabase();
  await db.init();
}

// Start command
async function startSession(options: {
  task: string;
  work?: number;
  break?: number;
  cycles?: number;
  json?: boolean;
}): Promise<void> {
  await initDatabase();

  const currentSession = db.getCurrentSession();
  if (currentSession) {
    if (options.json) {
      console.log(
        JSON.stringify(
          {
            error: "A session is already running",
            session: currentSession,
          },
          null,
          2
        )
      );
    } else {
      console.log(colors.red("A session is already running"));
      console.log(`Task: ${currentSession.task}`);
      console.log(`Started: ${currentSession.started_at}`);
    }
    process.exit(1);
  }

  const workMinutes = options.work || 25;
  const breakMinutes = options.break || 5;
  const cycles = options.cycles || 1;
  const workSeconds = workMinutes * 60;
  const breakSeconds = breakMinutes * 60;

  activeSessionId = db.startSession(options.task, workSeconds);

  timer = new PomodoroTimer();
  timer.start(options.task, workSeconds, breakSeconds, cycles, activeSessionId);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          status: "started",
          sessionId: activeSessionId,
          task: options.task,
          workDuration: workMinutes,
          breakDuration: breakMinutes,
          cycles: cycles,
        },
        null,
        2
      )
    );
  } else {
    console.log(colors.green("✓ Pomodoro session started!"));
    console.log(`Task: ${colors.bold(options.task)}`);
    console.log(`Work: ${workMinutes} min${cycles > 1 ? ` | Break: ${breakMinutes} min | Cycles: ${cycles}` : ""}`);
  }

  await waitForTimer(cycles);
}

// Wait for timer
async function waitForTimer(totalCycles: number): Promise<void> {
  let completedCycles = 0;

  return new Promise((resolve) => {
    timer.setCompleteCallback(() => {
      console.log(colors.green("\n✓ All cycles complete! Great work!"));
      if (activeSessionId) {
        db.completeSession(activeSessionId);
      }
      resolve();
    });

    timer.setCycleCompleteCallback(() => {
      completedCycles++;
      console.log(colors.green(`\n✓ Cycle ${completedCycles}/${totalCycles} complete!`));
      if (activeSessionId) {
        db.completeSession(activeSessionId);
      }
      if (completedCycles < totalCycles) {
        const state = timer.getState();
        if (state) {
          activeSessionId = db.startSession(state.task, state.duration);
        }
      }
    });

    timer.setBreakStartCallback(() => {
      console.log(colors.yellow("\n☕ Break time! Relax..."));
    });

    timer.setUpdateCallback((state) => {
      if (state.remaining % 60 === 0) {
        const timeLeft = timer.formatTimeRemaining(state.remaining);
        const mode = state.isBreak ? "Break" : "Work";
        const cycleInfo = totalCycles > 1 ? ` (Cycle ${state.currentCycle}/${state.totalCycles})` : "";
        process.stdout.write(`\r⏱  ${mode}${cycleInfo}: ${timeLeft} remaining  `);
      }
    });
  });
}

// Stop command
async function stopSession(options: { json?: boolean }): Promise<void> {
  await initDatabase();

  const currentSession = db.getCurrentSession();
  if (!currentSession) {
    if (options.json) {
      console.log(JSON.stringify({ error: "No active session" }, null, 2));
    } else {
      console.log(colors.yellow("No active session running"));
    }
    process.exit(1);
  }

  db.completeSession(currentSession.id as number);

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          status: "stopped",
          sessionId: currentSession.id,
          task: currentSession.task,
        },
        null,
        2
      )
    );
  } else {
    console.log(colors.yellow("⏹ Session stopped"));
    console.log(`Task: ${currentSession.task}`);
  }
}

// Status command
async function getStatus(options: { json?: boolean }): Promise<void> {
  await initDatabase();

  const currentSession = db.getCurrentSession();

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          running: currentSession !== null,
          session: currentSession,
        },
        null,
        2
      )
    );
    return;
  }

  if (!currentSession) {
    console.log(colors.dim("No active session"));
    return;
  }

  console.log(colors.green("✓ Session running"));
  console.log(`Task: ${colors.bold(currentSession.task)}`);
  console.log(`Started: ${currentSession.started_at}`);
  console.log(`Duration: 25 minutes`); // Simplified, could calculate from session duration
}

// History command
async function showHistory(options: {
  days?: number;
  json?: boolean;
}): Promise<void> {
  await initDatabase();

  const sessions = db.getSessionHistory(options.days || 7);

  if (options.json) {
    console.log(JSON.stringify(sessions, null, 2));
    return;
  }

  if (sessions.length === 0) {
    console.log(colors.dim("No sessions found"));
    return;
  }

  console.log(colors.bold(`\nPomodoro History (last ${options.days || 7} days):`));
  
  // Custom simple table
  console.log("Date\t\t\tTask\t\t\tStatus");
  console.log("----------------------------------------------------------------");
  sessions.forEach((session) => {
    const date = new Date(session.started_at).toLocaleString();
    const status = session.completed_at ? colors.green("Completed") : colors.yellow("Incomplete");
    // basic padding
    const paddedDate = date.padEnd(23);
    const paddedTask = session.task.substring(0, 20).padEnd(23);
    console.log(`${paddedDate}${paddedTask}${status}`);
  });
}

// Stats command
async function showStats(options: {
  period?: string;
  json?: boolean;
}): Promise<void> {
  await initDatabase();

  const validPeriods = ["day", "week", "month", "year"];
  const period = validPeriods.includes(options.period as string)
    ? (options.period as "day" | "week" | "month" | "year")
    : "week";

  const stats = db.getStatistics(period);

  if (options.json) {
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  console.log(colors.bold(`\nPomodoro Statistics (${stats.period}):\n`));
  console.log(`${colors.green("Total Sessions:")} ${stats.totalSessions}`);
  console.log(`${colors.green("Completed:")} ${stats.completedSessions}`);
  console.log(`${colors.yellow("Incomplete:")} ${stats.incompleteSessions}`);
  console.log(`${colors.blue("Completion Rate:")} ${stats.completionRate}%`);
  console.log(`${colors.cyan("Total Focus Time:")} ${stats.totalFocusTimeMinutes} minutes`);

  if (stats.mostProductiveHours.length > 0) {
    console.log(`\n${colors.bold("Most Productive Hours:")}`);
    stats.mostProductiveHours.forEach((hour) => {
      console.log(`  ${hour.hour}:00 - ${hour.count} session${hour.count > 1 ? "s" : ""}`);
    });
  }

  if (stats.taskDistribution.length > 0) {
    console.log(`\n${colors.bold("Top Tasks:")}`);
    stats.taskDistribution.forEach((task) => {
      console.log(`  ${task.task} - ${task.count} session${task.count > 1 ? "s" : ""}`);
    });
  }
}

// Very simple argument parser to replace @cliffy/command
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const isJson = args.includes("-j") || args.includes("--json");
  
  function getArgValue(shortFlag: string, longFlag: string): string | undefined {
    const shortIdx = args.indexOf(shortFlag);
    if (shortIdx !== -1 && shortIdx + 1 < args.length) return args[shortIdx + 1];
    
    const longIdx = args.indexOf(longFlag);
    if (longIdx !== -1 && longIdx + 1 < args.length) return args[longIdx + 1];
    
    return undefined;
  }

  switch (command) {
    case "start": {
      const task = getArgValue("-t", "--task");
      if (!task) {
        console.error(colors.red("Error: Task description is required (-t, --task)"));
        process.exit(1);
      }
      const rawWork = getArgValue("-w", "--work");
      const rawBreak = getArgValue("-b", "--break");
      const rawCycles = getArgValue("-c", "--cycles");
      
      await startSession({
        task,
        work: rawWork ? parseInt(rawWork, 10) : undefined,
        break: rawBreak ? parseInt(rawBreak, 10) : undefined,
        cycles: rawCycles ? parseInt(rawCycles, 10) : undefined,
        json: isJson
      });
      break;
    }
    case "stop": {
      await stopSession({ json: isJson });
      break;
    }
    case "status": {
      await getStatus({ json: isJson });
      break;
    }
    case "history": {
      const rawDays = getArgValue("-d", "--days");
      await showHistory({
        days: rawDays ? parseInt(rawDays, 10) : undefined,
        json: isJson
      });
      break;
    }
    case "stats": {
      const period = getArgValue("-p", "--period");
      await showStats({ period, json: isJson });
      break;
    }
    default: {
      console.log(`
Pomodoro CLI - Simple pomodoro timer with session tracking.

Usage: 
  pomodoro start -t "Task name" [-w 25] [-b 5] [-c 1] [-j]
  pomodoro stop [-j]
  pomodoro status [-j]
  pomodoro history [-d 7] [-j]
  pomodoro stats [-p week] [-j]
      `);
      break;
    }
  }
}

main().catch(console.error);
