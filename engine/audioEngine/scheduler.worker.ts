/**
 * scheduler.worker.ts
 * Off-thread timer to ensure steady ticks for the DAW scheduler, 
 * even when the main thread is busy with UI or heavy JS tasks.
 */

let timerId: any = null;
let interval = 25; // ms

self.onmessage = (e) => {
    if (e.data === "start") {
        console.log("[SchedulerWorker] Starting timer...");
        if (timerId) clearInterval(timerId);
        timerId = setInterval(() => {
            self.postMessage("tick");
        }, interval);
    } else if (e.data === "stop") {
        console.log("[SchedulerWorker] Stopping timer...");
        if (timerId) clearInterval(timerId);
        timerId = null;
    } else if (typeof e.data === "object" && e.data.interval) {
        interval = e.data.interval;
        if (timerId) {
            clearInterval(timerId);
            timerId = setInterval(() => {
                self.postMessage("tick");
            }, interval);
        }
    }
};
