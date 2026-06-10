from pydantic import BaseModel
from typing import List


class InstanceCreate(BaseModel):
    instanceName: str
    description: str
    symbol: str
    timeframes: List[str]
    fieldsToScrape: List[str]