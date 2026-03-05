from pydantic import BaseModel, Field
from typing import Optional

class MT5ConfigUpdate(BaseModel):
    login: Optional[int] = Field(None, description="MT5 Account Number")
    password: Optional[str] = Field(None, description="MT5 Password. If empty, the password will not be updated.")
    server: Optional[str] = Field(None, description="MT5 Server Name")
    
class MT5ConfigResponse(BaseModel):
    login: int
    server: str
