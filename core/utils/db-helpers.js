import * as db from '../db.js';
import { deserializeState } from '../state.js';

export async function getStackFrame(frameId) {
  const d = await db.getDB();
  const rows = await d.query('MATCH (f:StackFrame {id: $frameId}) RETURN f', { frameId });
  if (!rows[0]?.f) return null;
  const frame = rows[0].f;
  frame.vm_state = deserializeState(frame.vm_state);
  return frame;
}

export async function getParentFrame(childFrameId) {
  const d = await db.getDB();
  const rows = await d.query(
    'MATCH (parent:StackFrame)-[:WAITING_ON]->(child:StackFrame {id: $childFrameId}) RETURN parent',
    { childFrameId }
  );
  if (!rows[0]?.parent) return null;
  const parent = rows[0].parent;
  parent.vm_state = deserializeState(parent.vm_state);
  return parent;
}