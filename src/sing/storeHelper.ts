import { Note } from "@/store/type";

export const DEFAULT_TPQN = 480;
export const DEFAULT_BPM = 120;
export const DEFAULT_BEATS = 4;
export const DEFAULT_BEAT_TYPE = 4;

/**
 * 頻繁に変更される値を保持します。
 * 値変更時に実行する関数を登録できます。
 */
export class FrequentlyUpdatedState<T> {
  private _value: T;
  private listeners = new Set<(newValue: T) => void>();

  get value() {
    return this._value;
  }

  set value(newValue: T) {
    this._value = newValue;
    this.listeners.forEach((listener) => listener(newValue));
  }

  constructor(initialValue: T) {
    this._value = initialValue;
  }

  addValueChangeListener(listener: (newValue: T) => void) {
    if (this.listeners.has(listener)) {
      throw new Error("The listener already exists.");
    }
    this.listeners.add(listener);
    listener(this.value);
  }

  removeValueChangeListener(listener: (newValue: T) => void) {
    if (!this.listeners.has(listener)) {
      throw new Error("The listener does not exist.");
    }
    this.listeners.delete(listener);
  }
}

type NoteInfo = {
  startTicks: number;
  endTicks: number;
  overlappingNoteIds: Set<string>;
};

export type OverlappingNoteInfos = Map<string, NoteInfo>;

export function addNotesToOverlappingNoteInfos(
  overlappingNoteInfos: OverlappingNoteInfos,
  notes: Note[]
): void {
  for (const note of notes) {
    overlappingNoteInfos.set(note.id, {
      startTicks: note.position,
      endTicks: note.position + note.duration,
      overlappingNoteIds: new Set(),
    });
  }
  // TODO: 計算量がO(n^2)になっているので、区間木などを使用してO(nlogn)にする
  for (const note of notes) {
    const overlappingNoteIds = new Set<string>();
    for (const [noteId, noteInfo] of overlappingNoteInfos) {
      if (noteId === note.id) {
        continue;
      }
      if (noteInfo.startTicks >= note.position + note.duration) {
        continue;
      }
      if (noteInfo.endTicks <= note.position) {
        continue;
      }
      overlappingNoteIds.add(noteId);
    }

    const noteId1 = note.id;
    const noteInfo1 = overlappingNoteInfos.get(noteId1);
    if (!noteInfo1) {
      throw new Error("noteInfo1 is undefined.");
    }
    for (const noteId2 of overlappingNoteIds) {
      const noteInfo2 = overlappingNoteInfos.get(noteId2);
      if (!noteInfo2) {
        throw new Error("noteInfo2 is undefined.");
      }
      noteInfo2.overlappingNoteIds.add(noteId1);
      noteInfo1.overlappingNoteIds.add(noteId2);
    }
  }
}

export function removeNotesFromOverlappingNoteInfos(
  overlappingNoteInfos: OverlappingNoteInfos,
  notes: Note[]
): void {
  for (const note of notes) {
    const noteId1 = note.id;
    const noteInfo1 = overlappingNoteInfos.get(noteId1);
    if (!noteInfo1) {
      throw new Error("noteInfo1 is undefined.");
    }
    for (const noteId2 of noteInfo1.overlappingNoteIds) {
      const noteInfo2 = overlappingNoteInfos.get(noteId2);
      if (!noteInfo2) {
        throw new Error("noteInfo2 is undefined.");
      }
      noteInfo2.overlappingNoteIds.delete(noteId1);
      noteInfo1.overlappingNoteIds.delete(noteId2);
    }
  }
  for (const note of notes) {
    overlappingNoteInfos.delete(note.id);
  }
}

export function updateNotesOfOverlappingNoteInfos(
  overlappingNoteInfos: OverlappingNoteInfos,
  notes: Note[]
): void {
  removeNotesFromOverlappingNoteInfos(overlappingNoteInfos, notes);
  addNotesToOverlappingNoteInfos(overlappingNoteInfos, notes);
}

export function getOverlappingNoteIds(
  currentNoteInfos: OverlappingNoteInfos
): Set<string> {
  const overlappingNoteIds = new Set<string>();
  for (const [noteId, noteInfo] of currentNoteInfos) {
    if (noteInfo.overlappingNoteIds.size !== 0) {
      overlappingNoteIds.add(noteId);
    }
  }
  return overlappingNoteIds;
}
