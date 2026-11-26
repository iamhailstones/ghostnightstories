export interface StoryChapter { title: string; body: string[] }
export interface Story { id: number; title: string; category: string; author: string; desc: string; body: string[]; chapterData?: StoryChapter[]; minutes: number; intensity: number; chapters: number; cover: string; status: string; created: string; kind: string; triggers: number[] }
export interface Opt { label: string; to: string }
export interface INode { text: string; options: Opt[]; ending: boolean }
export interface Interactive { id: number; name: string; start: string; nodes: Record<string, INode> }
export interface Mystery { id: number; title: string; body: string; clues: string; theories: { author: string; text: string }[]; reveal: string; date: string }
export interface Case { id: number; code: string; location: string; date: string; level: string; evidence: string; witness: string; notes: string; status: string }
export interface Video { id: number; url: string; category: string; level: string; enabled: boolean; ok: boolean; checked: string; error: string }
export interface User { id: number; email: string; name: string; role: string; bookmarks: number[]; progress: Record<string, number> }
export interface Seed { stories: Story[]; interactive: Interactive[]; mysteries: Mystery[]; archive: Case[] }
