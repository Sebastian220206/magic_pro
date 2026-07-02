import { SoundFontParser } from './SoundFontParser'
import type { Sf2ParsedData } from './SoundFontParser'

export interface WorkerParseRequest {
  type: 'parse'
  id: string
  name: string
  data: ArrayBuffer
}

export interface WorkerParseResponse {
  type: 'parsed'
  id: string
  name: string
  parsedData: Sf2ParsedData
}

export interface WorkerErrorResponse {
  type: 'error'
  id: string
  name: string
  error: string
}

export type WorkerMessage = WorkerParseRequest
export type WorkerResponse = WorkerParseResponse | WorkerErrorResponse

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data
  if (msg.type === 'parse') {
    try {
      const parser = new SoundFontParser()
      const parsedData = parser.parse(msg.data)
      const response: WorkerParseResponse = {
        type: 'parsed',
        id: msg.id,
        name: msg.name,
        parsedData,
      }
      self.postMessage(response, {
        transfer: [parsedData.sampleData.buffer as ArrayBuffer],
      })
    } catch (err) {
      const response: WorkerErrorResponse = {
        type: 'error',
        id: msg.id,
        name: msg.name,
        error: err instanceof Error ? err.message : 'Unknown parse error',
      }
      self.postMessage(response)
    }
  }
}
