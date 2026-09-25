import type { StoryBeat } from "@/features/campaign/types";

export function toggleStorySession(beat: StoryBeat, sessionId: string): StoryBeat {
  return {
    ...beat,
    sessionIds: beat.sessionIds.includes(sessionId)
      ? beat.sessionIds.filter((id) => id !== sessionId)
      : [...beat.sessionIds, sessionId],
  };
}

export function removeSessionFromStory(
  story: StoryBeat[],
  sessionId: string,
): StoryBeat[] {
  return story.map((beat) => ({
    ...beat,
    sessionIds: beat.sessionIds.filter((id) => id !== sessionId),
  }));
}
