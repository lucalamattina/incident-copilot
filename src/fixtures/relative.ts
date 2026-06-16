import { NOW } from "../domain/clock";

/** A timestamp `m` minutes before the fixed NOW anchor. */
export const minutesAgo = (m: number): Date => new Date(NOW.getTime() - m * 60_000);

/** A timestamp `h` hours before the fixed NOW anchor. */
export const hoursAgo = (h: number): Date => minutesAgo(h * 60);
