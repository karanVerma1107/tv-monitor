from fastapi import WebSocket
from collections import defaultdict
import json


connections = defaultdict(set)


async def connect(instance_id: str, websocket: WebSocket):
    await websocket.accept()
    connections[instance_id].add(websocket)


async def disconnect(instance_id: str, websocket: WebSocket):
    connections[instance_id].discard(websocket)


async def broadcast(instance_id: str, data: dict):
    if instance_id not in connections:
        return
    print(f"[WS] Broadcasting to {instance_id}: {data.get('timestamp')} - data keys: {list(data.get('data', {}).keys())}")
    dead = []
    for ws in connections[instance_id]:
        try:
            await ws.send_json(data)
        except:
            dead.append(ws)
    for ws in dead:
        connections[instance_id].discard(ws)