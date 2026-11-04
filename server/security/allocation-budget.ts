import { getHeapStatistics } from "node:v8";

// Reserve room for decoding, validation/record copies and response serialization.
export function allocationByteLimit(maximum = 50 * 1024 * 1024): number {
  const heap = getHeapStatistics();
  return Math.min(
    maximum,
    Math.max(
      0,
      Math.floor(
        (heap.heap_size_limit - heap.used_heap_size - 32 * 1024 * 1024) / 8,
      ),
    ),
  );
}
