import { mkdir, appendFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

// Pads a number to 2 digits with a leading zero.
function pad2(n: number): string {
    return String(n).padStart(2, "0");
}

// Pads a number to 3 digits with leading zeros.
function pad3(n: number): string {
    return String(n).padStart(3, "0");
}

// Formats a Date as a local-time ISO 8601 string with an explicit UTC offset.
// Never uses toISOString() (UTC); the offset is always explicit so logs are
// unambiguous when the machine changes timezone.
export function formatLocalISO(d: Date): string {
    const year = d.getFullYear();
    const month = pad2(d.getMonth() + 1);
    const day = pad2(d.getDate());
    const hour = pad2(d.getHours());
    const min = pad2(d.getMinutes());
    const sec = pad2(d.getSeconds());
    const ms = pad3(d.getMilliseconds());
    const offsetMin = d.getTimezoneOffset();
    const sign = offsetMin <= 0 ? "+" : "-";
    const absMin = Math.abs(offsetMin);
    const offsetH = pad2(Math.floor(absMin / 60));
    const offsetM = pad2(absMin % 60);
    return `${year}-${month}-${day}T${hour}:${min}:${sec}.${ms}${sign}${offsetH}:${offsetM}`;
}

// Returns the directory path for a given base dir and local date: baseDir/YYYY/MM/DD.
export function getAuditDir(baseDir: string, when: Date): string {
    return join(baseDir, String(when.getFullYear()), pad2(when.getMonth() + 1), pad2(when.getDate()));
}

// Returns the log file path for a given base dir and local date: baseDir/YYYY/MM/DD/HH.log.
export function getAuditFile(baseDir: string, when: Date): string {
    return join(getAuditDir(baseDir, when), pad2(when.getHours()) + ".log");
}

// Appends a single audit line for a command invocation to the rolling log file.
// Creates the directory tree on first write. The when parameter defaults to now.
export async function audit(
    baseDir: string,
    command: string,
    args: readonly string[],
    when: Date = new Date()
): Promise<void> {
    await mkdir(getAuditDir(baseDir, when), {
        recursive: true,
    });
    const line = formatLocalISO(when) + " " + command + " " + args.join(" ") + "\n";
    await appendFile(getAuditFile(baseDir, when), line, "utf8");
}

// Deletes day-level log directories strictly older than 3 months from now.
// Computes the cutoff overflow-free: pins to the 1st of the target month then
// clamps the day to that month's length so Feb and 31-day months never drift.
// Empty month/year parent directories are left for the next prune run.
export async function pruneOldLogs(baseDir: string, now: Date = new Date()): Promise<void> {
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const lastDay = new Date(cutoff.getFullYear(), cutoff.getMonth() + 1, 0).getDate();
    cutoff.setDate(Math.min(now.getDate(), lastDay));
    cutoff.setHours(0, 0, 0, 0);

    let yearEntries;
    try {
        yearEntries = await readdir(baseDir, {
            withFileTypes: true,
        });
    }
    catch {
        return;
    }

    for (const yearEntry of yearEntries) {
        if (!yearEntry.isDirectory()) {
            continue;
        }
        const yearNum = parseInt(yearEntry.name, 10);
        if (isNaN(yearNum)) {
            continue;
        }
        const yearPath = join(baseDir, yearEntry.name);

        let monthEntries;
        try {
            monthEntries = await readdir(yearPath, {
                withFileTypes: true,
            });
        }
        catch {
            continue;
        }

        for (const monthEntry of monthEntries) {
            if (!monthEntry.isDirectory()) {
                continue;
            }
            const monthNum = parseInt(monthEntry.name, 10);
            if (isNaN(monthNum)) {
                continue;
            }
            const monthPath = join(yearPath, monthEntry.name);

            let dayEntries;
            try {
                dayEntries = await readdir(monthPath, {
                    withFileTypes: true,
                });
            }
            catch {
                continue;
            }

            for (const dayEntry of dayEntries) {
                if (!dayEntry.isDirectory()) {
                    continue;
                }
                const dayNum = parseInt(dayEntry.name, 10);
                if (isNaN(dayNum)) {
                    continue;
                }
                const dayDate = new Date(yearNum, monthNum - 1, dayNum, 0, 0, 0, 0);
                if (dayDate < cutoff) {
                    const dayPath = join(monthPath, dayEntry.name);
                    await rm(dayPath, {
                        recursive: true,
                        force: true,
                    });
                }
            }
        }
    }
}
